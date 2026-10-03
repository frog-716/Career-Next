import {expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createCipheriv,randomBytes} from 'node:crypto';
import {createSecretVault} from '../../apps/desktop/capabilities/secret-vault';
import {createSecretCoordinator} from '../../apps/desktop/capabilities/secret-coordinator';
import {resolveStartupProviderBinding} from '../../apps/desktop/capabilities/provider-startup';
import {createRuntimeBackend} from '../../packages/backend/bootstrap/runtime';
import type {ProviderBinding} from '../../packages/backend/platform/providers/binding';
async function fixture(){
 const root=await mkdtemp(path.join(tmpdir(),'career-g6-main-config-')),runtime=await createRuntimeBackend(path.join(root,'workspaces/local'),path.resolve('dist/application/writer.cjs'),root,{automaticBackups:false});
 const human=await runtime.connectHuman(),company=await runtime.business(human,'opportunity',{operation:'company.create',commandId:randomUUID(),name:'Coordinator isolated company'}) as any;
 let entered=false,release!:()=>void,failReplacement=false,nextAcknowledgement:Promise<void>|undefined;const held=new Promise<void>(resolve=>{release=resolve;}),key=randomBytes(32),controls:ProviderBinding[]=[];
 const storage={available:async()=>true,encrypt:async(value:string)=>{if(value==='VIRTUAL_HELD_SAVE_A'){entered=true;await held;}if(failReplacement&&value==='VIRTUAL_REPLACEMENT_B')throw Error('controlled encryption failure');const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);return Buffer.concat([nonce,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]);}};
 const security=path.join(root,'security'),vault=createSecretVault(security,storage),coordinator=createSecretCoordinator(vault,async binding=>{controls.push(binding);runtime.configureProvider(binding);const held=nextAcknowledgement;nextAcknowledgement=undefined;if(held)await held;});
 const prepare=()=>runtime.business(human,'ai',{operation:'product.prepare',commandId:randomUUID(),input:{target:{kind:'research-organize',owner:{kind:'company',id:company.company.id}},sources:[],egressSourceIds:[],wikiIds:[],egressWikiIds:[],objects:[]},budget:{requests:2,inputBytes:524288,outputBytes:196608}});
 return {runtime,vault,coordinator,prepare,controls,reopenedStatus:()=>createSecretVault(security,storage).request({operation:'status'}),startupBinding:()=>resolveStartupProviderBinding(security,()=>createSecretVault(security,storage).request({operation:'status'})),entered:()=>entered,release,failReplacement:()=>{failReplacement=true;},holdNextControl:()=>{let acknowledge!:()=>void;nextAcknowledgement=new Promise<void>(resolve=>{acknowledge=resolve;});return acknowledge;},close:async()=>{release();await runtime.close();key.fill(0);await rm(root,{recursive:true,force:true});}};
}
it('a newer disable cannot be undone by an older save completing; real vault and runtime both stay disabled',async()=>{
 const f=await fixture();try{
  const save=f.coordinator.request({operation:'save',value:'VIRTUAL_HELD_SAVE_A'});await expect.poll(f.entered).toBe(true);
  const disable=f.coordinator.request({operation:'disable'});expect(f.controls.at(-1)?.enabled).toBe(false);
  f.release();await Promise.all([save,disable]);expect(await f.vault.request({operation:'status'})).toMatchObject({kind:'status',status:{enabled:false}});
  expect(await f.prepare()).toEqual({kind:'failure',code:'provider_disabled'});
 }finally{await f.close();}
},15000);

it('a newer failed replacement cannot reopen the older save while its durable pending marker disables the vault',async()=>{
 const f=await fixture();try{
  const save=f.coordinator.request({operation:'save',value:'VIRTUAL_HELD_SAVE_A'});await expect.poll(f.entered).toBe(true);f.failReplacement();
  const replacement=f.coordinator.request({operation:'save',value:'VIRTUAL_REPLACEMENT_B'});f.release();
  const [saved,failed]=await Promise.all([save,replacement]);expect(saved.kind).toBe('status');expect(failed).toEqual({kind:'failure',code:'secret_save_failed'});
  expect(await f.vault.request({operation:'status'})).toMatchObject({kind:'status',status:{enabled:false}});expect(await f.prepare()).toEqual({kind:'failure',code:'provider_disabled'});
 }finally{await f.close();}
},15000);
it('only the newest successfully saved generation can become the actual runtime recipient',async()=>{
 const f=await fixture();try{
  const save=f.coordinator.request({operation:'save',value:'VIRTUAL_HELD_SAVE_A'});await expect.poll(f.entered).toBe(true);
  const replacement=f.coordinator.request({operation:'save',value:'VIRTUAL_REPLACEMENT_B'});f.release();await Promise.all([save,replacement]);
  const final=await f.vault.request({operation:'status'});if(final.kind!=='status')throw Error('status');expect(final.status.enabled).toBe(true);
  const result=await f.prepare() as any;expect(result.kind).toBe('product_task');expect(result.task.operations[0].recipient.generation).toBe(final.status.generation);
  expect(f.controls.filter(binding=>binding.enabled)).toEqual([{enabled:true,generation:final.status.generation}]);
 }finally{await f.close();}
},15000);
it('new intent closes the live gate before its acknowledgement and before the earlier save completes',async()=>{
 const f=await fixture();let acknowledge:(()=>void)|undefined;
 try{
  const save=f.coordinator.request({operation:'save',value:'VIRTUAL_HELD_SAVE_A'});await expect.poll(f.entered).toBe(true);
  acknowledge=f.holdNextControl();const disable=f.coordinator.request({operation:'disable'});f.release();await save;
  // B has not reached its serialized vault operation, but A may not reopen its execution gate.
  expect(await f.prepare()).toEqual({kind:'failure',code:'provider_disabled'});
  acknowledge();await disable;expect(await f.vault.request({operation:'status'})).toMatchObject({kind:'status',status:{enabled:false}});
 }finally{acknowledge?.();await f.close();}
},15000);
it('control acknowledgements resolving out of order cannot reorder save A and newer disable B in the durable vault',async()=>{
 const f=await fixture();let acknowledge:(()=>void)|undefined;
 try{
  acknowledge=f.holdNextControl();const save=f.coordinator.request({operation:'save',value:'VIRTUAL_HELD_SAVE_A'});
  const disable=f.coordinator.request({operation:'disable'});
  // B's control acknowledgement resolves first while A cannot reach its vault operation.
  await f.vault.request({operation:'status'});expect(f.entered()).toBe(false);
  acknowledge();await expect.poll(f.entered).toBe(true);f.release();await Promise.all([save,disable]);
  expect(await f.vault.request({operation:'status'})).toMatchObject({kind:'status',status:{enabled:false}});
  expect(await f.reopenedStatus()).toMatchObject({kind:'status',status:{enabled:false}});
  expect(await f.startupBinding()).toMatchObject({enabled:false});
  expect(await f.prepare()).toEqual({kind:'failure',code:'provider_disabled'});
 }finally{acknowledge?.();await f.close();}
},15000);

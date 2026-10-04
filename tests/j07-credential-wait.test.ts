import {it,expect,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {createSecretVault} from '../apps/desktop/capabilities/secret-vault';
it('protected read publishes waiting and status stays responsive while system authorization is pending',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-auth-wait-'));
 let resolve!:(value:string)=>void,started!:()=>void;
 const entered=new Promise<void>(done=>started=done),authorization=new Promise<string>(done=>resolve=done);
 const vault=createSecretVault(root,{available:async()=>true,encrypt:async()=>Buffer.from('OPAQUE TEST CIPHER'),decrypt:async()=>{started();return authorization;}},undefined,'tavily');
 try{const saved=await vault.request({operation:'save',value:'SYNTHETIC_WAIT_CREDENTIAL'});if(saved.kind!=='status')throw Error('save');
  const read=vault.readCredential(saved.status.generation!);await entered;
  const status=await Promise.race([vault.request({operation:'status'}),new Promise(done=>setTimeout(()=>done({blocked:true}),250))]);
  expect(status).toMatchObject({kind:'status',status:{authorization:'waiting_for_system_authorization'}});
  resolve('SYNTHETIC_WAIT_CREDENTIAL');expect(await read).toBe('SYNTHETIC_WAIT_CREDENTIAL');
 }finally{resolve('SYNTHETIC_WAIT_CREDENTIAL');await rm(root,{recursive:true,force:true});vi.useRealTimers();}
});

async function waitingVault(){
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-wait-model-'));let done!:(value:string)=>void,fail!:(error:unknown)=>void,entered!:()=>void,reads=0;
 const started=new Promise<void>(resolve=>entered=resolve),native=new Promise<string>((resolve,reject)=>{done=resolve;fail=reject;});
 const vault=createSecretVault(root,{available:async()=>true,encrypt:async()=>Buffer.from('OPAQUE TEST CIPHER'),decrypt:async()=>{reads++;entered();return native;}},undefined,'tavily');
 const saved=await vault.request({operation:'save',value:'SYNTHETIC_WAIT_CREDENTIAL'});if(saved.kind!=='status')throw Error('save');
 return {vault,generation:saved.status.generation!,started,done,fail,get reads(){return reads;},async close(){done('SYNTHETIC_WAIT_CREDENTIAL');vi.useRealTimers();await rm(root,{recursive:true,force:true});}};
}
it.each([0,57000,65000])('authorization after %i ms remains one pending read and becomes ready without leaking through status',async delay=>{
 const h=await waitingVault();vi.useFakeTimers({toFake:['setTimeout','clearTimeout','Date']});
 try{const first=h.vault.readCredential(h.generation),second=h.vault.readCredential(h.generation);await h.started;
  await vi.advanceTimersByTimeAsync(delay);
  const waiting=await h.vault.request({operation:'status'});expect(waiting).toMatchObject({kind:'status',status:{authorization:'waiting_for_system_authorization'}});expect(h.reads).toBe(1);
  h.done('SYNTHETIC_WAIT_CREDENTIAL');expect(await first).toBe('SYNTHETIC_WAIT_CREDENTIAL');expect(await second).toBe('SYNTHETIC_WAIT_CREDENTIAL');
  const ready=await h.vault.request({operation:'status'});expect(ready).toMatchObject({kind:'status',status:{authorization:'ready',readiness:'available'}});expect(JSON.stringify([waiting,ready])).not.toContain('SYNTHETIC_WAIT_CREDENTIAL');
 }finally{await h.close();}
});
it('user cancellation revokes all waiters, ignores late success, and never opens a duplicate native prompt',async()=>{
 const h=await waitingVault();
 try{const read=h.vault.readCredential(h.generation);const failure=expect(read).rejects.toThrow('credential_cancelled');await h.started;
  expect(await h.vault.request({operation:'cancel'})).toMatchObject({kind:'status',status:{authorization:'cancelled',readinessReason:'credential_cancelled'}});await failure;
  expect(await h.vault.request({operation:'check'})).toMatchObject({kind:'status',status:{authorization:'cancelled'}});expect(h.reads).toBe(1);
  h.done('SYNTHETIC_WAIT_CREDENTIAL');await new Promise<void>(resolve=>setImmediate(resolve));
  expect(await h.vault.request({operation:'status'})).toMatchObject({kind:'status',status:{authorization:'cancelled',readiness:'unavailable'}});
 }finally{await h.close();}
});
it.each([[-128,'credential_cancelled','cancelled'],[-25293,'credential_denied','denied']])('an explicit native status %i is preserved without exposing its raw error',async(code,reason,state)=>{
 const h=await waitingVault();
 try{const read=h.vault.readCredential(h.generation),failure=expect(read).rejects.toThrow(String(reason));await h.started;h.fail(Object.assign(Error('SYNTHETIC_KEY_IN_ERROR_MUST_NOT_LEAK'),{code}));await failure;
  const status=await h.vault.request({operation:'status'});expect(status).toMatchObject({kind:'status',status:{authorization:state,readinessReason:reason}});expect(JSON.stringify(status)).not.toContain('SYNTHETIC');
 }finally{await h.close();}
});
it('native generic failure stays unavailable rather than guessing cancelled or denied',async()=>{
 const h=await waitingVault();
 try{const read=h.vault.readCredential(h.generation),failure=expect(read).rejects.toThrow('credential_unavailable');await h.started;h.fail(Error('SYNTHETIC_ERROR'));await failure;expect(await h.vault.request({operation:'status'})).toMatchObject({kind:'status',status:{authorization:'unavailable',readinessReason:'decrypt_failed'}});}finally{await h.close();}
});
it('only the generous emergency guard times out; late completion cannot resurrect credential readiness',async()=>{
 const h=await waitingVault();vi.useFakeTimers({toFake:['setTimeout','clearTimeout','Date']});
 try{const read=h.vault.readCredential(h.generation),failure=expect(read).rejects.toThrow('credential_timeout');await h.started;await vi.advanceTimersByTimeAsync(899000);
  expect(await h.vault.request({operation:'status'})).toMatchObject({kind:'status',status:{authorization:'waiting_for_system_authorization'}});await vi.advanceTimersByTimeAsync(1000);await failure;
  expect(await h.vault.request({operation:'check'})).toMatchObject({kind:'status',status:{authorization:'timeout',readinessReason:'credential_timeout'}});expect(h.reads).toBe(1);
  h.done('SYNTHETIC_WAIT_CREDENTIAL');await new Promise<void>(resolve=>setImmediate(resolve));expect(await h.vault.request({operation:'status'})).toMatchObject({kind:'status',status:{authorization:'timeout',readiness:'unavailable'}});
 }finally{await h.close();}
});
it('cancel during native availability cannot start a later decrypt or a second authorization prompt',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-cancel-initialization-'));let checks=0,decrypts=0,entered!:()=>void,finish!:(value:boolean)=>void;
 const started=new Promise<void>(resolve=>entered=resolve),nativeAvailability=new Promise<boolean>(resolve=>finish=resolve);
 const vault=createSecretVault(root,{available:async()=>{if(++checks===1)return true;entered();return nativeAvailability;},encrypt:async()=>Buffer.from('OPAQUE'),decrypt:async()=>{decrypts++;return 'SYNTHETIC_WAIT_CREDENTIAL';}},undefined,'tavily');
 try{const saved=await vault.request({operation:'save',value:'SYNTHETIC_WAIT_CREDENTIAL'});if(saved.kind!=='status')throw Error('save');const read=vault.readCredential(saved.status.generation!),rejection=expect(read).rejects.toThrow('credential_cancelled');await started;await vault.request({operation:'cancel'});await rejection;finish(true);await vault.request({operation:'disable'});expect(decrypts).toBe(0);}finally{finish(true);await rm(root,{recursive:true,force:true});}
});

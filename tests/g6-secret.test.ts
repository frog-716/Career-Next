import {it,expect} from 'vitest';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createSecretVault} from '../apps/desktop/capabilities/secret-vault';

it('new, replacement, disabled, failed replacement and deleted credentials never return or fall back to secret text',async()=>{
 const root=await mkdtemp(join(tmpdir(),'career-g6-secret-'));let available=true,fail=false;
 const crypto={available:async()=>available,encrypt:async(value:string)=>{if(fail)throw Error(value);return Buffer.from('cipher-only-fixture');}};
 const vault=createSecretVault(root,crypto);
 const fake='FAKE-G6-NOT-A-REAL-KEY';const responses:unknown[]=[];
 try{
  responses.push(await vault.request({operation:'save',value:fake}));const first=await vault.request({operation:'status'});
  expect(first).toMatchObject({kind:'status',status:{configured:true,enabled:true}});
  responses.push(first,await vault.request({operation:'disable'}));fail=true;
  responses.push(await vault.request({operation:'save',value:fake+'-replacement'}));
  expect(await vault.request({operation:'status'})).toMatchObject({kind:'status',status:{configured:true,enabled:false}});
  fail=false;available=false;responses.push(await vault.request({operation:'save',value:fake}));
  expect(responses.at(-1)).toEqual({kind:'failure',code:'secure_storage_unavailable'});
  available=true;responses.push(await vault.request({operation:'save',value:fake+'-new'}));
  const second=await vault.request({operation:'status'});expect(second).toMatchObject({kind:'status',status:{configured:true,enabled:true}});
  if(first.kind==='status'&&second.kind==='status')expect(first.status.generation).not.toBe(second.status.generation);
  responses.push(second,await vault.request({operation:'delete'}));
  expect(await vault.request({operation:'status'})).toEqual({kind:'status',status:{configured:false,enabled:false}});
  expect(JSON.stringify(responses)).not.toContain(fake);
  const files=await readdir(root);for(const file of files)expect((await readFile(join(root,file))).includes(Buffer.from(fake))).toBe(false);
  expect(await vault.request({operation:'read',value:fake} as never)).toEqual({kind:'failure',code:'invalid_request'});
 }finally{await rm(root,{recursive:true,force:true});}
});

it('metadata rename followed by directory durability failure cannot leave an enabled dangling binding',async()=>{
 const root=await mkdtemp(join(tmpdir(),'career-g6-secret-durability-'));let syncs=0;
 try{const vault=createSecretVault(root,{available:async()=>true,encrypt:async value=>Buffer.from('encrypted:'+value)},{syncDirectory:async()=>{if(++syncs===2)throw Object.assign(Error('controlled directory sync failure'),{code:'EIO'});}});
 expect(await vault.request({operation:'save',value:'FAKE_POST_RENAME_SECRET'})).toEqual({kind:'failure',code:'secret_save_failed'});
 const status=await vault.request({operation:'status'});expect(status).toMatchObject({kind:'status',status:{configured:true,enabled:false}});
 const binding=JSON.parse(await readFile(join(root,'binding.json'),'utf8'));expect(binding.enabled).toBe(false);expect((await readdir(root)).includes(binding.generation+'.encrypted')).toBe(true);
 }finally{await rm(root,{recursive:true,force:true});}
});

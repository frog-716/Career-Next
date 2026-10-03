import {it,expect} from 'vitest';
import {mkdtemp,readFile,readdir,rm,open,chmod} from 'node:fs/promises';
import {createCipheriv,randomBytes} from 'node:crypto';
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
 const root=await mkdtemp(join(tmpdir(),'career-g6-secret-durability-'));let writing='';
 try{const vault=createSecretVault(root,{available:async()=>true,encrypt:async()=>Buffer.from('cipher-only-fixture')},{beforeAtomicWrite:async filename=>{writing=filename;},syncDirectory:async()=>{if(writing.endsWith('binding.json'))throw Object.assign(Error('controlled directory sync failure'),{code:'EIO'});}});
 expect(await vault.request({operation:'save',value:'FAKE_POST_RENAME_SECRET'})).toEqual({kind:'failure',code:'secret_save_failed'});
 const status=await vault.request({operation:'status'});expect(status).toMatchObject({kind:'status',status:{configured:true,enabled:false}});
 const binding=JSON.parse(await readFile(join(root,'binding.json'),'utf8'));expect((await readdir(root)).includes('pending-generation.json')).toBe(true);expect((await readdir(root)).includes(binding.generation+'.encrypted')).toBe(true);
 }finally{await rm(root,{recursive:true,force:true});}
});


it('published credential metadata with persistent compensating write failure stays disabled across vault restart',async()=>{
 const root=await mkdtemp(join(tmpdir(),'career-g6-secret-compound-'));
 const fake='FAKE_G6_COMPOUND_SECRET_NOT_REAL',key=randomBytes(32);
 const storage={available:async()=>true,encrypt:async(value:string)=>{const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);return Buffer.concat([nonce,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]);}};
 let writing='',compensatingFailure=false;
 try{
  const vault=createSecretVault(root,storage,{
   beforeAtomicWrite:async filename=>{writing=filename;if(compensatingFailure&&filename.endsWith('binding.json'))throw Object.assign(Error('persistent metadata EIO before open'),{code:'EIO'});},
   syncDirectory:async()=>{if(writing.endsWith('binding.json')){compensatingFailure=true;throw Object.assign(Error('EIO after actual metadata rename'),{code:'EIO'});}},
  });
  expect(await vault.request({operation:'save',value:fake})).toEqual({kind:'failure',code:'secret_save_failed'});
  const binding=JSON.parse(await readFile(join(root,'binding.json'),'utf8'));
  const ciphertext=await readFile(join(root,binding.generation+'.encrypted'));
  expect(ciphertext.length).toBeGreaterThan(0);expect(ciphertext.includes(Buffer.from(fake))).toBe(false);
  expect(await vault.request({operation:'status'})).toMatchObject({kind:'status',status:{configured:true,enabled:false}});
  const restarted=createSecretVault(root,storage);expect(await restarted.request({operation:'status'})).toMatchObject({kind:'status',status:{configured:true,enabled:false}});
  for(const file of await readdir(root))expect((await readFile(join(root,file))).includes(Buffer.from(fake))).toBe(false);
  expect(await restarted.request({operation:'disable'})).toMatchObject({kind:'status',status:{enabled:false}});
  const next=await restarted.request({operation:'save',value:fake+'-replacement'});expect(next).toMatchObject({kind:'status',status:{configured:true,enabled:true}});
  const replaced=JSON.parse(await readFile(join(root,'binding.json'),'utf8'));expect(replaced.generation).not.toBe(binding.generation);expect(await readdir(root)).not.toContain('pending-generation.json');expect(await readdir(root)).not.toContain(binding.generation+'.encrypted');
  expect(await restarted.request({operation:'delete'})).toEqual({kind:'status',status:{configured:false,enabled:false}});
 }finally{key.fill(0);await rm(root,{recursive:true,force:true});}
});


it('pending-marker unlink failure leaves durable cipher and binding disabled across restart',async()=>{
 const root=await mkdtemp(join(tmpdir(),'career-g6-secret-marker-'));let writing='';
 const storage={available:async()=>true,encrypt:async()=>Buffer.from('complete-cipher-fixture')};
 try{
  const vault=createSecretVault(root,storage,{
   beforeAtomicWrite:async filename=>{writing=filename;},
   syncDirectory:async()=>{const directory=await open(root,'r');try{await directory.sync();}finally{await directory.close();}if(writing.endsWith('binding.json'))await chmod(root,0o500);},
  });
  expect(await vault.request({operation:'save',value:'FAKE_MARKER_UNLINK_SECRET'})).toEqual({kind:'failure',code:'secret_save_failed'});
  expect(await vault.request({operation:'status'})).toMatchObject({kind:'status',status:{configured:true,enabled:false}});
  const binding=JSON.parse(await readFile(join(root,'binding.json'),'utf8'));expect(await readFile(join(root,binding.generation+'.encrypted'),'utf8')).toBe('complete-cipher-fixture');
  expect(await readdir(root)).toContain('pending-generation.json');
  expect(await createSecretVault(root,storage).request({operation:'status'})).toMatchObject({kind:'status',status:{configured:true,enabled:false}});
 }finally{await chmod(root,0o700);await rm(root,{recursive:true,force:true});}
});

it('successful pending-marker unlink followed by directory-sync failure never removes a committed cipher',async()=>{
 const root=await mkdtemp(join(tmpdir(),'career-g6-secret-postcommit-'));let writing='';
 const storage={available:async()=>true,encrypt:async()=>Buffer.from('complete-postcommit-cipher-fixture')};
 try{
  const vault=createSecretVault(root,storage,{
   beforeAtomicWrite:async filename=>{writing=filename;},
   syncDirectory:async()=>{if(writing.endsWith('binding.json')&&!((await readdir(root)).includes('pending-generation.json')))throw Object.assign(Error('EIO after actual pending-marker unlink'),{code:'EIO'});const directory=await open(root,'r');try{await directory.sync();}finally{await directory.close();}},
  });
  expect(await vault.request({operation:'save',value:'FAKE_POSTCOMMIT_SECRET'})).toMatchObject({kind:'status',status:{configured:true,enabled:true}});
  const binding=JSON.parse(await readFile(join(root,'binding.json'),'utf8'));expect(await readFile(join(root,binding.generation+'.encrypted'),'utf8')).toBe('complete-postcommit-cipher-fixture');
  expect(await readdir(root)).not.toContain('pending-generation.json');expect(await createSecretVault(root,storage).request({operation:'status'})).toMatchObject({kind:'status',status:{configured:true,enabled:true}});
 }finally{await rm(root,{recursive:true,force:true});}
});

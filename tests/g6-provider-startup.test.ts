import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,readdir,chmod,rm,symlink,open} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createCipheriv,randomBytes} from 'node:crypto';
import {resolveStartupProviderBinding} from '../apps/desktop/capabilities/provider-startup';
import {createSecretVault} from '../apps/desktop/capabilities/secret-vault';

it('a first interrupted encrypted save without binding stays disabled when Main resolves a new runtime',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g6-startup-binding-')),directory=path.join(root,'security');
 const encrypt=async(value:string)=>{const key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(value),cipher.final(),cipher.getAuthTag()]);};
 try{const vault=createSecretVault(directory,{available:async()=>true,encrypt},{syncDirectory:async()=>{const handle=await open(directory,'r');try{await handle.sync();}finally{await handle.close();}},beforeAtomicWrite:async filename=>{if(filename===path.join(directory,'binding.json'))throw Object.assign(Error('controlled storage failure'),{code:'EIO'});}});
 expect(await vault.request({operation:'save',value:'G6_SYNTHETIC_STARTUP_VALUE'})).toEqual({kind:'failure',code:'secret_save_failed'});
 await expect(readFile(path.join(directory,'binding.json'))).rejects.toMatchObject({code:'ENOENT'});expect(await readdir(directory)).toContain('pending-generation.json');
 const reopened=createSecretVault(directory,{available:async()=>true,encrypt});expect(await reopened.request({operation:'status'})).toMatchObject({kind:'status',status:{configured:false,enabled:false}});
 expect(await resolveStartupProviderBinding(directory,()=>reopened.request({operation:'status'}))).toEqual({enabled:false,generation:'fake-v1'});
 }finally{await rm(root,{recursive:true,force:true});}
});
it('an inaccessible security directory is never treated as an unconfigured profile',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g6-startup-inaccessible-')),directory=path.join(root,'security');await mkdir(directory);await writeFile(path.join(directory,'binding.json'),JSON.stringify({generation:randomUUID(),enabled:true}));
 try{await chmod(directory,0);await expect(readdir(directory)).rejects.toMatchObject({code:'EACCES'});expect(await resolveStartupProviderBinding(directory,async()=>({kind:'failure',code:'secret_save_failed'}))).toEqual({enabled:false,generation:'fake-v1'});}finally{await chmod(directory,0o700);await rm(root,{recursive:true,force:true});}
});
it('a genuinely fresh or empty security directory retains the controlled fake baseline',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g6-startup-fresh-')),directory=path.join(root,'security');try{const status=async()=>{throw Error('must not read a nonexistent configuration');};expect(await resolveStartupProviderBinding(directory,status)).toEqual({enabled:true,generation:'fake-v1'});await mkdir(directory);expect(await resolveStartupProviderBinding(directory,status)).toEqual({enabled:true,generation:'fake-v1'});}finally{await rm(root,{recursive:true,force:true});}
});
it.each(['pending-generation.json',randomUUID()+'.encrypted','unexpected-state.json'])('security evidence %s without a valid binding remains disabled',async name=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g6-startup-residue-')),directory=path.join(root,'security');try{await mkdir(directory);await writeFile(path.join(directory,name),'isolated residue');const vault=createSecretVault(directory,{available:async()=>false,encrypt:async()=>{throw Error('not a save');}});expect(await resolveStartupProviderBinding(directory,()=>vault.request({operation:'status'}))).toEqual({enabled:false,generation:'fake-v1'});}finally{await rm(root,{recursive:true,force:true});}
});
it('valid enabled generation, explicit disable and delete keep their persisted meanings',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g6-startup-states-')),directory=path.join(root,'security');let available=true;
 const vault=createSecretVault(directory,{available:async()=>available,encrypt:async value=>{const cipher=createCipheriv('aes-256-gcm',randomBytes(32),randomBytes(12));return Buffer.concat([cipher.update(value),cipher.final(),cipher.getAuthTag()]);}});
 try{const saved=await vault.request({operation:'save',value:'G6_SYNTHETIC_CONFIGURED'});if(saved.kind!=='status'||!saved.status.generation)throw Error('fixture save');const generation=saved.status.generation,status=()=>vault.request({operation:'status'});
 expect(await resolveStartupProviderBinding(directory,status)).toEqual({enabled:true,generation});
 // Frozen AI-14 allows the original still-permitted generation after an uncommitted replacement failure.
 available=false;expect(await vault.request({operation:'save',value:'G6_SYNTHETIC_UNAVAILABLE_REPLACEMENT'})).toEqual({kind:'failure',code:'secure_storage_unavailable'});expect(await resolveStartupProviderBinding(directory,status)).toEqual({enabled:true,generation});
 await vault.request({operation:'disable'});expect(await resolveStartupProviderBinding(directory,status)).toEqual({enabled:false,generation});await vault.request({operation:'delete'});expect(await resolveStartupProviderBinding(directory,status)).toEqual({enabled:false,generation:'fake-v1'});
 }finally{await rm(root,{recursive:true,force:true});}
});
it('malformed binding or a status read rejection does not fall back to fake enabled',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g6-startup-error-')),directory=path.join(root,'security');try{await mkdir(directory);await writeFile(path.join(directory,'binding.json'),'malformed JSON');const vault=createSecretVault(directory,{available:async()=>false,encrypt:async()=>{throw Error('not a save');}});expect(await resolveStartupProviderBinding(directory,()=>vault.request({operation:'status'}))).toEqual({enabled:false,generation:'fake-v1'});expect(await resolveStartupProviderBinding(directory,async()=>{throw Error('private storage failure');})).toEqual({enabled:false,generation:'fake-v1'});}finally{await rm(root,{recursive:true,force:true});}
});
it('a security directory symlink or binding symlink is rejected without reading outside the profile',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g6-startup-symlink-')),directory=path.join(root,'security'),outside=path.join(root,'synthetic-outside');try{await mkdir(outside);await symlink(outside,directory);const status=async()=>{throw Error('must not read linked state');};expect(await resolveStartupProviderBinding(directory,status)).toEqual({enabled:false,generation:'fake-v1'});await rm(directory);await mkdir(directory);await writeFile(path.join(outside,'binding.json'),JSON.stringify({generation:randomUUID(),enabled:true}));await symlink(path.join(outside,'binding.json'),path.join(directory,'binding.json'));expect(await resolveStartupProviderBinding(directory,status)).toEqual({enabled:false,generation:'fake-v1'});}finally{await rm(root,{recursive:true,force:true});}
});

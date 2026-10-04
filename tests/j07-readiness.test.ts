import {it,expect} from 'vitest';import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {createSecretVault} from '../apps/desktop/capabilities/secret-vault';
it('saved but unreadable Tavily credentials are never advertised as currently available',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-readiness-'));let decryptFails=false;
 const vault=createSecretVault(root,{available:async()=>true,encrypt:async()=>Buffer.from('SYNTHETIC CIPHERTEXT'),decrypt:async()=>{if(decryptFails)throw Error('SYNTHETIC_OS_FAILURE');return 'SYNTHETIC_KEY';}},undefined,'tavily');
 try{const saved=await vault.request({operation:'save',value:'SYNTHETIC_KEY'});expect(saved).toMatchObject({kind:'status',status:{configured:true,enabled:true}});if(saved.kind!=='status')throw Error('save');decryptFails=true;await expect(vault.readCredential(saved.status.generation!)).rejects.toThrow('credential_unavailable');expect(await vault.request({operation:'status'})).toMatchObject({kind:'status',status:{configured:true,readiness:'unavailable',readinessReason:'decrypt_failed'}});
 }finally{await rm(root,{recursive:true,force:true});}
});
it('status never decrypts, explicit checks discard credentials, and changed or disabled generations are not reused',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-readiness-protocol-'));let decrypts=0,available=true;
 const storage={available:async()=>available,encrypt:async()=>Buffer.from('SYNTHETIC CIPHERTEXT'),decrypt:async()=>{decrypts++;return 'SYNTHETIC_LOCAL_KEY';}};
 const vault=createSecretVault(root,storage,undefined,'tavily');
 try{const saved=await vault.request({operation:'save',value:'SYNTHETIC_LOCAL_KEY'});expect(saved).toMatchObject({kind:'status',status:{readiness:'unchecked'}});await vault.request({operation:'status'});expect(decrypts).toBe(0);const checked=await vault.request({operation:'check'});expect(checked).toMatchObject({kind:'status',status:{readiness:'available'}});expect(JSON.stringify(checked)).not.toContain('SYNTHETIC_LOCAL_KEY');expect(decrypts).toBe(1);await vault.request({operation:'status'});expect(decrypts).toBe(1);
 await vault.request({operation:'disable'});await vault.request({operation:'check'});expect(decrypts).toBe(1);await vault.request({operation:'save',value:'SYNTHETIC_REPLACEMENT'});expect(await vault.request({operation:'status'})).toMatchObject({kind:'status',status:{readiness:'unchecked'}});available=false;expect(await vault.request({operation:'check'})).toMatchObject({kind:'status',status:{readiness:'unavailable',readinessReason:'storage_unavailable'}});expect(decrypts).toBe(1);
 expect(await vault.request({operation:'read'} as never)).toMatchObject({kind:'failure',code:'invalid_request'});
 }finally{await rm(root,{recursive:true,force:true});}
});
it('local readiness identifies invalid header characters without returning them or claiming a crypto failure',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-readiness-header-'));const vault=createSecretVault(root,{available:async()=>true,encrypt:async()=>Buffer.from('SYNTHETIC CIPHERTEXT'),decrypt:async()=> 'SYNTHETIC\nKEY'},undefined,'tavily');
 try{await vault.request({operation:'save',value:'SYNTHETIC\nKEY'});const result=await vault.request({operation:'check'});expect(result).toMatchObject({kind:'status',status:{configured:true,readiness:'unavailable',readinessReason:'invalid_credential'}});expect(JSON.stringify(result)).not.toContain('SYNTHETIC');}finally{await rm(root,{recursive:true,force:true});}
});
it.each(['SYNTHETIC\u200BKEY','SYNTHETIC\u0000KEY'])('local readiness rejects an invalid Authorization Header value without exposing it',async value=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-readiness-header-native-'));const vault=createSecretVault(root,{available:async()=>true,encrypt:async()=>Buffer.from('SYNTHETIC CIPHERTEXT'),decrypt:async()=>value},undefined,'tavily');
 try{await vault.request({operation:'save',value});expect(await vault.request({operation:'check'})).toMatchObject({kind:'status',status:{readiness:'unavailable',readinessReason:'invalid_credential'}});}finally{await rm(root,{recursive:true,force:true});}
});

import {it,expect} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {createSecretVault} from '../apps/desktop/capabilities/secret-vault';
import {resolveStartupProviderBinding} from '../apps/desktop/capabilities/provider-startup';
it('only the enabled DeepSeek credential generation can be read by the private dispatch capability; business-facing status never exposes it',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-j07-vault-')),key=randomBytes(32),synthetic='J07_SYNTHETIC_TEST_NOT_AN_API_KEY';
 const vault=createSecretVault(root,{available:async()=>true,encrypt:async value=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]);},decrypt:async value=>{const decipher=createDecipheriv('aes-256-gcm',key,value.subarray(0,12));decipher.setAuthTag(value.subarray(-16));return Buffer.concat([decipher.update(value.subarray(12,-16)),decipher.final()]).toString('utf8');}});
 try{const saved=await vault.request({operation:'save',value:synthetic,provider:'deepseek-v4.1-flash'});if(saved.kind!=='status'||!saved.status.generation)throw Error('save');const generation=saved.status.generation;
 expect(JSON.stringify(saved)).not.toContain(synthetic);expect(await readFile(path.join(root,generation+'.encrypted'))).not.toContain(Buffer.from(synthetic));
 expect(await resolveStartupProviderBinding(root,()=>vault.request({operation:'status'}))).toEqual({enabled:true,generation,provider:'deepseek-v4.1-flash'});
 expect(await vault.readCredential(generation)).toBe(synthetic);await expect(vault.readCredential('../binding.json')).rejects.toThrow('credential_unavailable');
 await vault.request({operation:'disable'});await expect(vault.readCredential(generation)).rejects.toThrow('credential_unavailable');
 const replaced=await vault.request({operation:'save',value:'J07_SYNTHETIC_REPLACEMENT',provider:'deepseek-v4.1-flash'});expect(replaced.kind).toBe('status');await expect(vault.readCredential(generation)).rejects.toThrow('credential_unavailable');
 await vault.request({operation:'delete'});expect(await vault.request({operation:'status'})).toEqual({kind:'status',status:{configured:false,enabled:false}});
 }finally{key.fill(0);await rm(root,{recursive:true,force:true});}
});

import {it,expect} from 'vitest';import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';
import {createNativeKeychainStorage} from '../../apps/desktop/capabilities/native-keychain';import {createSecretVault} from '../../apps/desktop/capabilities/secret-vault';
it('native TEST credential survives helper restart while public UI can never read it',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'career-E1-TEST-secret-')),directory=path.join(profile,'security-native-v1');const input='E1_SYNTHETIC_TEST_NOT_A_PROVIDER_KEY';let storage=createNativeKeychainStorage({profile,slot:'deepseek',helper:path.resolve('dist/application/career-keychain')});
 try{let vault=createSecretVault(directory,storage);expect(await vault.request({operation:'save',value:input,provider:'deepseek-v4.1-flash'})).toMatchObject({kind:'status',status:{configured:true,enabled:true}});
  expect(await vault.request({operation:'check'})).toMatchObject({kind:'status',status:{readiness:'available'}});expect(await vault.request({operation:'read'} as never)).toEqual({kind:'failure',code:'invalid_request'});
  const status:any=await vault.request({operation:'status'});expect(JSON.stringify(status)).not.toContain(input);for(const file of await readdir(directory))expect((await readFile(path.join(directory,file))).includes(Buffer.from(input))).toBe(false);
  storage.close();storage=createNativeKeychainStorage({profile,slot:'deepseek',helper:path.resolve('dist/application/career-keychain')});vault=createSecretVault(directory,storage);expect(await vault.readCredential(status.status.generation)).toBe(input);
  expect(await vault.request({operation:'delete'})).toMatchObject({kind:'status',status:{configured:false,enabled:false}});await expect(vault.readCredential(status.status.generation)).rejects.toThrow();
 }finally{await storage.deleteTestRoot();storage.close();await rm(profile,{recursive:true,force:true});}
},60000);

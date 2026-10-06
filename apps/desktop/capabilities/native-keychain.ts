import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createHash} from 'node:crypto';
import {credentialAuthorizationSafetyMs} from '../../../packages/contracts/ai/secret-input';
type Options={helper:string;profile:string;slot:'deepseek'|'tavily'};
/** Fixed helper and Career slots. Neither a system path nor a Keychain query comes from the browser. */
export function createNativeKeychainStorage(options:Options){
 const namespace=createHash('sha256').update(options.profile).digest('hex');
 const children=new Set<ChildProcessWithoutNullStreams>();let closed=false;
 function request(action:'available'|'encrypt'|'decrypt'|'delete-test-root',value?:string):Promise<{value?:string;available?:boolean}>{
  if(closed)return Promise.reject(Error('credential_cancelled'));
  return new Promise((resolve,reject)=>{
   const child=spawn(options.helper,[],{stdio:['pipe','pipe','pipe'],env:{PATH:'/usr/bin:/bin'}});children.add(child);
   let output=Buffer.alloc(0),failed=false;
   const timeout=setTimeout(()=>{failed=true;child.kill('SIGTERM');reject(Error('credential_timeout'));},credentialAuthorizationSafetyMs);
   child.stderr.resume(); // Native diagnostics and payloads never reach application logs.
   child.stdout.on('data',(bytes:Buffer)=>{if(output.length+bytes.length>128*1024){failed=true;child.kill();reject(Error('credential_unavailable'));}else output=Buffer.concat([output,bytes]);});
   child.once('error',()=>{failed=true;reject(Error('credential_unavailable'));});
   child.once('close',code=>{clearTimeout(timeout);children.delete(child);if(failed){output.fill(0);return;}try{const result=JSON.parse(output.toString());if(code!==0||result.error){const status=result.osStatus;const reason=status===-128?'credential_cancelled':status===-25293?'credential_denied':'credential_unavailable';throw Error(reason);}resolve(result);}catch(error){reject(error instanceof Error&&['credential_cancelled','credential_denied'].includes(error.message)?error:Error('credential_unavailable'));}finally{output.fill(0);}});
   child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({action,namespace,slot:options.slot,...value===undefined?{}:{value}}));
  });
 }
 return {available:async()=>{try{return (await request('available')).available===true;}catch{return false;}},encrypt:async(value:string)=>{const result=await request('encrypt',value);if(typeof result.value!=='string')throw Error('credential_unavailable');return Buffer.from(result.value,'base64');},decrypt:async(input:Buffer)=>{const result=await request('decrypt',input.toString('base64'));if(typeof result.value!=='string')throw Error('credential_unavailable');return result.value;},
  // Only tests whose profile is an isolated fixture can remove their wrapping key; not an HTTP operation.
  async deleteTestRoot(){if(!options.profile.includes('TEST'))throw Error('invalid_capability');await request('delete-test-root');},
  close(){closed=true;for(const child of children)child.kill('SIGTERM');},
 };
}

import {mkdir,open,readFile,rename,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';import {constants} from 'node:fs';import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {SecretInput,SecretResult,type SecretBridge,CredentialFailure,credentialAuthorizationSafetyMs} from '../../../packages/contracts/ai/secret-input';
const State=z.strictObject({generation:z.uuid().optional(),enabled:z.boolean(),provider:z.literal('deepseek-v4.1-flash').optional()});
type Storage={available():Promise<boolean>;encrypt(value:string):Promise<Buffer>;decrypt?(value:Buffer):Promise<string>};
/** Main-owned credential state, independent of business backups and their old activation data. */
export function createSecretVault(directory:string,storage:Storage,durability?:{syncDirectory():Promise<void>;beforeAtomicWrite?(filename:string):Promise<void>},dispatchUse:'deepseek-v4.1-flash'|'tavily'='deepseek-v4.1-flash') :SecretBridge & {readCredential(generation:string):Promise<string>}{
 let queue=Promise.resolve();
 type ReadinessReason=NonNullable<z.infer<typeof import('../../../packages/contracts/ai/secret-input').SecretStatus>['readinessReason']>;
 let readiness:{generation:string;available:boolean;reason?:ReadinessReason}|undefined;
 let authorization:{generation:string;state:'waiting_for_system_authorization'|'ready'|'cancelled'|'denied'|'timeout'|'unavailable'}|undefined;
 let activeRead:{generation:string;promise:Promise<string>;settled:boolean;fail(reason:CredentialFailure):void}|undefined;
 function unavailable(generation:string,reason:ReadinessReason):never{if(!activeRead?.settled)readiness={generation,available:false,reason};throw Error('credential_unavailable');}
 // Native status codes are optional. Electron 44 often returns only a generic failure;
 // do not infer a user's choice from timing, a process name or an error message.
 function nativeFailure(error:unknown):CredentialFailure{
  const parsed=CredentialFailure.safeParse(error instanceof Error?error.message:undefined);if(parsed.success)return parsed.data;
  const code=(error as {code?:unknown;osStatus?:unknown}|undefined)?.osStatus??(error as {code?:unknown}|undefined)?.code;
  return code===-128||code==='errSecUserCanceled'?'credential_cancelled':code===-25293||code==='errSecAuthFailed'?'credential_denied':'credential_unavailable';
 }
 async function publicStatus(current:z.infer<typeof State>){
  const checked=readiness?.generation===current.generation?readiness:undefined;
  return {configured:!!current.generation,enabled:current.enabled,...current.provider?{provider:current.provider}:{},...current.generation?{generation:current.generation,...storage.decrypt?{...authorization?.generation===current.generation?{authorization:authorization.state}:{authorization:'idle' as const},readiness:checked?(checked.available?'available' as const:'unavailable' as const):'unchecked' as const,...checked?.reason?{readinessReason:checked.reason}:{}}:{}}:{}};
 }
 const metadata=path.join(directory,'binding.json'),pendingConfiguration=path.join(directory,'pending-generation.json');
 async function syncDirectory(){if(durability)await durability.syncDirectory();else{const dir=await open(directory,'r');try{await dir.sync();}finally{await dir.close();}}}
 async function atomic(filename:string,bytes:Uint8Array){
  await durability?.beforeAtomicWrite?.(filename);
  const temporary=filename+'.'+randomUUID()+'.tmp';let published=false;
  try{const file=await open(temporary,'wx',0o600);try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
   await rename(temporary,filename);published=true;await syncDirectory();
  }finally{if(!published)await unlink(temporary).catch(()=>{});}
 }
 async function state(){let value:z.infer<typeof State>;try{value=State.parse(JSON.parse(await readFile(metadata,'utf8')));}catch(error){if((error as {code?:string}).code==='ENOENT')value={enabled:false};else throw Error('secret_save_failed');}
  // An incomplete configuration survives restart independently of its binding write.
  try{await readFile(pendingConfiguration);return {...value,enabled:false};}catch(error){if((error as {code?:string}).code!=='ENOENT')throw Error('secret_save_failed');}return value;}
 async function writeState(value:z.infer<typeof State>){await atomic(metadata,Buffer.from(JSON.stringify(value)));}
 async function run(input:unknown):Promise<z.infer<typeof SecretResult>>{
  const parsed=SecretInput.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};
  try{
   await mkdir(directory,{recursive:true,mode:0o700});const previous=await state();
   if(parsed.data.operation==='save'){
    if(!await storage.available())return {kind:'failure',code:'secure_storage_unavailable'};
    const generation=randomUUID(),filename=path.join(directory,generation+'.encrypted');
    // No Key enters the marker. It must be durable before a cipher or binding can change.
    await atomic(pendingConfiguration,Buffer.from(JSON.stringify({generation})));
    const encrypted=await storage.encrypt(parsed.data.value);
    try{
     if(!encrypted.length)throw Error('secret_save_failed');
     await atomic(filename,encrypted);await writeState({generation,enabled:true,...parsed.data.provider?{provider:parsed.data.provider}:{}});
     await unlink(pendingConfiguration);
     // Cipher and binding are already durable. A failed post-commit cleanup sync may
     // leave the marker after a power loss (conservative disable), never invalidate the cipher.
     await syncDirectory().catch(()=>{});
    }finally{encrypted.fill(0);}
    if(previous.generation)await unlink(path.join(directory,previous.generation+'.encrypted')).catch(()=>{});
   }else if(parsed.data.operation==='disable')await writeState({...previous,enabled:false});
   else if(parsed.data.operation==='delete'){
    // Revoke first. A failed unlink can never make the prior generation active again.
    await writeState({enabled:false});for(const name of await readdir(directory))if(/^[0-9a-f-]{36}\.encrypted$/.test(name))await unlink(path.join(directory,name));
   }
   const current=await state();return {kind:'status',status:await publicStatus(current)};
  }catch{return {kind:'failure',code:'secret_save_failed'};}
 }
 function assertWaiting(){if(activeRead?.settled)throw Error(authorization?.state==='timeout'?'credential_timeout':'credential_cancelled');}
 async function readCredential(generation:string){
  assertWaiting();
  if(!z.uuid().safeParse(generation).success)throw Error('credential_unavailable');
  if(!storage.decrypt)return unavailable(generation,'storage_unavailable');
  let before:z.infer<typeof State>;
  try{before=await state();}catch{return unavailable(generation,'record_unavailable');}
  if(!before.enabled||before.generation!==generation)return unavailable(generation,'generation_changed');
  if(dispatchUse==='tavily'?before.provider!==undefined:before.provider!=='deepseek-v4.1-flash')return unavailable(generation,'provider_mismatch');
  try{if(!await storage.available())return unavailable(generation,'storage_unavailable');}catch(error){const reason=nativeFailure(error);if(reason!=='credential_unavailable')throw Error(reason);return unavailable(generation,'storage_unavailable');}
  assertWaiting();
  let file:Awaited<ReturnType<typeof open>>|undefined,cipher:Buffer|undefined,value:string|undefined;
  try{
   try{file=await open(path.join(directory,generation+'.encrypted'),constants.O_RDONLY|constants.O_NOFOLLOW);const info=await file.stat();if(!info.isFile()||info.size<1||info.size>65536)throw Error();cipher=await file.readFile();}catch{return unavailable(generation,'record_unavailable');}
   assertWaiting();
   try{value=await storage.decrypt(cipher);}catch(error){const reason=nativeFailure(error);if(reason!=='credential_unavailable')throw Error(reason);return unavailable(generation,'decrypt_failed');}
   assertWaiting();
   // Reject unusable HTTP-header values here so local readiness tests the dispatch contract too.
   if(typeof value!=='string'||!value||value.length>4096||/[\r\n]/.test(value))return unavailable(generation,'invalid_credential');
   try{new Headers({Authorization:'Bearer '+value});}catch{return unavailable(generation,'invalid_credential');}
   let current:z.infer<typeof State>;try{current=await state();}catch{return unavailable(generation,'record_unavailable');}
   if(!current.enabled||current.generation!==generation||current.provider!==before.provider)return unavailable(generation,'generation_changed');
   return value;
  }finally{value=undefined;cipher?.fill(0);await file?.close();}
 }

 function protectedRead(generation:string):Promise<string>{
  // Coalesce a pending read. A cancelled/timed-out native call remains latched until
  // it actually finishes, so another caller cannot create a second system prompt.
  if(activeRead)return activeRead.generation===generation?activeRead.promise:Promise.reject(Error('credential_unavailable'));
  let resolve!:(value:string)=>void,reject!:(error:Error)=>void;
  const promise=new Promise<string>((done,fail)=>{resolve=done;reject=fail;});
  const item={generation,promise,settled:false,fail(reason:CredentialFailure){if(item.settled)return;item.settled=true;clearTimeout(timer);authorization={generation,state:reason==='credential_cancelled'?'cancelled':reason==='credential_denied'?'denied':reason==='credential_timeout'?'timeout':'unavailable'};if(reason!=='credential_unavailable')readiness={generation,available:false,reason};else if(readiness?.generation!==generation||readiness.available)readiness={generation,available:false,reason:'decrypt_failed'};reject(Error(reason));}};
  activeRead=item;authorization={generation,state:'waiting_for_system_authorization'};
  const timer=setTimeout(()=>item.fail('credential_timeout'),credentialAuthorizationSafetyMs);
  const native=queue.then(()=>readCredential(generation));
  queue=native.then(value=>{if(!item.settled){item.settled=true;clearTimeout(timer);readiness={generation,available:true};authorization={generation,state:'ready'};resolve(value);}value='';},error=>item.fail(nativeFailure(error))).finally(()=>{if(activeRead===item)activeRead=undefined;});
  return promise;
 }
 return {readCredential:protectedRead,request(input){
  const parsed=SecretInput.safeParse(input);if(!parsed.success)return Promise.resolve({kind:'failure' as const,code:'invalid_request' as const});
  // Read-only status and cancellation must never queue behind an OS authorization.
  if(parsed.data.operation==='status')return run(parsed.data);
  if(parsed.data.operation==='cancel'){activeRead?.fail('credential_cancelled');return run({operation:'status'});}
  if(parsed.data.operation==='check')return (async()=>{const previous=await state();if(previous.generation&&previous.enabled){let value:string|undefined;try{value=await protectedRead(previous.generation);}catch{/* sanitized state only */}finally{value=undefined;}}return run({operation:'status'});})();
  const job=queue.then(()=>run(parsed.data));queue=job.then(()=>{},()=>{});return job;
 }};
}

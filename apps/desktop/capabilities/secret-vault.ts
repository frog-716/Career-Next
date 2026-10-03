import {mkdir,open,readFile,rename,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {SecretInput,SecretResult,type SecretBridge} from '../../../packages/contracts/ai/secret-input';
const State=z.strictObject({generation:z.uuid().optional(),enabled:z.boolean()});
type Storage={available():Promise<boolean>;encrypt(value:string):Promise<Buffer>};
/** Main-owned credential state, independent of business backups and their old activation data. */
export function createSecretVault(directory:string,storage:Storage,durability?:{syncDirectory():Promise<void>}):SecretBridge{
 let queue=Promise.resolve();
 const metadata=path.join(directory,'binding.json');
 async function atomic(filename:string,bytes:Uint8Array){
  const temporary=filename+'.'+randomUUID()+'.tmp';let published=false;
  try{const file=await open(temporary,'wx',0o600);try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
   await rename(temporary,filename);published=true;if(durability)await durability.syncDirectory();else{const dir=await open(directory,'r');try{await dir.sync();}finally{await dir.close();}}
  }finally{if(!published)await unlink(temporary).catch(()=>{});}
 }
 async function state(){try{return State.parse(JSON.parse(await readFile(metadata,'utf8')));}catch(error){if((error as {code?:string}).code==='ENOENT')return {enabled:false};throw Error('secret_save_failed');}}
 async function writeState(value:z.infer<typeof State>){await atomic(metadata,Buffer.from(JSON.stringify(value)));}
 async function run(input:unknown):Promise<z.infer<typeof SecretResult>>{
  const parsed=SecretInput.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};
  try{
   await mkdir(directory,{recursive:true,mode:0o700});const previous=await state();
   if(parsed.data.operation==='save'){
    if(!await storage.available())return {kind:'failure',code:'secure_storage_unavailable'};
    const generation=randomUUID(),filename=path.join(directory,generation+'.encrypted');
    const encrypted=await storage.encrypt(parsed.data.value);
    if(!encrypted.length)throw Error('secret_save_failed');
    try{await atomic(filename,encrypted);await writeState({generation,enabled:true});}
    catch{const current=await state().catch(()=>undefined);if(current?.generation===generation){
      // Rename may already have committed metadata. Keep its cipher and fail closed; never dangle or fall back.
      await writeState({generation,enabled:false}).catch(()=>{});
     }else await unlink(filename).catch(()=>{});throw Error('secret_save_failed');}
    finally{encrypted.fill(0);}
    if(previous.generation)await unlink(path.join(directory,previous.generation+'.encrypted')).catch(()=>{});
   }else if(parsed.data.operation==='disable')await writeState({...previous,enabled:false});
   else if(parsed.data.operation==='delete'){
    // Revoke first. A failed unlink can never make the prior generation active again.
    await writeState({enabled:false});for(const name of await readdir(directory))if(/^[0-9a-f-]{36}\.encrypted$/.test(name))await unlink(path.join(directory,name));
   }
   const current=await state();return {kind:'status',status:{configured:!!current.generation,enabled:current.enabled,...current.generation?{generation:current.generation}:{}}};
  }catch{return {kind:'failure',code:'secret_save_failed'};}
 }
 return {request(input){const job=queue.then(()=>run(input));queue=job.then(()=>{},()=>{});return job;}};
}

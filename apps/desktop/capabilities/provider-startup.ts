import {lstat,readdir} from 'node:fs/promises';
import {SecretResult,type SecretBridge} from '../../../packages/contracts/ai/secret-input';
import type {ProviderBinding} from '../../../packages/backend/platform/providers/binding';

/** Main-only startup configuration; no credential bytes enter the runtime. */
export async function resolveStartupProviderBinding(directory:string,status:()=>ReturnType<SecretBridge['request']>):Promise<ProviderBinding>{
 const disabled:ProviderBinding={enabled:false,generation:'fake-v1'};
 try{
  const folder=await lstat(directory).catch(error=>{if(error.code==='ENOENT')return undefined;throw error;});
  if(!folder)return {enabled:true,generation:'fake-v1'};
  if(!folder.isDirectory()||folder.isSymbolicLink())return disabled;
  const entries=await readdir(directory,{withFileTypes:true});
  // UI status may have created an empty directory; it contains no persisted security state.
  if(!entries.length)return {enabled:true,generation:'fake-v1'};
  if(entries.some(entry=>entry.isSymbolicLink()))return disabled;
  const parsed=SecretResult.safeParse(await status());if(!parsed.success||parsed.data.kind!=='status')return disabled;
  const current=parsed.data.status,generation=current.generation??'fake-v1';
  const file=(name:string)=>entries.some(entry=>entry.name===name&&entry.isFile());
  return {generation,...current.provider?{provider:current.provider}:{},enabled:current.enabled&&current.configured&&!!current.generation&&file('binding.json')&&file(current.generation+'.encrypted')&&!entries.some(entry=>entry.name==='pending-generation.json')};
 }catch{return disabled;}
}

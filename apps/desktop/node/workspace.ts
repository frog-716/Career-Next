import path from 'node:path';import {readFile,lstat,rm} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {z} from 'zod';import {activeWorkspace} from '../capabilities/active-workspace';import {durableJson,safeManagedPath} from '../../../packages/backend/platform/backup/managed-copies';
const Journal=z.strictObject({version:z.literal(1),relativePath:z.literal('workspaces/local'),creationId:z.uuid()});
/** A pending first-install journal is explicit authority, never a search for a recent database. */
export async function nodeActiveWorkspace(profile:string){
 const filename=path.join(profile,'node-bootstrap-pending.json');
 try{const active=await activeWorkspace(profile);if(active.initial&&!active.expected)durableJson(filename,{version:1,relativePath:'workspaces/local',creationId:randomUUID()});return active;}
 catch(error){if(!(error instanceof Error)||error.message!=='active_pointer_invalid')throw error;
  const pointer=await lstat(path.join(profile,'active-workspace-pointer.json')).catch(error=>{if(error.code==='ENOENT')return;throw error;});if(pointer)throw Error('active_pointer_invalid');
  try{const info=await lstat(filename);if(!info.isFile()||info.isSymbolicLink())throw Error();const journal=Journal.parse(JSON.parse(await readFile(filename,'utf8')));return {root:safeManagedPath(profile,journal.relativePath),initial:true};}catch{throw Error('active_pointer_invalid');}
 }
}
export async function finishNodeBootstrap(profile:string){await rm(path.join(profile,'node-bootstrap-pending.json'),{force:true});}

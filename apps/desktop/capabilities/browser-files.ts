import {mkdir,writeFile,rm,lstat,readdir} from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';
import type {BrowserUpload} from '../browser/server';
/** Browser supplies bytes and a basename, never an OS path. Temporary input is outside backup/workspace. */
export async function withBrowserFile<T>(profile:string,input:BrowserUpload,extensions:readonly string[],maximumBytes:number,work:(filename:string)=>Promise<T>){
 const name=input.name,extension=path.extname(name).toLowerCase();
 if(!name||name.length>255||/[\\/\x00-\x1f]/.test(name)||!extensions.includes(extension)||input.bytes.length<1||input.bytes.length>maximumBytes)throw Error('invalid_request');
 const directory=path.join(profile,'browser-transfer-staging',randomUUID());await mkdir(directory,{recursive:true,mode:0o700});const filename=path.join(directory,name);
 try{await writeFile(filename,input.bytes,{flag:'wx',mode:0o600});return await work(filename);}finally{await rm(directory,{recursive:true,force:true});}
}
/** Called only after acquiring the unique writer; never clean another active host's uploads. */
export async function cleanAbandonedBrowserFiles(profile:string){
 const directory=path.join(profile,'browser-transfer-staging');const info=await lstat(directory).catch(error=>{if(error.code==='ENOENT')return;throw error;});if(!info)return;if(!info.isDirectory()||info.isSymbolicLink())throw Error('invalid_request');
 for(const entry of await readdir(directory,{withFileTypes:true}))if(/^[a-f0-9-]{36}$/.test(entry.name)&&entry.isDirectory())await rm(path.join(directory,entry.name),{recursive:true,force:true});
}

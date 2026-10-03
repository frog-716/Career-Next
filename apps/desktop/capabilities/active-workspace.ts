import path from 'node:path';
import {readFile,lstat} from 'node:fs/promises';
import {z} from 'zod';
import {safeManagedPath} from '../../../packages/backend/platform/backup/managed-copies';
const Pointer=z.strictObject({copyId:z.uuid(),relativePath:z.string().min(1),workspaceInstance:z.uuid()});
export async function activeWorkspace(dataRoot:string){
 let body:string;
 try{body=await readFile(path.join(dataRoot,'active-workspace-pointer.json'),'utf8');}
 catch(error){if((error as {code?:string}).code==='ENOENT')return {root:path.join(dataRoot,'workspaces/local'),initial:true};throw Error('active_pointer_invalid');}
 try{
  const value=JSON.parse(body);
  const legacy=value.copy==='local'&&typeof value.workspaceInstance==='string'&&Object.keys(value).length===2;
  const pointer=legacy?{relativePath:'workspaces/local',workspaceInstance:value.workspaceInstance}:Pointer.parse(value);
  const root=safeManagedPath(dataRoot,pointer.relativePath);
  // A persisted pointer never authorizes creating an empty replacement for a missing target.
  const directory=await lstat(root),database=await lstat(path.join(root,'career.sqlite'));
  if(!directory.isDirectory()||directory.isSymbolicLink()||!database.isFile()||database.isSymbolicLink())throw Error('active_pointer_invalid');
  return {root,initial:legacy,expected:pointer.workspaceInstance};
 }catch{throw Error('active_pointer_invalid');}
}

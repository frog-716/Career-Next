import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {safeManagedPath} from '../../../packages/backend/platform/backup/managed-copies';
const Pointer=z.strictObject({copyId:z.uuid(),relativePath:z.string().min(1),workspaceInstance:z.uuid()});
export async function activeWorkspace(dataRoot:string){let body:string;try{body=await readFile(path.join(dataRoot,'active-workspace-pointer.json'),'utf8');}catch(error){if((error as {code?:string}).code==='ENOENT')return {root:path.join(dataRoot,'workspaces/local'),initial:true};throw Error('active_pointer_invalid');}try{const value=JSON.parse(body);if(value.copy==='local'&&typeof value.workspaceInstance==='string'&&Object.keys(value).length===2)return {root:safeManagedPath(dataRoot,'workspaces/local'),initial:true,expected:value.workspaceInstance};const pointer=Pointer.parse(value);return {root:safeManagedPath(dataRoot,pointer.relativePath),initial:false,expected:pointer.workspaceInstance};}catch{throw Error('active_pointer_invalid');}}

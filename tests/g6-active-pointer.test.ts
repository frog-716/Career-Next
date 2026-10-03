import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';
import {activeWorkspace} from '../apps/desktop/capabilities/active-workspace';

it('a committed active pointer whose target is missing cannot silently create a new empty workspace',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'career-g6-pointer-'));
 try{
  await writeFile(path.join(root,'active-workspace-pointer.json'),JSON.stringify({copyId:randomUUID(),relativePath:'workspaces/missing',workspaceInstance:randomUUID()}));
  await mkdir(path.join(root,'workspaces','newest'),{recursive:true});
  await writeFile(path.join(root,'workspaces','newest','career.sqlite'),'Never guess this copy');
  await expect(activeWorkspace(root)).rejects.toThrow('active_pointer_invalid');
 }finally{await rm(root,{recursive:true,force:true});}
});

it('corrupt pointer and pointer traversal fail closed even when another newer workspace exists',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'career-g6-pointer-'));
 try{for(const value of ['{corrupt',JSON.stringify({copyId:randomUUID(),relativePath:'../other',workspaceInstance:randomUUID()})]){
  await writeFile(path.join(root,'active-workspace-pointer.json'),value);await expect(activeWorkspace(root)).rejects.toThrow('active_pointer_invalid');
 }}finally{await rm(root,{recursive:true,force:true});}
});

it('readonly preflight rejects wrong identity before migrations and leaves database bytes unchanged',async()=>{
 const {checkActiveIdentity}=await import('../packages/backend/platform/database/active-check');const {default:Database}=await import('better-sqlite3');const {readFile}=await import('node:fs/promises');const root=await mkdtemp(path.join(os.tmpdir(),'career-g6-identity-'));
 try{const filename=path.join(root,'career.sqlite'),db=new Database(filename),instance=randomUUID();db.exec('CREATE TABLE platform_workspace(instance TEXT PRIMARY KEY)');db.prepare('INSERT INTO platform_workspace VALUES(?)').run(instance);db.close();const before=await readFile(filename);expect(()=>checkActiveIdentity(root,randomUUID())).toThrow('active_pointer_invalid');expect(await readFile(filename)).toEqual(before);expect(()=>checkActiveIdentity(root,instance)).not.toThrow();expect(await readFile(filename)).toEqual(before);}finally{await rm(root,{recursive:true,force:true});}
});

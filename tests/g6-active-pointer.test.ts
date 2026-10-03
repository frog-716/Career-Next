import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm,readFile,readdir,symlink} from 'node:fs/promises';
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

it('missing pointer with existing managed or workspace evidence cannot guess local or create a replacement',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'career-g6-missing-pointer-'));
 try{
  for(const marker of ['managed-copies-manifest.json','workspaces','recovery','backups','purge-control','backup-settings.json']){
   const profile=path.join(root,marker.replaceAll('.','-'));await mkdir(profile);
   if(marker.endsWith('.json'))await writeFile(path.join(profile,marker),'retained managed metadata');
   else{await mkdir(path.join(profile,marker,'existing-copy'),{recursive:true});await writeFile(path.join(profile,marker,'existing-copy','career.sqlite'),'retained prior or restored bytes');}
   const filename=marker.endsWith('.json')?path.join(profile,marker):path.join(profile,marker,'existing-copy','career.sqlite');
   const before=await readFile(filename),top=await readdir(profile);
   await expect(activeWorkspace(profile)).rejects.toThrow('active_pointer_invalid');
   expect(await readFile(filename)).toEqual(before);expect(await readdir(profile)).toEqual(top);
  }
 }finally{await rm(root,{recursive:true,force:true});}
});

it('a fresh profile may contain browser cache and device security but no business workspace',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'career-g6-fresh-pointer-'));
 try{await mkdir(path.join(root,'Cache'));await writeFile(path.join(root,'Cache','browser-cache'),'browser only');await mkdir(path.join(root,'security'));await writeFile(path.join(root,'security','binding.json'),'device state only');
  expect(await activeWorkspace(root)).toEqual({root:path.join(root,'workspaces/local'),initial:true});
  expect(await readdir(root)).toEqual(['Cache','security']);
 }finally{await rm(root,{recursive:true,force:true});}
});

it('a lost post-restore pointer preserves both registered old local and restored database bytes',async()=>{
 const {default:Database}=await import('better-sqlite3');const root=await mkdtemp(path.join(os.tmpdir(),'career-g6-restored-pointer-'));
 try{
  const names=['workspaces/local','workspaces/'+randomUUID()],copies=[];
  for(const [index,name] of names.entries()){
   await mkdir(path.join(root,name),{recursive:true});const db=new Database(path.join(root,name,'career.sqlite'));
   try{db.exec('CREATE TABLE platform_workspace(instance TEXT PRIMARY KEY);CREATE TABLE retained_fact(body TEXT)');db.prepare('INSERT INTO platform_workspace VALUES(?)').run(randomUUID());db.prepare('INSERT INTO retained_fact VALUES(?)').run(index?'restored current fact':'old local fact');}finally{db.close();}
   copies.push({id:randomUUID(),relativePath:name,kind:index?'current_workspace':'old_workspace',state:'ready',createdAt:'2026-10-03T00:00:00.000Z'});
  }
  const manifest=JSON.stringify(copies);await writeFile(path.join(root,'managed-copies-manifest.json'),manifest);
  const before=await Promise.all(names.map(name=>readFile(path.join(root,name,'career.sqlite'))));
  await expect(activeWorkspace(root)).rejects.toThrow('active_pointer_invalid');
  expect(await Promise.all(names.map(name=>readFile(path.join(root,name,'career.sqlite'))))).toEqual(before);
  expect(await readFile(path.join(root,'managed-copies-manifest.json'),'utf8')).toBe(manifest);expect(await readdir(path.join(root,'workspaces'))).toEqual(names.map(name=>path.basename(name)).sort());
  await expect(readFile(path.join(root,'active-workspace-pointer.json'))).rejects.toHaveProperty('code','ENOENT');
 }finally{await rm(root,{recursive:true,force:true});}
});

it('missing pointer never follows a symlink local workspace, workspace parent, or profile root',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'career-g6-pointer-symlink-'));const outside=path.join(root,'outside');await mkdir(outside);await writeFile(path.join(outside,'career.sqlite'),'outside protected');
 try{
  const direct=path.join(root,'direct');await mkdir(path.join(direct,'workspaces'),{recursive:true});await symlink(outside,path.join(direct,'workspaces/local'));
  const parent=path.join(root,'parent');await mkdir(parent);await symlink(outside,path.join(parent,'workspaces'));
  const profile=path.join(root,'profile');await symlink(outside,profile);
  for(const location of [direct,parent,profile])await expect(activeWorkspace(location)).rejects.toThrow('active_pointer_invalid');
  expect(await readFile(path.join(outside,'career.sqlite'),'utf8')).toBe('outside protected');expect(await readdir(outside)).toEqual(['career.sqlite']);
 }finally{await rm(root,{recursive:true,force:true});}
});

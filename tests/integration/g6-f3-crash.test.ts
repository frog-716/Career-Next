import {it,expect,beforeAll} from 'vitest';
import {build} from 'vite';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import {createDataLifecycle} from '../../packages/backend/application/data-lifecycle/public';
import {activeWorkspace} from '../../apps/desktop/capabilities/active-workspace';
import {createManagedCopies} from '../../packages/backend/platform/backup/managed-copies';
import {createBackupManager} from '../../packages/backend/platform/backup/public';
const artifact=path.resolve('dist/g6-f3-test-support/recovery-crash.mjs');
beforeAll(async()=>{await build({configFile:false,logLevel:'warn',build:{outDir:path.dirname(artifact),target:'node24',lib:{entry:'tests/fixtures/g6-recovery-crash.ts',formats:['es'],fileName:()=>path.basename(artifact)},rolldownOptions:{external:[/^node:/,'better-sqlite3','zod']}}});});
it.each(['pointer-before','pointer-after','backup-registered'])('actual child SIGKILL at %s preserves committed pointer and never promotes interrupted backup',async cut=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g6-f3-kill-')),child=fork(artifact,[root,cut],{execPath:path.resolve('node_modules/node/bin/node'),stdio:['ignore','ignore','pipe','ipc']});let stderr='';child.stderr?.on('data',bytes=>stderr+=String(bytes));
 try{const message=await Promise.race([once(child,'message').then(([value])=>value as {stage:string;initial:string}),once(child,'exit').then(()=>{throw Error('child_exited: '+stderr);}),new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('cut_timeout: '+stderr)),15000))]);expect(message.stage).toBe(cut);child.kill('SIGKILL');const [code,signal]=await once(child,'exit');expect(code).toBeNull();expect(signal).toBe('SIGKILL');
 const selected=await activeWorkspace(root),pointer=JSON.parse(await readFile(path.join(root,'active-workspace-pointer.json'),'utf8'));expect(selected.root).toBe(path.join(root,pointer.relativePath));expect(selected.expected).toBe(pointer.workspaceInstance);if(cut==='pointer-after')expect(pointer.workspaceInstance).not.toBe(message.initial);else expect(pointer.workspaceInstance).toBe(message.initial);
 const db=new Database(path.join(selected.root,'career.sqlite'),{readonly:true,fileMustExist:true});try{expect(db.prepare('SELECT body FROM fact').get()).toEqual({body:'committed career data'});expect(db.prepare('SELECT instance FROM platform_workspace').get()).toEqual({instance:pointer.workspaceInstance});}finally{db.close();}
 const registry=createManagedCopies(root);if(cut==='backup-registered'){const manager=createBackupManager({root,registry,getActiveRoot:()=>selected.root,maintenance:async work=>work(),sanitizeCandidate:()=>{},validateRelations:()=>{}});expect(manager.list().filter(copy=>copy.kind==='failed_backup'&&copy.state==='failed')).toHaveLength(1);expect(manager.list().filter(copy=>copy.kind==='backup'&&copy.state==='ready')).toHaveLength(1);}else{createDataLifecycle({root,registry,getActiveRoot:()=>selected.root,maintenance:async work=>work(),sanitizeCandidate:()=>{},validateRelations:()=>{},impact:async references=>({references:[...references],description:'fixture',independentReferences:[],files:[],dependencies:'fixture'}),markPurge:async()=>{},drain:async()=>{},purge:async()=>{},compact:async()=>{},activate:async()=>{throw Error('not_requested');}});const current=registry.list().filter(copy=>copy.kind==='current_workspace');expect(current).toHaveLength(1);expect(current[0]!.id).toBe(pointer.copyId);}
 }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await once(child,'exit');}await rm(root,{recursive:true,force:true});}
},25000);
const backupArtifact=path.resolve('dist/g6-f3-backup-crash/backup-crash.mjs');
beforeAll(async()=>{await build({configFile:false,logLevel:'warn',build:{outDir:path.dirname(backupArtifact),target:'node24',lib:{entry:'tests/fixtures/g6-backup-crash.ts',formats:['es'],fileName:()=>path.basename(backupArtifact)},rolldownOptions:{external:[/^node:/,'better-sqlite3','zod']}}});});
it.each(['db-snapshot','blob-enumeration','blob-copy','hash-verification','filtered-publish','manifest','atomic-publish'])('actual child SIGKILL at backup %s leaves last complete point valid and lists interrupted point separately',async cut=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g6-f3-backup-kill-')),child=fork(backupArtifact,[root,cut],{execPath:path.resolve('node_modules/node/bin/node'),stdio:['ignore','ignore','pipe','ipc']});let stderr='';child.stderr?.on('data',bytes=>stderr+=String(bytes));
 try{const message=await Promise.race([once(child,'message').then(([value])=>value as {stage:string}),once(child,'exit').then(()=>{throw Error('child_exited: '+stderr);}),new Promise<never>((_,reject)=>setTimeout(()=>reject(Error('cut_timeout: '+stderr)),15000))]);expect(message.stage).toBe(cut);child.kill('SIGKILL');const [code,signal]=await once(child,'exit');expect(code).toBeNull();expect(signal).toBe('SIGKILL');
 const active=path.join(root,'workspace'),manager=createBackupManager({root,getActiveRoot:()=>active,maintenance:async work=>work(),sanitizeCandidate:()=>{},validateRelations:()=>{}}),complete=manager.list().filter(copy=>copy.kind==='backup'&&copy.state==='ready');expect(complete).toHaveLength(1);expect(manager.list().filter(copy=>copy.kind==='failed_backup'&&copy.state==='failed')).toHaveLength(1);await expect(manager.verify(complete[0]!)).resolves.toMatchObject({id:complete[0]!.id});const db=new Database(path.join(active,'career.sqlite'),{readonly:true,fileMustExist:true});try{expect(db.prepare('SELECT body FROM fact').get()).toEqual({body:'committed career data'});}finally{db.close();}
 }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await once(child,'exit');}await rm(root,{recursive:true,force:true});}
},25000);

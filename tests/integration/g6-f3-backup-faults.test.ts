import {it,expect,vi,afterEach} from 'vitest';
import Database from 'better-sqlite3';
import {randomUUID,createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
const injection=vi.hoisted(()=>({stage:'',enabled:false,hits:0}));
vi.mock('node:fs/promises',async importOriginal=>{
 const fs=await importOriginal<typeof import('node:fs/promises')>();
 return {...fs,async open(filename:Parameters<typeof fs.open>[0],...args:Parameters<typeof fs.open> extends [unknown,...infer R]?R:never){
  const handle=await fs.open(filename,...args),name=String(filename);
  if(injection.enabled&&((injection.stage==='blob-copy'&&name.includes('/backups/')&&name.includes('/blobs/'))||(injection.stage==='restore-copy'&&name.includes('/workspaces/')))&&args[0]==='wx')return new Proxy(handle,{get(target,key){if(key==='writeFile')return async()=>{injection.hits++;throw Object.assign(Error('controlled_quota_exhausted'),{code:'ENOSPC'});};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
  if(injection.enabled&&injection.stage==='hash-verification'&&name.includes('/backups/')&&name.includes('/blobs/')&&args[0]!=='wx'&&injection.hits===0){await fs.writeFile(name,'tampered copied blob');injection.hits++;}
  return handle;
 }};
});
vi.mock('node:fs',async importOriginal=>{
 const fs=await importOriginal<typeof import('node:fs')>();return {...fs,writeFileSync(...args:Parameters<typeof fs.writeFileSync>){if(injection.enabled&&injection.stage==='manifest'){injection.hits++;throw Object.assign(Error('controlled_quota_exhausted'),{code:'ENOSPC'});}return fs.writeFileSync(...args);},renameSync(...args:Parameters<typeof fs.renameSync>){if(injection.enabled&&injection.stage==='atomic-publish'&&String(args[1]).endsWith('/backup.json')){injection.hits++;throw Error('controlled_publish_interruption');}return fs.renameSync(...args);}};
});
import {mkdtemp,mkdir,writeFile,rm,readFile,rename} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {createBackupManager,type BackupPorts} from '../../packages/backend/platform/backup/public';
import {createManagedCopies} from '../../packages/backend/platform/backup/managed-copies';
const fixtures:{root:string;db:Database.Database}[]=[];
afterEach(async()=>{injection.enabled=false;injection.stage='';injection.hits=0;for(const f of fixtures.splice(0)){if(f.db.open)f.db.close();await rm(f.root,{recursive:true,force:true});}});
async function fixture(){const root=await mkdtemp(path.join(os.tmpdir(),'g6-f3-fault-')),active=path.join(root,'workspace');await mkdir(path.join(active,'blobs'),{recursive:true});const db=new Database(path.join(active,'career.sqlite'));fixtures.push({root,db});db.exec('CREATE TABLE platform_blobs(id TEXT,digest TEXT,size INTEGER,state TEXT);CREATE TABLE platform_artifact_retention(blob_id TEXT);CREATE TABLE fact(body TEXT);');db.prepare('INSERT INTO fact VALUES (?)').run('committed original');const id=randomUUID(),bytes=Buffer.from('blob bytes');await writeFile(path.join(active,'blobs',id),bytes);db.prepare('INSERT INTO platform_blobs VALUES (?,?,?,?)').run(id,createHash('sha256').update(bytes).digest('hex'),bytes.length,'published');db.prepare('INSERT INTO platform_artifact_retention VALUES (?)').run(id);let logicalStage='';const ports:BackupPorts={root,getActiveRoot:()=>active,maintenance:async work=>work(),sanitizeCandidate:candidate=>{if(logicalStage==='extra-file'){writeFileSync(path.join(path.dirname(candidate.name),'unexpected'),'extra unapproved file');injection.hits++;}if(['blob-enumeration','filtered-publish','cancel'].includes(logicalStage)){injection.hits++;throw Object.assign(Error(logicalStage),{code:logicalStage==='filtered-publish'?'ENOSPC':'ABORT_ERR'});}},validateRelations:()=>{}};return {root,active,db,id,ports,setStage(stage:string){logicalStage=stage;},manager:createBackupManager(ports)};}
it.each(['db-snapshot','blob-enumeration','blob-copy','hash-verification','filtered-publish','manifest','atomic-publish','cancel','extra-file'] as const)('backup %s failure never reports complete or prunes the last complete point',async stage=>{
 const f=await fixture(),complete=await f.manager.backup(1),before=await readFile(path.join(f.active,'career.sqlite'));
 f.setStage(stage);injection.stage=stage;injection.enabled=true;
 if(stage==='db-snapshot'){f.db.close();await rename(path.join(f.active,'career.sqlite'),path.join(f.active,'unavailable.sqlite'));}
 // Manifest failure is armed only once the candidate is already registered, so it tests the actual backup manifest sink.
 if(stage==='manifest'){injection.enabled=false;const registry=f.manager.registry,register=registry.register.bind(registry);vi.spyOn(registry,'register').mockImplementation(input=>{const copy=register(input);if(input.kind==='backup')injection.enabled=true;return copy;});}
 await expect(f.manager.backup(1)).rejects.toThrow();injection.enabled=false;
 const restarted=createBackupManager({...f.ports,registry:createManagedCopies(f.root)});expect(restarted.registry.get(complete.id).state).toBe('ready');await expect(restarted.verify(complete)).resolves.toMatchObject({id:complete.id});expect(restarted.list().filter(c=>c.kind==='failed_backup'&&c.state==='failed')).toHaveLength(1);
 if(stage!=='db-snapshot'){expect(injection.hits).toBeGreaterThan(0);expect(await readFile(path.join(f.active,'career.sqlite'))).toEqual(before);expect(f.db.prepare('SELECT body FROM fact').get()).toEqual({body:'committed original'});}
});
it('restore candidate controlled ENOSPC remains quarantined and leaves original active plus complete backup intact',async()=>{
 const f=await fixture(),complete=await f.manager.backup(1);injection.enabled=true;injection.stage='restore-copy';await expect(f.manager.prepareRestore(complete.id)).rejects.toThrow('restore_invalid');injection.enabled=false;expect(injection.hits).toBeGreaterThan(0);expect(f.manager.list().filter(c=>c.kind==='quarantine'&&c.state==='failed')).toHaveLength(1);expect(f.db.prepare('SELECT body FROM fact').get()).toEqual({body:'committed original'});await expect(f.manager.verify(complete)).resolves.toMatchObject({id:complete.id});
});

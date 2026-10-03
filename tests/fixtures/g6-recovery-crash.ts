// Isolated integration driver; excluded from production package.
import Database from 'better-sqlite3';
import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createDataLifecycle} from '../../packages/backend/application/data-lifecycle/public';
import {createManagedCopies,durableJson} from '../../packages/backend/platform/backup/managed-copies';
const root=process.argv[2]!,cut=process.argv[3]!;let active=path.join(root,'workspaces','initial');await mkdir(path.join(active,'blobs'),{recursive:true});const db=new Database(path.join(active,'career.sqlite'));db.exec('CREATE TABLE platform_workspace(instance TEXT);CREATE TABLE platform_blobs(id TEXT,digest TEXT,size INTEGER,state TEXT);CREATE TABLE platform_artifact_retention(blob_id TEXT,owner TEXT,object_id TEXT);CREATE TABLE fact(body TEXT);');const initial=randomUUID();db.prepare('INSERT INTO platform_workspace VALUES (?)').run(initial);db.prepare('INSERT INTO fact VALUES (?)').run('committed career data');const registry=createManagedCopies(root),old=registry.register({relativePath:'workspaces/initial',kind:'current_workspace',state:'ready'});durableJson(path.join(root,'active-workspace-pointer.json'),{copyId:old.id,relativePath:old.relativePath,workspaceInstance:initial});
async function pause(stage:string){process.send?.({stage,initial,oldId:old.id});await new Promise<void>(()=>{});}
const lifecycle=createDataLifecycle({root,registry,getActiveRoot:()=>active,maintenance:async work=>work(),sanitizeCandidate(){if(cut==='backup-snapshot')throw Error('unused');},validateRelations:()=>{},impact:async references=>({references:[...references],description:'fixture',independentReferences:[],files:[],dependencies:'fixed'}),markPurge:async()=>{},drain:async()=>{},purge:async()=>{},compact:async()=>{},activate:async({root:next,commitPointer})=>{db.close();if(cut==='pointer-before')await pause(cut);commitPointer();active=next;if(cut==='pointer-after')await pause(cut);}});
const backup=await lifecycle.handle({operation:'data.backup'},'human');if(backup.kind!=='backup')throw Error('backup_failed');
if(cut==='backup-registered'){const copy=registry.register({relativePath:'backups/'+randomUUID(),kind:'backup'});await pause(cut);}
const candidate=await lifecycle.handle({operation:'data.restore.prepare',backupId:backup.copy.id},'human');if(candidate.kind!=='restore_candidate')throw Error('candidate_failed');if(cut==='pointer-after'){const rename=fs.renameSync.bind(fs);fs.renameSync=(...args)=>{rename(...args);if(String(args[1]).endsWith('/active-workspace-pointer.json')){process.send?.({stage:cut,initial,oldId:old.id});Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);}};syncBuiltinESMExports();}
await lifecycle.handle({operation:'data.restore.activate',candidateId:candidate.copy.id,confirmed:true},'human');throw Error('cut_not_reached');

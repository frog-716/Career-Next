import { it,expect } from 'vitest';
import { mkdtemp,rm,readFile,writeFile,mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {randomUUID,createHash} from 'node:crypto';
import {createLedger} from '../../packages/backend/platform/database/ledger';
import { openWorkspace } from '../../packages/backend/platform/database/database';
import { materialsMigration } from '../../packages/backend/domains/materials/migration';
import type { MigrationBatch } from '../../packages/backend/platform/database/migrations';
const batch:MigrationBatch={version:2,name:'002-test',fragments:[{id:'test.initial',dependencies:[],sql:'CREATE TABLE example(id TEXT);'}]};
for(const tamper of ['DELETE FROM platform_migration_fragments','DELETE FROM platform_migration_batches WHERE version=2',"UPDATE platform_migration_fragments SET checksum='changed'",'DROP TABLE platform_migration_batches'])it('rejects a corrupted released manifest: '+tamper,async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-g2-integrity-'));
 try{const workspace=await openWorkspace(root,materialsMigration,[batch]);workspace.close();const db=new Database(path.join(root,'career.sqlite'));db.exec(tamper);db.close();await expect(openWorkspace(root,materialsMigration,[batch])).rejects.toThrow('migration_mismatch');}
 finally{await rm(root,{recursive:true,force:true});}
});
it('registers the real upgrade recovery as a managed copy',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-g2-copy-registry-'));
 try{const workspace=await openWorkspace(root,materialsMigration,[batch]);workspace.close();const registry=JSON.parse(await readFile(path.join(root,'managed-copies.json'),'utf8')) as {copies:{relativePath:string;state:string}[]};expect(registry.copies).toHaveLength(1);expect(registry.copies[0].state).toBe('ready');const copy=new Database(path.join(root,registry.copies[0].relativePath,'career.sqlite'),{readonly:true});expect(copy.pragma('user_version',{simple:true})).toBe(1);copy.close();}
 finally{await rm(root,{recursive:true,force:true});}
});

it('a missing or corrupt protected blob cannot produce a usable upgrade point or advance the schema',async()=>{
 for(const missing of [true,false]){
  const root=await mkdtemp(path.join(tmpdir(),'career-g2-copy-blob-'));
  try{
   const old=await openWorkspace(root,materialsMigration);const id=randomUUID(),commandId=randomUUID(),objectId=randomUUID();const bytes=Buffer.from('Expected protected bytes');const ledger=createLedger(old.database);
   old.database.transaction(()=>{ledger.hold(commandId,'payload',id,createHash('sha256').update(bytes).digest('hex'),bytes.length,'retired');ledger.published(id,commandId);ledger.retain(id,objectId,commandId);})();old.close();
   if(!missing){await mkdir(path.join(root,'blobs'));await writeFile(path.join(root,'blobs',id),'Corrupt copy bytes');}
   await expect(openWorkspace(root,materialsMigration,[batch])).rejects.toThrow();
   const db=new Database(path.join(root,'career.sqlite'),{readonly:true});try{expect(db.pragma('user_version',{simple:true})).toBe(1);}finally{db.close();}
   const registry=JSON.parse(await readFile(path.join(root,'managed-copies.json'),'utf8')) as {copies:{state:string}[]};expect(registry.copies[0].state).toBe('failed');
  }finally{await rm(root,{recursive:true,force:true});}
 }
});

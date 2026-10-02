import { it,expect } from 'vitest';
import { mkdtemp,rm,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
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

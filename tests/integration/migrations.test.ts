import { it, expect } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { openWorkspace } from '../../packages/backend/platform/database/database';
import { materialsMigration } from '../../packages/backend/domains/materials/migration';
import type { MigrationBatch } from '../../packages/backend/platform/database/migrations';
const batch: MigrationBatch = {version:2,name:'002-g2',fragments:[{id:'example.initial',dependencies:[],sql:'CREATE TABLE example(id TEXT PRIMARY KEY);'}]};
it('upgrades a G1 workspace once, keeps its identity and creates a recovery point', async () => {
 const root=await mkdtemp(path.join(tmpdir(),'career-g2-migration-'));
 try {
  const g1=await openWorkspace(root,materialsMigration);const identity=g1.workspaceInstance;g1.close();
  const g2=await openWorkspace(root,materialsMigration,[batch]);expect(g2.workspaceInstance).toBe(identity);g2.close();
  expect(await readdir(path.join(root,'recovery'))).toHaveLength(1);
  const again=await openWorkspace(root,materialsMigration,[batch]);again.close();
  expect(await readdir(path.join(root,'recovery'))).toHaveLength(1);
  await expect(openWorkspace(root,materialsMigration,[{...batch,fragments:[{...batch.fragments[0],sql:'CREATE TABLE different(id TEXT);'}]}])).rejects.toThrow('migration_mismatch');
  const restored=await openWorkspace(root,materialsMigration,[batch]);restored.close();
 }finally{await rm(root,{recursive:true,force:true});}
});
it('a failed batch rolls back completely and rejects missing dependencies/future versions', async () => {
 const root=await mkdtemp(path.join(tmpdir(),'career-g2-migration-failure-'));
 try {
  await expect(openWorkspace(root,materialsMigration,[{...batch,fragments:[batch.fragments[0],{id:'broken',dependencies:['example.initial'],sql:'INVALID SQL'}]}])).rejects.toThrow('migration_failed');
  const g1=await openWorkspace(root,materialsMigration);
  expect(g1.database.pragma('user_version',{simple:true})).toBe(1);
  expect(g1.database.prepare("SELECT name FROM sqlite_master WHERE name='example'").get()).toBeUndefined();g1.close();
  await expect(openWorkspace(root,materialsMigration,[{...batch,fragments:[{...batch.fragments[0],dependencies:['absent']}]}])).rejects.toThrow('migration_mismatch');
  const db=new Database(path.join(root,'career.sqlite'));db.pragma('user_version = 999');db.close();
  await expect(openWorkspace(root,materialsMigration,[batch])).rejects.toThrow('db_failed');
 }finally{await rm(root,{recursive:true,force:true});}
});

import { it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { ledgerMigration, artifactMigration, createLedger } from '../packages/backend/platform/database/ledger';
it('upgrades existing Raw protection and protects a frozen PDF until owner retention commits', () => {
 const db=new Database(':memory:');db.pragma('foreign_keys = ON');
 try {
  db.exec('CREATE TABLE platform_blobs(id TEXT PRIMARY KEY,digest TEXT,size INTEGER,state TEXT);'+ledgerMigration);
  const old=createLedger(db);old.hold('raw-command','raw-payload','raw-blob','raw-digest',4,'old-generation');old.published('raw-blob','raw-command');old.retain('raw-blob','raw-object','raw-command');
  db.transaction(()=>db.exec(artifactMigration))();
  const current=createLedger(db);
  expect(current.receipt('raw-command')?.material_id).toBe('raw-object');
  current.hold('pdf-command','snapshot','pdf-blob','pdf-digest',100,'generation','resume.version');
  expect(current.claim()).toEqual([]);
  current.published('pdf-blob','pdf-command');
  expect(()=>db.transaction(()=>{current.verifyHold('pdf-blob','pdf-command','generation');current.retain('pdf-blob','version','pdf-command','resume');throw Error('version failed');})()).toThrow('version failed');
  expect(current.claim()).toEqual([]);
  db.transaction(()=>current.retain('pdf-blob','version','pdf-command','resume'))();
  expect(current.claim()).toEqual([]);
  current.hold('abandoned','snapshot','orphan','digest',20,'previous','resume.version');current.recover('generation');
  expect(current.claim()).toEqual(['orphan']);
 }finally{db.close();}
});

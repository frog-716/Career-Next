import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {digest} from '../../packages/backend/application/migration/source';
import {assertLiteFingerprint,assertActiveReplaceable,assertLiteEmptyHistory} from '../../packages/backend/application/migration/lite-activation';
it('rejects a candidate changed after desktop verification before it can activate',()=>{
 const db=new Database(':memory:');try{db.exec('CREATE TABLE platform_workspace(instance TEXT PRIMARY KEY)');db.prepare('INSERT INTO platform_workspace VALUES (?)').run('verified-instance');
 expect(()=>assertLiteFingerprint(db,{databaseDigest:'approved',workspaceInstance:'verified-instance'},'changed')).toThrow('STAGING_VERIFICATION_STALE');
 expect(()=>assertLiteFingerprint(db,{databaseDigest:'approved',workspaceInstance:'different'},'approved')).toThrow('STAGING_VERIFICATION_STALE');
 expect(()=>assertLiteFingerprint(db,{databaseDigest:'approved',workspaceInstance:'verified-instance'},'approved')).not.toThrow();
 expect(()=>assertLiteFingerprint(db,{databaseDigest:'approved',workspaceInstance:'verified-instance'},'approved',true)).toThrow('STAGING_VERIFICATION_STALE');
 }finally{db.close();}
});
it('rejects a legacy archive row even when no current AI proposal exists',()=>{
 const db=new Database(':memory:');try{db.exec("CREATE TABLE ai_legacy_history(id TEXT);INSERT INTO ai_legacy_history VALUES ('TEST EXCLUDED ARCHIVE')");expect(()=>assertLiteEmptyHistory(db)).toThrow('EXCLUDED_OBJECT_PRESENT');}finally{db.close();}
});
it('rejects committed WAL content even when the approved main database bytes did not change',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'career-lite-wal-')),file=path.join(root,'career.sqlite'),db=new Database(file);
 try{db.pragma('journal_mode=WAL');db.exec("CREATE TABLE platform_workspace(instance TEXT PRIMARY KEY);INSERT INTO platform_workspace VALUES ('verified');CREATE TABLE test_visible_content(text TEXT);");db.pragma('wal_checkpoint(TRUNCATE)');
  const approved=digest(readFileSync(file));db.exec("INSERT INTO test_visible_content VALUES ('TEST CHANGED AFTER PREVIEW')");
  expect(digest(readFileSync(file))).toBe(approved);expect(readFileSync(file+'-wal').length).toBeGreaterThan(0);
  expect(()=>assertLiteFingerprint(db,{databaseDigest:approved,workspaceInstance:'verified'},digest(readFileSync(file)),readFileSync(file+'-wal').length>0)).toThrow('STAGING_VERIFICATION_STALE');
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});
it('test-looking names alone never authorize overwriting active data; exact explicit TEST classification does',()=>{
 const db=new Database(':memory:');try{db.exec('CREATE TABLE profile_current(id INTEGER PRIMARY KEY,revision INTEGER,body TEXT)');db.prepare('INSERT INTO profile_current VALUES (1,1,?)').run(JSON.stringify({name:'TEST LOOKING',contact:'',links:[]}));
 expect(()=>assertActiveReplaceable(db,'snapshot')).toThrow('ACTIVE_REAL_DATA_CONFLICT');
 expect(()=>assertActiveReplaceable(db,'snapshot',{classification:'TEST',databaseDigest:'different'})).toThrow('ACTIVE_REAL_DATA_CONFLICT');
 expect(()=>assertActiveReplaceable(db,'snapshot',{classification:'TEST',databaseDigest:'snapshot'})).not.toThrow();
 }finally{db.close();}
});

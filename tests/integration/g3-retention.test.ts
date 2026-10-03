import { afterEach, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { createLedger, ledgerMigration, artifactMigration } from '../../packages/backend/platform/database/ledger';
import { offerRetentionMigration } from '../../packages/backend/platform/database/offer-retention';

const opened: Database.Database[]=[];
afterEach(()=>{for(const db of opened.splice(0))db.close();});
it('Offer acceptance independently retains already published original bytes after the Raw retention is removed',()=>{
  const db=new Database(':memory:');opened.push(db);db.pragma('foreign_keys=ON');
  db.exec('CREATE TABLE platform_blobs(id TEXT PRIMARY KEY,digest TEXT NOT NULL,size INTEGER NOT NULL,state TEXT NOT NULL);'+ledgerMigration+artifactMigration+offerRetentionMigration);
  const ledger=createLedger(db),blob=randomUUID(),command=randomUUID(),raw=randomUUID(),basis=randomUUID();
  ledger.hold(command,'immutable-intent',blob,'a'.repeat(64),12,'test-generation');
  ledger.published(blob,command);ledger.retain(blob,raw,command);
  ledger.retainExisting(blob,basis,'offer');
  // Approved platform retention seam: simulate removal of the original owner's
  // reason; another owner must still protect the same physical blob.
  db.prepare("DELETE FROM platform_artifact_retention WHERE owner='materials'").run();
  expect(ledger.claim()).toEqual([]);
  expect(ledger.retainedArtifacts()).toEqual([{id:blob,digest:'a'.repeat(64),size:12}]);
  expect(()=>ledger.retainExisting(randomUUID(),randomUUID(),'offer')).toThrow('invalid_capability');
});

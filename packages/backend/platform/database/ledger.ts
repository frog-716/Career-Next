import type Database from 'better-sqlite3';
export const ledgerMigration = `
CREATE TABLE platform_receipts (command_id TEXT PRIMARY KEY, operation TEXT NOT NULL CHECK(operation='materials.confirm'), payload_digest TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','committed','failed')), material_id TEXT, error TEXT);
CREATE TABLE platform_holds (blob_id TEXT PRIMARY KEY REFERENCES platform_blobs(id), command_id TEXT UNIQUE NOT NULL REFERENCES platform_receipts(command_id), generation TEXT NOT NULL);
CREATE TABLE platform_retention (blob_id TEXT NOT NULL REFERENCES platform_blobs(id), owner TEXT NOT NULL CHECK(owner='materials'), object_id TEXT UNIQUE NOT NULL, PRIMARY KEY(blob_id,owner,object_id));`;
export const artifactMigration = `
CREATE TABLE platform_artifact_receipts (command_id TEXT PRIMARY KEY, operation TEXT NOT NULL CHECK(operation IN ('materials.confirm','resume.version')), payload_digest TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','committed','failed')), object_id TEXT, error TEXT);
CREATE TABLE platform_artifact_holds (blob_id TEXT PRIMARY KEY REFERENCES platform_blobs(id), command_id TEXT UNIQUE NOT NULL REFERENCES platform_artifact_receipts(command_id), generation TEXT NOT NULL);
CREATE TABLE platform_artifact_retention (blob_id TEXT NOT NULL REFERENCES platform_blobs(id), owner TEXT NOT NULL CHECK(owner IN ('materials','resume')), object_id TEXT NOT NULL, PRIMARY KEY(blob_id,owner,object_id), UNIQUE(owner,object_id));
INSERT INTO platform_artifact_receipts SELECT command_id,operation,payload_digest,status,material_id,error FROM platform_receipts;
INSERT INTO platform_artifact_holds SELECT * FROM platform_holds;
INSERT INTO platform_artifact_retention SELECT * FROM platform_retention;
DROP TABLE platform_holds;
DROP TABLE platform_retention;
DROP TABLE platform_receipts;`;
export function createLedger(db: Database.Database) {
  // G1's released migration stays byte-identical. Startup upgrades its records
  // atomically; the legacy names are used only before that release is applied.
  const upgraded=!!db.prepare("SELECT name FROM sqlite_master WHERE name='platform_artifact_receipts'").get();
  const receipts=upgraded?'platform_artifact_receipts':'platform_receipts';
  const holds=upgraded?'platform_artifact_holds':'platform_holds';
  const retention=upgraded?'platform_artifact_retention':'platform_retention';
  const objectColumn=upgraded?'object_id':'material_id';
  return {
    receipt(commandId: string, payloadDigest?: string) {
      const row = db.prepare(`SELECT *,${objectColumn} AS material_id FROM ${receipts} WHERE command_id=?`).get(commandId) as { payload_digest: string; status: 'pending'|'committed'|'failed'; material_id: string; error: string } | undefined;
      if (!row) return undefined;
      if (payloadDigest && payloadDigest !== row.payload_digest) throw new Error('conflict');
      return row;
    },
    hold(commandId: string, payloadDigest: string, blobId: string, digest: string, size: number, generation: string, operation: 'materials.confirm'|'resume.version' = 'materials.confirm') {
      db.prepare(`INSERT INTO ${receipts}(command_id,operation,payload_digest,status) VALUES (?,?,?,'pending')`).run(commandId,operation,payloadDigest);
      db.prepare(`INSERT INTO platform_blobs VALUES (?,?,?,'held')`).run(blobId,digest,size);
      db.prepare(`INSERT INTO ${holds} VALUES (?,?,?)`).run(blobId,commandId,generation);
    },
    published(blobId: string, commandId: string) {
      const result = db.prepare(`UPDATE platform_blobs SET state='published' WHERE id=? AND state='held' AND EXISTS(SELECT 1 FROM ${holds} WHERE blob_id=? AND command_id=?)`).run(blobId,blobId,commandId);
      if (result.changes !== 1) throw new Error('invalid_capability');
    },
    retainedArtifacts() {return db.prepare(`SELECT DISTINCT b.id,b.digest,b.size FROM platform_blobs b JOIN ${retention} r ON r.blob_id=b.id`).all() as {id:string;digest:string;size:number}[];},
    describe(blobId: string) {return db.prepare('SELECT digest,size,state FROM platform_blobs WHERE id=?').get(blobId) as {digest:string;size:number;state:string}|undefined;},
    verifyHold(blobId: string, commandId: string, generation: string) {
      if (!db.prepare(`SELECT 1 FROM platform_blobs b JOIN ${holds} h ON b.id=h.blob_id WHERE b.id=? AND b.state='published' AND h.command_id=? AND h.generation=?`).get(blobId,commandId,generation)) throw new Error('invalid_capability');
    },
    retain(blobId: string, materialId: string, commandId: string, owner: 'materials'|'resume' = 'materials') {
      db.prepare(`INSERT INTO ${retention} VALUES (?,?,?)`).run(blobId,owner,materialId);
      db.prepare(`DELETE FROM ${holds} WHERE blob_id=? AND command_id=?`).run(blobId,commandId);
      db.prepare(`UPDATE ${receipts} SET status='committed',${objectColumn}=? WHERE command_id=?`).run(materialId,commandId);
    },
    retainExisting(blobId: string, objectId: string, owner: 'offer') {
      if(!upgraded||!db.prepare("SELECT 1 FROM platform_blobs WHERE id=? AND state='published'").get(blobId))throw Error('invalid_capability');
      const existing=db.prepare(`SELECT blob_id FROM ${retention} WHERE owner=? AND object_id=?`).get(owner,objectId) as {blob_id:string}|undefined;
      if(existing){if(existing.blob_id!==blobId)throw Error('conflict');return;}
      db.prepare(`INSERT INTO ${retention} VALUES (?,?,?)`).run(blobId,owner,objectId);
    },
    fail(commandId: string, code: string) {
      db.prepare(`UPDATE ${receipts} SET status='failed',error=? WHERE command_id=? AND status='pending'`).run(code,commandId);
      db.prepare(`DELETE FROM ${holds} WHERE command_id=? AND NOT EXISTS(SELECT 1 FROM ${receipts} WHERE command_id=? AND status='committed')`).run(commandId,commandId);
    },
    recover(generation: string) {
      const held = db.prepare(`SELECT command_id FROM ${holds} WHERE generation<>?`).all(generation) as { command_id: string }[];
      for (const row of held) this.fail(row.command_id, 'invalid_capability');
    },
    claim() {
      const rows = db.prepare(`SELECT id FROM platform_blobs b WHERE state IN ('held','published','delete_claimed') AND NOT EXISTS(SELECT 1 FROM ${holds} WHERE blob_id=b.id) AND NOT EXISTS(SELECT 1 FROM ${retention} WHERE blob_id=b.id)`).all() as { id: string }[];
      for (const row of rows) db.prepare(`UPDATE platform_blobs SET state='delete_claimed' WHERE id=?`).run(row.id);
      return rows.map(row => row.id);
    },
    deleted(id: string) { db.prepare(`UPDATE platform_blobs SET state='deleted' WHERE id=? AND state='delete_claimed'`).run(id); },
  };
}

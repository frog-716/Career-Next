import type Database from 'better-sqlite3';
export const ledgerMigration = `
CREATE TABLE platform_receipts (command_id TEXT PRIMARY KEY, operation TEXT NOT NULL CHECK(operation='materials.confirm'), payload_digest TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','committed','failed')), material_id TEXT, error TEXT);
CREATE TABLE platform_holds (blob_id TEXT PRIMARY KEY REFERENCES platform_blobs(id), command_id TEXT UNIQUE NOT NULL REFERENCES platform_receipts(command_id), generation TEXT NOT NULL);
CREATE TABLE platform_retention (blob_id TEXT NOT NULL REFERENCES platform_blobs(id), owner TEXT NOT NULL CHECK(owner='materials'), object_id TEXT UNIQUE NOT NULL, PRIMARY KEY(blob_id,owner,object_id));`;
export function createLedger(db: Database.Database) {
  return {
    receipt(commandId: string, payloadDigest?: string) {
      const row = db.prepare('SELECT * FROM platform_receipts WHERE command_id=?').get(commandId) as { payload_digest: string; status: 'pending'|'committed'|'failed'; material_id: string; error: string } | undefined;
      if (!row) return undefined;
      if (payloadDigest && payloadDigest !== row.payload_digest) throw new Error('conflict');
      return row;
    },
    hold(commandId: string, payloadDigest: string, blobId: string, digest: string, size: number, generation: string) {
      db.prepare("INSERT INTO platform_receipts(command_id,operation,payload_digest,status) VALUES (?,'materials.confirm',?,'pending')").run(commandId,payloadDigest);
      db.prepare("INSERT INTO platform_blobs VALUES (?,?,?,'held')").run(blobId,digest,size);
      db.prepare('INSERT INTO platform_holds VALUES (?,?,?)').run(blobId,commandId,generation);
    },
    published(blobId: string, commandId: string) {
      const result = db.prepare("UPDATE platform_blobs SET state='published' WHERE id=? AND state='held' AND EXISTS(SELECT 1 FROM platform_holds WHERE blob_id=? AND command_id=?)").run(blobId,blobId,commandId);
      if (result.changes !== 1) throw new Error('invalid_capability');
    },
    verifyHold(blobId: string, commandId: string, generation: string) {
      if (!db.prepare("SELECT 1 FROM platform_blobs b JOIN platform_holds h ON b.id=h.blob_id WHERE b.id=? AND b.state='published' AND h.command_id=? AND h.generation=?").get(blobId,commandId,generation)) throw new Error('invalid_capability');
    },
    retain(blobId: string, materialId: string, commandId: string) {
      db.prepare("INSERT INTO platform_retention VALUES (?,'materials',?)").run(blobId,materialId);
      db.prepare('DELETE FROM platform_holds WHERE blob_id=? AND command_id=?').run(blobId,commandId);
      db.prepare("UPDATE platform_receipts SET status='committed',material_id=? WHERE command_id=?").run(materialId,commandId);
    },
    fail(commandId: string, code: string) {
      db.prepare("UPDATE platform_receipts SET status='failed',error=? WHERE command_id=? AND status='pending'").run(code,commandId);
      db.prepare("DELETE FROM platform_holds WHERE command_id=? AND NOT EXISTS(SELECT 1 FROM platform_receipts WHERE command_id=? AND status='committed')").run(commandId,commandId);
    },
    recover(generation: string) {
      const held = db.prepare('SELECT command_id FROM platform_holds WHERE generation<>?').all(generation) as { command_id: string }[];
      for (const row of held) this.fail(row.command_id, 'invalid_capability');
    },
    claim() {
      const rows = db.prepare("SELECT id FROM platform_blobs b WHERE state IN ('held','published','delete_claimed') AND NOT EXISTS(SELECT 1 FROM platform_holds WHERE blob_id=b.id) AND NOT EXISTS(SELECT 1 FROM platform_retention WHERE blob_id=b.id)").all() as { id: string }[];
      for (const row of rows) db.prepare("UPDATE platform_blobs SET state='delete_claimed' WHERE id=?").run(row.id);
      return rows.map(row => row.id);
    },
    deleted(id: string) { db.prepare("UPDATE platform_blobs SET state='deleted' WHERE id=? AND state='delete_claimed'").run(id); },
  };
}

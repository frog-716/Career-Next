import type Database from 'better-sqlite3';
import { z } from 'zod';
import { LocalSearchOwner } from '../../../contracts/application/local-search';
export { localSearchMigration } from './migration';
export { createLocalSearch } from './client';

const Projection = z.strictObject({
  owner: LocalSearchOwner, id: z.uuid(), revision: z.number().int().positive(),
  title: z.string().max(500), body: z.string().max(256000),
  scope: z.string().min(1).max(30), scopeId: z.uuid().optional(), active: z.boolean(),
});
export type LocalSearchDocument = z.infer<typeof Projection>;
/** Called only inside the unique writer with an owner-provided current DTO. */
export function createLocalSearchIndex(db: Database.Database) {
  function remove(owner: LocalSearchDocument['owner'], id: string) {
    db.transaction(() => {
      db.prepare('DELETE FROM platform_local_search_chunks WHERE owner=? AND object_id=?').run(owner, id);
      db.prepare('DELETE FROM platform_local_search_documents WHERE owner=? AND object_id=?').run(owner, id);
      db.prepare('DELETE FROM platform_local_search_dirty WHERE owner=? AND object_id=?').run(owner, id);
    })();
  }
  function replace(input: LocalSearchDocument) {
    const doc = Projection.parse(input), body = `${doc.title}\n${doc.body}`;
    if (Buffer.byteLength(body) > 768000) throw Error('projection_too_large');
    db.transaction(() => {
      remove(doc.owner, doc.id);
      db.prepare('INSERT INTO platform_local_search_documents VALUES(?,?,?,?,?,?,?)').run(doc.owner, doc.id, doc.revision, doc.title, doc.scope, doc.scopeId ?? '', Number(doc.active));
      const insert = db.prepare('INSERT INTO platform_local_search_chunks(owner,object_id,ordinal,text) VALUES(?,?,?,?)');
      let chunk = '', bytes = 0, ordinal = 0;
      for (const char of body) {
        const size = Buffer.byteLength(char);
        if (bytes + size > 4096) {
          insert.run(doc.owner, doc.id, ordinal++, chunk);
          // Fixed overlap preserves every supported query across a UTF8 chunk boundary.
          chunk = Array.from(chunk).slice(-63).join(''); bytes = Buffer.byteLength(chunk);
        }
        chunk += char; bytes += size;
      }
      if (chunk) insert.run(doc.owner, doc.id, ordinal, chunk);
      db.prepare('DELETE FROM platform_local_search_dirty WHERE owner=? AND object_id=?').run(doc.owner, doc.id);
    })();
  }
  return { replace, remove,
    /** Dirty IDs are notifications, not content. Each batch is capped at eight owner DTOs. */
    maintenanceBatch(resolve: (owner: LocalSearchDocument['owner'], id: string) => LocalSearchDocument | undefined, limit = 8, cancelled: () => boolean = () => false) {
      const batch = db.prepare('SELECT owner,object_id FROM platform_local_search_dirty ORDER BY owner,object_id LIMIT ?').all(Math.max(1, Math.min(8, Math.trunc(limit)))) as { owner: LocalSearchDocument['owner']; object_id: string }[];
      let processed = 0, failed = 0;
      for (const item of batch) {
        if (cancelled()) break;
        try { db.transaction(() => {
          const projection = resolve(item.owner, item.object_id);
          if (projection) {
            if (projection.owner !== item.owner || projection.id !== item.object_id) throw Error('projection_identity_mismatch');
            replace(projection);
          } else remove(item.owner, item.object_id);
        })(); processed++; } catch { failed++; }
      }
      // SQLite's incremental merge page limit keeps maintenance out of a monolithic optimize/rebuild.
      if (processed && !cancelled()) db.prepare("INSERT INTO platform_local_search_fts(platform_local_search_fts,rank) VALUES('merge',2)").run();
      const pending = db.prepare('SELECT 1 FROM platform_local_search_dirty LIMIT 1').get() !== undefined;
      return { processed, failed, pending };
    },
  };
}

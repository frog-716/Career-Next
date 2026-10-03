import { expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { createLocalSearchIndex, localSearchMigration } from '../packages/backend/platform/search/public';

it('derived local search chunks are UTF8 bounded and edits/purge replace the projection without duplicate stale text', () => {
  const db = new Database(':memory:');
  try {
    db.exec(localSearchMigration);
    const index = createLocalSearchIndex(db), id = randomUUID();
    index.replace({ owner: 'wiki', id, revision: 1, title: '蒸牛蛙', body: '这是大中文正文。'.repeat(5000), scope: 'personal', active: true });
    const size = db.prepare('SELECT MAX(length(CAST(text AS BLOB))) AS bytes FROM platform_local_search_chunks').get() as { bytes: number };
    expect(size.bytes).toBeLessThanOrEqual(4096); expect(size.bytes).toBeGreaterThan(4000);
    index.replace({ owner: 'wiki', id, revision: 2, title: '改稿', body: 'new current body', scope: 'personal', active: true });
    expect(db.prepare('SELECT text FROM platform_local_search_chunks').all()).toEqual([{ text: '改稿\nnew current body' }]);
    index.remove('wiki', id);
    expect(db.prepare('SELECT count(*) AS n FROM platform_local_search_documents').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM platform_local_search_chunks').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM platform_local_search_fts').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});
it('maintenance uses at most eight exact owner projections, pauses between batches and leaves failed/unknown IDs visibly pending', () => {
  const db = new Database(':memory:');
  try {
    db.exec(localSearchMigration); const index = createLocalSearchIndex(db);
    const ids = Array.from({ length: 20 }, () => randomUUID());
    for (const id of ids) db.prepare('INSERT INTO platform_local_search_dirty VALUES (?,?)').run('wiki', id);
    const resolve = (_owner: 'wiki' | 'project' | 'opportunity', id: string) => ({ owner: 'wiki' as const, id, revision: 1, title: '中文条目', body: '只读派生索引', scope: 'personal', active: true });
    expect(index.maintenanceBatch(resolve, 100)).toEqual({ processed: 8, failed: 0, pending: true });
    expect(index.maintenanceBatch(resolve, 8, () => true)).toEqual({ processed: 0, failed: 0, pending: true });
    expect(index.maintenanceBatch(resolve, 8)).toEqual({ processed: 8, failed: 0, pending: true });
    expect(index.maintenanceBatch((_owner, id) => ({ ...resolve('wiki', id), owner: 'project' }), 8)).toEqual({ processed: 0, failed: 4, pending: true });
    expect(index.maintenanceBatch(resolve, 8)).toEqual({ processed: 4, failed: 0, pending: false });
  } finally { db.close(); }
});

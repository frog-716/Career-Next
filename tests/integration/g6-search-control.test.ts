import { beforeAll, expect, it } from 'vitest';
import { build } from 'vite';
import Database from 'better-sqlite3';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import path from 'node:path';
import { createLocalSearch, createLocalSearchIndex, localSearchMigration } from '../../packages/backend/platform/search/public';

const output = path.resolve('dist/g6-search-tests');
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  for (const [entry, file] of [['tests/g6-search-long-worker.ts', 'long.mjs'], ['packages/backend/platform/search/worker.ts', 'search.mjs']]) await build({ configFile: false, logLevel: 'error', build: { outDir: output, emptyOutDir: false, target: 'node24', lib: { entry, formats: ['es'], fileName: () => file }, rolldownOptions: { external: [/^node:/, 'better-sqlite3'] } } });
});
it('a timed-out actual native SQL reader is really terminated; closing search does not wait for the SQL to finish', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'career-g6-search-control-'));
  const db = new Database(path.join(root, 'career.sqlite')); db.exec('CREATE TABLE isolated(id INTEGER)'); db.close();
  const search = createLocalSearch(root, path.join(output, 'long.mjs'), { budget: { timeoutMs: 300 } });
  const result = await search.search({ operation: 'local-search.query', owner: 'wiki', query: '中文' });
  expect(result).toMatchObject({ partial: true, notice: '结果未完整检索' });
  expect(await readFile(path.join(root, 'career.sqlite.query-started'), 'utf8')).toBe('actual readonly native SQL began');
  const started = performance.now(); await search.close(); const closeMs = performance.now() - started;
  expect(closeMs).toBeLessThan(500);
  await writeFile(path.join(output, 'native-sql-evidence.json'), JSON.stringify({ root, timeoutMs: 300, closeMs, result }, null, 2));
}, 10000);
it('real SQLite EXCLUSIVE read contention reports partial failure while the independent local control callback remains responsive', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'career-g6-search-busy-'));
  const db = new Database(path.join(root, 'career.sqlite')); db.pragma('journal_mode=DELETE'); db.exec(localSearchMigration);
  const index = createLocalSearchIndex(db), id = randomUUID(); index.replace({ owner: 'wiki', id, revision: 1, title: '中文', body: '蒸牛蛙', scope: 'personal', active: true });
  const search = createLocalSearch(root, path.join(output, 'search.mjs'));
  try {
    db.exec('BEGIN EXCLUSIVE');
    const start = performance.now(); let localControlMs: number | undefined;
    const localControl = new Promise<void>(resolve => setImmediate(() => { localControlMs = performance.now() - start; resolve(); }));
    const result = await search.search({ operation: 'local-search.query', owner: 'wiki', query: '牛蛙' });
    await localControl;
    expect(localControlMs).toBeLessThan(500);
    expect(result).toMatchObject({ kind: 'local-search.failure', code: 'index_unavailable', partial: true, notice: '结果未完整检索' });
    db.exec('ROLLBACK');
    const recovered = await search.search({ operation: 'local-search.query', owner: 'wiki', query: '牛蛙' });
    expect(recovered.kind === 'local-search.results' ? recovered.items.map(item => item.id) : []).toEqual([id]);
    await writeFile(path.join(output, 'busy-evidence.json'), JSON.stringify({ root, journalMode: 'DELETE (controlled read-lock fault)', localControlMs, result, recovered }, null, 2));
  } finally { if (db.inTransaction) db.exec('ROLLBACK'); await search.close(); db.close(); }
});
it('native read, real SQLite backup and incremental FTS maintenance coexist; revoke kills the actual reader without waiting for backup', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'career-g6-search-concurrent-'));
  const db = new Database(path.join(root, 'career.sqlite')); db.pragma('journal_mode=WAL'); db.exec(localSearchMigration);
  const index = createLocalSearchIndex(db);
  const projections = Array.from({ length: 64 }, () => ({ owner: 'wiki' as const, id: randomUUID(), revision: 1, title: '中文积累', body: '中'.repeat(18000), scope: 'personal', active: true }));
  for (const doc of projections) { index.replace(doc); db.prepare('INSERT INTO platform_local_search_dirty VALUES (?,?)').run('wiki', doc.id); }
  const search = createLocalSearch(root, path.join(output, 'long.mjs'), { budget: { timeoutMs: 5000 } });
  const abort = new AbortController(); const query = search.search({ operation: 'local-search.query', owner: 'wiki', query: '罕' }, abort.signal);
  for (let count = 0; count < 200; count++) {
    if (await readFile(path.join(root, 'career.sqlite.query-started'), 'utf8').catch(() => '') !== '') break;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  expect(await readFile(path.join(root, 'career.sqlite.query-started'), 'utf8')).toContain('native SQL began');
  let backupFinished = false, progressCalls = 0, firstProgress!: () => void;
  const reached = new Promise<void>(resolve => { firstProgress = resolve; });
  const backup = db.backup(path.join(root, 'consistent-copy.sqlite'), { progress() { progressCalls++; firstProgress(); return 1; } }).then(() => { backupFinished = true; });
  try {
    await reached;
    const maintenance = index.maintenanceBatch((_owner, id) => projections.find(doc => doc.id === id), 8);
    expect(maintenance.processed).toBe(8); expect(maintenance.pending).toBe(true);
    const backupPendingAtRevoke = !backupFinished;
    expect(backupPendingAtRevoke).toBe(true);
    const start = performance.now(); abort.abort();
    const result = await query, revokeToExitMs = performance.now() - start;
    expect(result).toMatchObject({ kind: 'local-search.failure', code: 'cancelled', partial: true });
    expect(revokeToExitMs).toBeLessThan(500);
    await search.close(); await backup;
    const snapshot = new Database(path.join(root, 'consistent-copy.sqlite'), { readonly: true });
    try { expect(snapshot.pragma('integrity_check', { simple: true })).toBe('ok'); } finally { snapshot.close(); }
    await writeFile(path.join(output, 'concurrent-evidence.json'), JSON.stringify({ root, backupPendingAtRevoke, progressCalls, maintenance, revokeToExitMs, result, backupIntegrity: 'ok' }, null, 2));
  } finally { abort.abort(); await search.close(); await backup; db.close(); }
}, 20000);

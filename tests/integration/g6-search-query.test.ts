import { beforeAll, expect, it } from 'vitest';
import { build } from 'vite';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLocalSearch, createLocalSearchIndex, localSearchMigration } from '../../packages/backend/platform/search/public';
import { LocalSearchResult } from '../../packages/contracts/application/local-search';

const output = path.resolve('dist/g6-search-query');
const evidence: unknown[] = [];
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  await build({ configFile: false, logLevel: 'error', build: { outDir: output, emptyOutDir: false, target: 'node24', lib: { entry: 'packages/backend/platform/search/worker.ts', formats: ['es'], fileName: () => 'search.mjs' }, rolldownOptions: { external: [/^node:/, 'better-sqlite3'] } } });
});
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'career-g6-search-query-'));
  const db = new Database(path.join(root, 'career.sqlite')); db.pragma('journal_mode=WAL'); db.pragma('foreign_keys=ON'); db.exec(localSearchMigration);
  return { root, db, index: createLocalSearchIndex(db) };
}
async function record(value: unknown) { evidence.push(value); await writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2)); }

it('actual readonly chunk queries find Chinese one/two chars and trigram, finish a genuine no-match, and obey scope/active boundaries', async () => {
  const f = await fixture(), search = createLocalSearch(f.root, path.join(output, 'search.mjs'));
  try {
    const personal = randomUUID(), outside = randomUUID(), retired = randomUUID(), projectId = randomUUID();
    f.index.replace({ owner: 'wiki', id: personal, revision: 1, title: '中文经验', body: '蒸牛蛙与中文输入。abc123', scope: 'personal', active: true });
    f.index.replace({ owner: 'wiki', id: outside, revision: 1, title: '另一个范围', body: '蒸牛蛙 unrelated scoped body', scope: 'project', scopeId: projectId, active: true });
    f.index.replace({ owner: 'wiki', id: retired, revision: 1, title: '已退役', body: '蒸牛蛙 retired', scope: 'personal', active: false });
    for (const query of ['蛙', '牛蛙', '蒸牛蛙', 'ABC123', '没有匹配']) {
      const result = LocalSearchResult.parse(await search.search({ operation: 'local-search.query', owner: 'wiki', query, scope: 'personal' }));
      expect(result.kind).toBe('local-search.results'); if (result.kind !== 'local-search.results') throw Error();
      expect(result.partial).toBe(false); expect(result.notice).toBe('检索完成');
      expect(result.items.map(item => item.id)).toEqual(query === '没有匹配' ? [] : [personal]);
      expect(result.observed.rows).toBeLessThanOrEqual(256); expect(result.observed.bytes).toBeLessThanOrEqual(262144);
      await record({ query, scope: 'personal', result });
    }
    expect(await search.search({ operation: 'local-search.query', owner: 'wiki', query: '中文', sql: 'DROP TABLE anything' })).toMatchObject({ kind: 'local-search.failure', code: 'invalid_request' });
    const all = await search.search({ operation: 'local-search.query', owner: 'wiki', query: '蒸牛蛙', includeInactive: true });
    expect(all.kind === 'local-search.results' ? all.items.map(item => item.id).sort() : []).toEqual([personal, outside, retired].sort());
    const scoped = await search.search({ operation: 'local-search.query', owner: 'wiki', query: '蒸牛蛙', scope: 'project', scopeId: projectId });
    expect(scoped.kind === 'local-search.results' ? scoped.items.map(item => item.id) : []).toEqual([outside]);
    await record({ scenario: 'registered scope id', scoped });
  } finally { await search.close(); f.db.close(); }
});
it('large Chinese bodies stop at real row/UTF8 byte/comparison budgets and report incomplete rather than a false empty library', async () => {
  const f = await fixture();
  try {
    for (let n = 0; n < 8; n++) f.index.replace({ owner: 'wiki', id: randomUUID(), revision: 1, title: `大正文${n}`, body: '中'.repeat(64000), scope: 'personal', active: true });
    for (const budget of [{ rows: 20, bytes: 65536, comparisons: 50000 }, { rows: 100, bytes: 8192, comparisons: 50000 }, { rows: 100, bytes: 65536, comparisons: 100 }]) {
      const search = createLocalSearch(f.root, path.join(output, 'search.mjs'), { budget });
      try {
        const result = await search.search({ operation: 'local-search.query', owner: 'wiki', query: '罕' });
        expect(result.kind).toBe('local-search.results'); if (result.kind !== 'local-search.results') throw Error();
        expect(result.partial).toBe(true); expect(result.notice).toBe('结果未完整检索'); expect(result.items).toEqual([]);
        expect(result.observed.rows).toBeLessThanOrEqual(budget.rows);
        expect(result.observed.bytes).toBeLessThanOrEqual(budget.bytes);
        expect(result.observed.comparisons).toBeLessThanOrEqual(budget.comparisons);
        expect(result.cursor).toBeDefined(); await record({ scenario: 'large body partial', budget, result });
      } finally { await search.close(); }
    }
  } finally { f.db.close(); }
});
it('trigram matches survive a UTF8 chunk boundary; edits and permanent removal cannot leave searchable old snippets', async () => {
  const f = await fixture(), search = createLocalSearch(f.root, path.join(output, 'search.mjs'));
  try {
    const id = randomUUID(); f.index.replace({ owner: 'project', id, revision: 1, title: 'X', body: 'a'.repeat(4093) + '蒸牛蛙 abc123', scope: 'project', scopeId: id, active: true });
    const before = await search.search({ operation: 'local-search.query', owner: 'project', query: '蒸牛蛙' });
    expect(before.kind === 'local-search.results' ? before.items.map(item => item.id) : []).toEqual([id]);
    f.index.replace({ owner: 'project', id, revision: 2, title: 'new', body: 'replacement', scope: 'project', scopeId: id, active: true });
    const old = await search.search({ operation: 'local-search.query', owner: 'project', query: '蒸牛蛙' });
    expect(old).toMatchObject({ kind: 'local-search.results', items: [], partial: false });
    f.index.remove('project', id);
    const removed = await search.search({ operation: 'local-search.query', owner: 'project', query: 'replacement' });
    expect(removed).toMatchObject({ kind: 'local-search.results', items: [], partial: false }); await record({ scenario: 'boundary/edit/purge', before, old, removed });
  } finally { await search.close(); f.db.close(); }
});
it('a pending dirty projection is visibly incomplete and candidate/chunk cursors use indexed range plans', async () => {
  const f = await fixture(), search = createLocalSearch(f.root, path.join(output, 'search.mjs'));
  try {
    const id = randomUUID(); f.db.prepare('INSERT INTO platform_local_search_dirty VALUES (?,?)').run('wiki', id);
    expect(await search.search({ operation: 'local-search.query', owner: 'wiki', query: '未建立' })).toMatchObject({ kind: 'local-search.results', items: [], partial: true, notice: '结果未完整检索' });
    const docPlan = f.db.prepare('EXPLAIN QUERY PLAN SELECT object_id,revision,title FROM platform_local_search_documents WHERE owner=? AND active=1 AND object_id>=? ORDER BY object_id LIMIT 1').all('wiki', '') as { detail: string }[];
    const chunkPlan = f.db.prepare('EXPLAIN QUERY PLAN SELECT ordinal,text FROM platform_local_search_chunks WHERE owner=? AND object_id=? AND ordinal>=? ORDER BY ordinal LIMIT 1').all('wiki', id, 0) as { detail: string }[];
    expect(docPlan.some(row => row.detail.includes('SEARCH') && row.detail.includes('INDEX'))).toBe(true);
    expect(chunkPlan.some(row => row.detail.includes('SEARCH') && row.detail.includes('INDEX'))).toBe(true);
    expect([...docPlan, ...chunkPlan].some(row => row.detail.includes('SCAN '))).toBe(false); await record({ scenario: 'range plans', docPlan, chunkPlan });
  } finally { await search.close(); f.db.close(); }
});
it('a row-budget boundary between documents gives a usable continuation instead of restarting at the same first results', async () => {
  const f = await fixture(), search = createLocalSearch(f.root, path.join(output, 'search.mjs'), { budget: { rows: 4 } });
  try {
    const ids = Array.from({ length: 5 }, () => randomUUID()).sort();
    for (const id of ids) f.index.replace({ owner: 'project', id, revision: 1, title: '中', body: '中', scope: 'project', scopeId: id, active: true });
    let cursor: { objectId: string; ordinal: number } | undefined;
    const found = new Set<string>(), pages: unknown[] = [];
    for (let page = 0; page < 10; page++) {
      const result = await search.search({ operation: 'local-search.query', owner: 'project', query: '中', ...(cursor ? { cursor } : {}) });
      expect(result.kind).toBe('local-search.results'); if (result.kind !== 'local-search.results') throw Error();
      pages.push(result);
      for (const item of result.items) found.add(item.id);
      if (!result.partial) break;
      expect(result.cursor).toBeDefined(); cursor = result.cursor;
    }
    expect([...found].sort()).toEqual(ids);
    await record({ scenario: 'document boundary cursor', expectedIds: ids, pages });
  } finally { await search.close(); f.db.close(); }
});

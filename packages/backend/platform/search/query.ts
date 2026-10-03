import Database from 'better-sqlite3';
import { performance } from 'node:perf_hooks';
import type { LocalSearchBudget } from './client';
import { LocalSearchRequest, type LocalSearchResult } from '../../../contracts/application/local-search';

/** Only bounded derived projection chunks are read; owner JSON never enters a query. */
export function runLocalSearch(filename: string, input: unknown, budget: LocalSearchBudget): LocalSearchResult {
  const parsed = LocalSearchRequest.safeParse(input);
  if (!parsed.success) return { kind: 'local-search.failure', code: 'invalid_request', partial: true, notice: '结果未完整检索' };
  const request = parsed.data, started = performance.now(), needle = Array.from(request.query.toLocaleLowerCase('en-US'));
  const observed = { rows: 0, bytes: 0, comparisons: 0, elapsedMs: 0 };
  const items: Extract<LocalSearchResult, { kind: 'local-search.results' }>['items'] = [];
  const db = new Database(filename, { readonly: true, fileMustExist: true });
  let partial = false, cursor: { objectId: string; ordinal: number } | undefined;
  try {
    db.pragma('query_only = ON'); db.pragma('busy_timeout = 0');
    db.exec('BEGIN');
    const dirty = db.prepare('SELECT 1 FROM platform_local_search_dirty WHERE owner=? LIMIT 1').get(request.owner) !== undefined;
    const conditions = ['owner=?', 'object_id>=?'];
    const args: (string | number)[] = [request.owner, request.cursor?.objectId ?? ''];
    if (request.scope) { conditions.push('scope=?'); args.push(request.scope); }
    if (request.scopeId) { conditions.push('scope_id=?'); args.push(request.scopeId); }
    if (!request.includeInactive) conditions.push('active=1');
    const docs = db.prepare(`SELECT object_id,revision,title FROM platform_local_search_documents WHERE ${conditions.join(' AND ')} ORDER BY object_id LIMIT 1`);
    const fallback = db.prepare('SELECT ordinal,text FROM platform_local_search_chunks WHERE owner=? AND object_id=? AND ordinal>=? ORDER BY ordinal LIMIT 1');
    const fts = db.prepare(`SELECT c.ordinal,c.text FROM platform_local_search_fts JOIN platform_local_search_chunks c ON c.rowid=platform_local_search_fts.rowid
      WHERE platform_local_search_fts MATCH ? AND c.owner=? AND c.object_id=? AND c.ordinal>=? ORDER BY c.ordinal LIMIT 1`);
    const match = `"${request.query.replaceAll('"', '""')}"`;
    let after = request.cursor?.objectId ?? '', first = true;
    outer: while (true) {
      if (observed.rows >= budget.rows || observed.bytes + 2048 > budget.bytes || performance.now() - started >= budget.timeoutMs) { partial = true; break; }
      args[1] = after;
      const doc = docs.get(...args) as { object_id: string; revision: number; title: string } | undefined;
      if (!doc) { cursor = undefined; break; }
      observed.rows++; observed.bytes += Buffer.byteLength(doc.title) + Buffer.byteLength(doc.object_id) + 8;
      let ordinal = first && request.cursor?.objectId === doc.object_id ? request.cursor.ordinal : 0;
      first = false;
      while (true) {
        cursor = { objectId: doc.object_id, ordinal };
        if (observed.rows >= budget.rows || observed.bytes + 4096 > budget.bytes || observed.comparisons >= budget.comparisons || performance.now() - started >= budget.timeoutMs) { partial = true; break outer; }
        const row = (needle.length < 3 ? fallback.get(request.owner, doc.object_id, ordinal) : fts.get(match, request.owner, doc.object_id, ordinal)) as { ordinal: number; text: string } | undefined;
        if (!row) break;
        observed.rows++; observed.bytes += Buffer.byteLength(row.text);
        const chars = Array.from(row.text.toLocaleLowerCase('en-US'));
        let found = -1;
        for (let start = 0; start <= chars.length - needle.length; start++) {
          let index = 0;
          for (; index < needle.length; index++) {
            if (observed.comparisons >= budget.comparisons) { partial = true; break outer; }
            observed.comparisons++;
            if (chars[start + index] !== needle[index]) break;
          }
          if (index === needle.length) { found = start; break; }
        }
        ordinal = row.ordinal + 1; cursor = { objectId: doc.object_id, ordinal };
        if (found >= 0) {
          items.push({ owner: request.owner, id: doc.object_id, revision: doc.revision, title: doc.title, snippet: Array.from(row.text).slice(Math.max(0, found - 30), found + needle.length + 80).join('') });
          break;
        }
      }
      // Advance by a lexicographic sentinel, not OFFSET or an unconstrained LIKE.
      after = doc.object_id + '\u0000';
      cursor = { objectId: doc.object_id, ordinal: Number.MAX_SAFE_INTEGER };
      if (items.length >= budget.results) { partial = true; break; }
    }
    partial ||= dirty;
    observed.elapsedMs = performance.now() - started;
    return { kind: 'local-search.results', items, partial, notice: partial ? '结果未完整检索' : '检索完成', ...(cursor ? { cursor } : {}), observed };
  } finally { db.close(); }
}

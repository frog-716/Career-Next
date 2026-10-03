// Controlled actual native SQL attack adapter, excluded from the application.
import Database from 'better-sqlite3';
import { writeFileSync } from 'node:fs';
process.once('message', (input: { filename: string }) => {
  const db = new Database(input.filename, { readonly: true });
  db.pragma('query_only=ON');
  writeFileSync(input.filename + '.query-started', 'actual readonly native SQL began');
  db.prepare('WITH RECURSIVE counter(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM counter WHERE n<10000000) SELECT sum(n) FROM counter').get();
  process.send?.({ kind: 'local-search.failure', code: 'index_unavailable', partial: true, notice: '结果未完整检索' });
  db.close(); process.exit(0);
});

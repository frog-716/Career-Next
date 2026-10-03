// External fault-injection adapter; never an application entry or packaged file.
import { parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { openWorkspace } from '../../packages/backend/platform/database/database';
import { materialsMigration } from '../../packages/backend/domains/materials/migration';
import { releases } from '../../packages/backend/bootstrap/releases';
import { createWriterCommands } from '../../packages/backend/bootstrap/writer-commands';

const root: string = workerData.root;
const cut = process.env.G6_STORAGE_CUT;
function halt(point: string) {
  if (point !== cut) return;
  writeFileSync(path.join(root, 'g6-checkpoint.json'), JSON.stringify({ point }));
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
}
const workspace = await openWorkspace(root, materialsMigration, releases);
const db = workspace.database;
if (cut === 'sqlite-full') {
  db.exec(`CREATE TABLE g6_quota_probe (bytes BLOB);
    CREATE TRIGGER g6_force_page_allocation BEFORE INSERT ON materials_raw
    BEGIN INSERT INTO g6_quota_probe VALUES (zeroblob(1048576)); END;`);
}
let method = '';
// Instrument the actual adapter, not owner results. A kill inside the callback
// leaves a real SQLite transaction open; recovery uses the unmodified writer.
const prepare = db.prepare.bind(db);
db.prepare = ((sql: string) => {
  const statement = prepare(sql);
  const run = statement.run.bind(statement);
  statement.run = ((...args: unknown[]) => {
    if (method === 'commit' && sql.startsWith('INSERT INTO platform_artifact_retention')) halt('handoff-before');
    const result = run(...args);
    if (method === 'commit' && sql.startsWith('UPDATE platform_artifact_receipts SET status=\'committed\'')) halt('handoff-after');
    return result;
  }) as typeof statement.run;
  return statement;
}) as typeof db.prepare;
const transaction = db.transaction.bind(db);
db.transaction = ((work: (...args: unknown[]) => unknown) => transaction((...args: unknown[]) => {
  const result = work(...args);
  if (method === 'commit') halt('commit-before');
  return result;
})) as typeof db.transaction;
const store = createWriterCommands(db, workspace.workspaceInstance, workerData.generation);
parentPort!.postMessage({ ready: true });
let queue = Promise.resolve();
parentPort!.on('message', (message: { id: string; call?: { method: keyof typeof store; args: unknown[] }; close?: boolean }) => {
  queue = queue.then(async () => {
    try {
      if (message.close) { workspace.close(); parentPort!.postMessage({ id: message.id, result: true }); parentPort!.close(); return; }
      const call = message.call!;
      method = call.method;
      if (cut === 'sqlite-full' && method === 'prepare') {
        const pages = db.pragma('page_count', { simple: true });
        db.pragma(`max_page_count = ${pages}`);
      }
      const result = await (store[call.method] as (...args: unknown[]) => unknown)(...call.args);
      method = '';
      parentPort!.postMessage({ id: message.id, result });
    } catch (error) {
      method = '';
      const value = error as Error & { code?: string };
      writeFileSync(path.join(root, 'g6-adapter-error.json'), JSON.stringify({ code: value.code, message: value.message }));
      parentPort!.postMessage({ id: message.id, error: value.message === 'invalid_capability' ? value.message : 'db_failed' });
    }
  });
});

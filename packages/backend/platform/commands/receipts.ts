import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
export const commandMigration = `CREATE TABLE platform_commands (
 owner TEXT NOT NULL, command_id TEXT NOT NULL, payload_digest TEXT NOT NULL,
 result_json TEXT NOT NULL, recorded_at TEXT NOT NULL, PRIMARY KEY(owner,command_id));`;
function canonical(value: unknown): unknown {
 if(Array.isArray(value)) return value.map(canonical);
 if(value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
 return value;
}
export function commandReceipt(db: Database.Database, owner: string, commandId: string): unknown {
 const row = db.prepare('SELECT result_json FROM platform_commands WHERE owner=? AND command_id=?').get(owner, commandId) as {result_json: string} | undefined;
 return row ? JSON.parse(row.result_json) as unknown : undefined;
}
/** One short writer transaction includes the owner mutation and its replayable result. */
export function executeCommand<T>(db: Database.Database, owner: string, commandId: string, payload: unknown, operation: () => T): T {
 const digest = createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
 return db.transaction(() => {
  const old = db.prepare('SELECT payload_digest,result_json FROM platform_commands WHERE owner=? AND command_id=?').get(owner,commandId) as {payload_digest:string; result_json:string} | undefined;
  if(old) {if(old.payload_digest !== digest) throw new Error('conflict'); return JSON.parse(old.result_json) as T;}
  const result=operation();
  db.prepare('INSERT INTO platform_commands VALUES (?,?,?,?,?)').run(owner,commandId,digest,JSON.stringify(result),new Date().toISOString());
  return result;
 })();
}

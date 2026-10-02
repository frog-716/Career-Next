import Database from 'better-sqlite3';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ledgerMigration } from './ledger';
import { applyReleases, type MigrationBatch } from './migrations';

export async function openWorkspace(root: string, domainMigration: string, releases: readonly MigrationBatch[] = []) {
  // Separate lock file uses actual SQLite OS locks, held until this worker/connection exits.
  const lock = new Database(path.join(root, 'writer-lock.sqlite'));
  lock.pragma('busy_timeout = 0');
  try { lock.exec('BEGIN EXCLUSIVE'); } catch { lock.close(); throw new Error('workspace_busy'); }
  const database = new Database(path.join(root, 'career.sqlite'));
  try {
    database.pragma('journal_mode = WAL'); database.pragma('synchronous = FULL');
    database.pragma('foreign_keys = ON'); database.pragma('busy_timeout = 3000');
    const version = database.pragma('user_version', { simple: true });
    if (typeof version !== 'number' || version < 0 || version > releases.length + 1) throw new Error('db_failed');
    if (version === 0) database.transaction(() => {
      database.exec(`CREATE TABLE platform_workspace (instance TEXT PRIMARY KEY);
        CREATE TABLE platform_blobs (id TEXT PRIMARY KEY, digest TEXT NOT NULL, size INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('held','published','delete_claimed','deleted')));
        ${ledgerMigration}
        ${domainMigration}`);
      database.prepare('INSERT INTO platform_workspace VALUES (?)').run(randomUUID());
      database.pragma('user_version = 1');
    })();
    if(releases.length)await applyReleases(database,root,ledgerMigration+domainMigration,releases);
    const sqlite = database.prepare('SELECT sqlite_version() AS version').get() as { version: string };
    if (sqlite.version !== '3.53.4' || database.pragma('foreign_keys', { simple: true }) !== 1 || (database.prepare("SELECT sqlite_compileoption_used('ENABLE_FTS5') AS enabled").get() as {enabled: number}).enabled !== 1) throw new Error('db_failed');
    const workspaceInstance = (database.prepare('SELECT instance FROM platform_workspace').get() as { instance: string }).instance;
    return { database, workspaceInstance, close() { database.close(); lock.exec('ROLLBACK'); lock.close(); } };
  } catch (error) { database.close(); lock.close(); throw error; }
}

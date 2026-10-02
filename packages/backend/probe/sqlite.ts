// Disposable G0 table, never a Career schema or migration.
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

export async function probeTransaction(filename: string, write: boolean) {
  const sqlite = new Database(filename);
  const query = new Kysely<{ g0_probe: { value: number } }>({
    dialect: new SqliteDialect({ database: sqlite }),
  });
  try {
    sqlite.exec('CREATE TABLE IF NOT EXISTS g0_probe (value INTEGER NOT NULL)');
    if (write) sqlite.transaction(() => {
      sqlite.prepare('INSERT INTO g0_probe(value) VALUES (?)').run(1);
    })();
    const result = await query.selectFrom('g0_probe')
      .select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirstOrThrow();
    return { count: result.count, sqlite: sqlite.prepare('SELECT sqlite_version() AS version').get() as { version: string } };
  } finally { await query.destroy(); }
}

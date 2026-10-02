import { createHash, randomUUID } from 'node:crypto';
import { mkdir, cp, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
export interface MigrationFragment {id:string;dependencies:readonly string[];sql:string}
export interface MigrationBatch {version:number;name:string;fragments:readonly MigrationFragment[]}
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function applyReleases(database: Database.Database, root:string, legacySql:string, batches:readonly MigrationBatch[]) {
 const seen=new Set<string>();
 for(const [index,batch] of batches.entries()) {
  if(batch.version!==index+2||!/^\d{3}-/.test(batch.name))throw Error('migration_mismatch');
  for(const fragment of batch.fragments) {
   if(seen.has(fragment.id)||fragment.dependencies.some(id=>!seen.has(id)))throw Error('migration_mismatch');
   seen.add(fragment.id);
  }
 }
 const hasManifest=database.prepare("SELECT name FROM sqlite_master WHERE name='platform_migration_batches'").get();
 if(hasManifest) {
  const rows=database.prepare('SELECT version,name,checksum FROM platform_migration_batches ORDER BY version').all() as {version:number;name:string;checksum:string}[];
  for(const row of rows) {
   if(row.version===1) {if(row.checksum!==digest(legacySql))throw Error('migration_mismatch');continue;}
   const batch=batches.find(item=>item.version===row.version);
   if(!batch||row.name!==batch.name||row.checksum!==digest(batch))throw Error('migration_mismatch');
  }
 }
 const current=database.pragma('user_version',{simple:true}) as number;
 if(current===batches.length+1)return;
 // No request is admitted yet: one SQLite backup plus the immutable blob collection.
 const recovery=path.join(root,'recovery',`upgrade-${current}-${randomUUID()}`);
 await mkdir(recovery,{recursive:true,mode:0o700});
 await database.backup(path.join(recovery,'career.sqlite'));
 const blobs=path.join(root,'blobs');
 try {await stat(blobs);await cp(blobs,path.join(recovery,'blobs'),{recursive:true,errorOnExist:true,force:false});}
 catch(error) {if(!(error instanceof Error && 'code' in error && error.code==='ENOENT'))throw error;}
 await writeFile(path.join(recovery,'upgrade.json'),JSON.stringify({fromVersion:current,toVersion:batches.length+1}),{mode:0o600});
 const query=new Kysely<Record<string,never>>({dialect:new SqliteDialect({database})});
 const migrator=new Migrator({db:query,provider:{async getMigrations(){return Object.fromEntries(batches.map(batch=>[batch.name,{async up(){
  database.exec('CREATE TABLE IF NOT EXISTS platform_migration_batches(version INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,checksum TEXT NOT NULL);CREATE TABLE IF NOT EXISTS platform_migration_fragments(id TEXT PRIMARY KEY,batch_version INTEGER NOT NULL,checksum TEXT NOT NULL);');
  database.prepare('INSERT OR IGNORE INTO platform_migration_batches VALUES (1,?,?)').run('001-g1',digest(legacySql));
  for(const fragment of batch.fragments){database.exec(fragment.sql);database.prepare('INSERT INTO platform_migration_fragments VALUES (?,?,?)').run(fragment.id,batch.version,digest(fragment));}
  database.prepare('INSERT INTO platform_migration_batches VALUES (?,?,?)').run(batch.version,batch.name,digest(batch));
  database.pragma(`user_version = ${batch.version}`);
 }}]));}}});
 // Kysely's SQLite adapter does not enable DDL transactions. This sole startup
 // connection explicitly brackets the complete released batch and Kysely metadata.
 database.exec('BEGIN IMMEDIATE');
 try {
  const result=await migrator.migrateToLatest();
  if(result.error)throw Error('migration_failed');
  database.exec('COMMIT');
 }catch(error){database.exec('ROLLBACK');throw error;}
 // query borrows the native connection: the workspace, not Kysely.destroy(), closes it.
}


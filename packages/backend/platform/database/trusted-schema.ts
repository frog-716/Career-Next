import Database from 'better-sqlite3';
import {Kysely,SqliteDialect} from 'kysely';
import type {MigrationBatch} from './migrations';

interface SchemaObject {type:string;name:string;tbl_name:string;sql:string|null}
const schemaSql='SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name,tbl_name';
/** Preserve quoted identifiers/literals and punctuation; only unquoted case and whitespace vary. */
function sqlTokens(sql:string|null){
 if(sql===null)return null;
 const tokens:string[]=[];
 for(let index=0;index<sql.length;){
  const char=sql[index]!;
  if(/\s/.test(char)){index++;continue;}
  // Whitespace can end a line comment, so comment contents cannot be case/space normalized.
  if(sql.startsWith('--',index)){const start=index;while(index<sql.length&&!/[\r\n]/.test(sql[index]!))index++;tokens.push(sql.slice(start,index));continue;}
  if(sql.startsWith('/*',index)){const end=sql.indexOf('*/',index+2);if(end<0)throw Error('backup_schema_untrusted');tokens.push(sql.slice(index,end+2));index=end+2;continue;}
  if(char==="'"||char==='"'||char==='`'||char==='['){
   const start=index++,end=char==='['?']':char;let closed=false;
   while(index<sql.length){if(sql[index++]===end){if(end!==']'&&sql[index]===end){index++;continue;}closed=true;break;}}
   if(!closed)throw Error('backup_schema_untrusted');
   tokens.push(sql.slice(start,index));continue;
  }
  const token=/^[A-Za-z_][A-Za-z_0-9$]*|^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(sql.slice(index));
  if(token){tokens.push(token[0].toLowerCase());index+=token[0].length;}else{tokens.push(char);index++;}
 }
 return tokens;
}
function fingerprint(row:SchemaObject){return JSON.stringify([row.type,row.name,row.tbl_name,sqlTokens(row.sql)]);}
function objects(db:Database.Database){return db.prepare(schemaSql).all() as SchemaObject[];}

/** Accept only the complete released schema, never DDL supplied by a backup. */
export function createTrustedSchemaValidator(definition:{baseSql:string;releases:readonly MigrationBatch[];versions:readonly number[]}){
 const expected=new Map<number,{required:SchemaObject[];fingerprints:string[];statistics:Map<string,SchemaObject>}>();
 function reference(version:number){
  const cached=expected.get(version);if(cached)return cached;
  const db=new Database(':memory:');
  try{
   db.exec(definition.baseSql);
   // These are Platform's migration metadata, not duplicated Domain schemas.
   const query=new Kysely<Record<string,never>>({dialect:new SqliteDialect({database:db})});
   db.exec(query.schema.createTable('kysely_migration').addColumn('name','varchar(255)',col=>col.notNull().primaryKey()).addColumn('timestamp','varchar(255)',col=>col.notNull()).compile().sql);
   db.exec(query.schema.createTable('kysely_migration_lock').addColumn('id','varchar(255)',col=>col.notNull().primaryKey()).addColumn('is_locked','integer',col=>col.notNull().defaultTo(0)).compile().sql);
   db.exec('CREATE TABLE platform_migration_batches(version INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,checksum TEXT NOT NULL);CREATE TABLE platform_migration_fragments(id TEXT PRIMARY KEY,batch_version INTEGER NOT NULL,checksum TEXT NOT NULL);');
   for(const batch of definition.releases)if(batch.version<=version)for(const fragment of batch.fragments)db.exec(fragment.sql);
   const required=objects(db),fingerprints=required.map(fingerprint);
   db.exec('ANALYZE');
   // SQLite may add these optional optimizer tables. Their exact trusted structure is still checked.
   const statistics=new Map(objects(db).filter(row=>row.name==='sqlite_stat1'||row.name==='sqlite_stat4').map(row=>[row.name,row]));
   const value={required,fingerprints,statistics};expected.set(version,value);return value;
  }finally{db.close();}
 }
 return function assertTrustedSchema(candidate:Database.Database){
  const version=Number(candidate.pragma('user_version',{simple:true}));
  if(!definition.versions.includes(version))throw Error('backup_schema_invalid');
  const trusted=reference(version),rows=objects(candidate),actual=rows.filter(row=>!trusted.statistics.has(row.name));
  // Reject unknown objects and oversized DDL before tokenizing attacker-controlled SQL.
  if(actual.length!==trusted.required.length)throw Error('backup_schema_untrusted');
  function compare(row:SchemaObject,known:SchemaObject,value:string){
   if(row.type!==known.type||row.name!==known.name||row.tbl_name!==known.tbl_name||(row.sql?.length??0)>Math.max(16384,(known.sql?.length??0)*4))throw Error('backup_schema_untrusted');
   if(fingerprint(row)!==value)throw Error('backup_schema_untrusted');
  }
  for(const [index,row] of actual.entries())compare(row,trusted.required[index]!,trusted.fingerprints[index]!);
  for(const row of rows){const optional=trusted.statistics.get(row.name);if(optional)compare(row,optional,fingerprint(optional));}
 };
}

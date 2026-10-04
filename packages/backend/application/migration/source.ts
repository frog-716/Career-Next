import Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync,lstatSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {LegacyRecord} from './schema';
export const digest=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const expectedSchema=[{type:'index',name:'sqlite_autoindex_legacy_records_1',tbl_name:'legacy_records',sql:null},{type:'table',name:'legacy_records',tbl_name:'legacy_records',sql:'CREATE TABLE legacy_records(identity TEXT PRIMARY KEY,kind TEXT NOT NULL,body TEXT NOT NULL)'},{type:'table',name:'source_meta',tbl_name:'source_meta',sql:'CREATE TABLE source_meta(kind TEXT NOT NULL,version INTEGER NOT NULL)'}];
export const sourceSchemaDigest=digest(JSON.stringify(expectedSchema));
/** Explicit closed synthetic snapshot only. No discovery, config, old runtime or external calls. */
export function readSyntheticSource(filename:string,expectedDigest:string){
 if(realpathSync(filename)!==path.resolve(filename)||!lstatSync(filename).isFile()||lstatSync(filename).size>5*1024*1024||['-wal','-shm','-journal'].some(s=>existsSync(filename+s)))throw Error('source_snapshot_required');
 if(digest(readFileSync(filename))!==expectedDigest)throw Error('source_digest_changed');
 const db=new Database(filename,{readonly:true,fileMustExist:true,timeout:0});
 try{
  db.pragma('query_only=ON');
  const schema=db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all();
  if(db.pragma('user_version',{simple:true})!==1||JSON.stringify(schema)!==JSON.stringify(expectedSchema))throw Error('source_schema_invalid');
  const meta=db.prepare('SELECT kind,version FROM source_meta').all();if(JSON.stringify(meta)!==JSON.stringify([{kind:'synthetic-career-legacy',version:1}]))throw Error('source_schema_invalid');
  if(db.pragma('integrity_check',{simple:true})!=='ok')throw Error('source_schema_invalid');
  const rows=db.prepare('SELECT identity,kind,body FROM legacy_records ORDER BY identity').all() as {identity:string;kind:string;body:string}[];
  if(!rows.length||rows.length>1000)throw Error('source_record_invalid');
  const records=rows.map(row=>{const value=LegacyRecord.parse(JSON.parse(row.body));if(value.identity!==row.identity||value.kind!==row.kind)throw Error('source_record_invalid');return value;});
  if(digest(readFileSync(filename))!==expectedDigest)throw Error('source_digest_changed');
  return {digest:expectedDigest,schemaDigest:sourceSchemaDigest,version:1 as const,records};
 }finally{db.close();}
}

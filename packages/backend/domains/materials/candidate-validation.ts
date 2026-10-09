import {createImportTargets} from './targets';
import {ImportTarget} from '../../../contracts/materials/schema';
import type Database from 'better-sqlite3';
import {z} from 'zod';
import {RawSummary,MaterialOrigin,MAX_TEXT_BYTES} from '../../../contracts/materials/schema';
const Digest=z.string().regex(/^[a-f0-9]{64}$/);
const ImportMetadata=z.strictObject({id:z.uuid(),generation:z.string().min(1),connection:z.string().min(1),validity:z.number().int().positive(),state:z.enum(['preparing','preview','revoked','consumed']),name:z.string().max(255),digest:Digest.nullable(),size:z.number().int().min(0).max(MAX_TEXT_BYTES).nullable(),revision:z.literal(1)});
export function validateCandidate(db:Database.Database):void {
 const targets=createImportTargets(db);
 for(const table of ['materials_raw','materials_imports']){
  const available=(db.prepare(`PRAGMA table_info(${table})`).all() as {name:string}[]).some(column=>column.name==='origin_json');
  if(available)for(const row of db.prepare(`SELECT origin_json FROM ${table} WHERE origin_json IS NOT NULL`).all() as {origin_json:string}[])MaterialOrigin.parse(JSON.parse(row.origin_json));
 }
 for(const row of db.prepare('SELECT id,name,size,digest,blob_id,revision,scope,lifecycle,recorded_at FROM materials_raw').all() as {id:string;name:string;size:number;digest:string;blob_id:string;revision:number;scope:string;lifecycle:string;recorded_at:string}[]){const target=targets.read(row.id);if(row.scope!==target.kind)throw Error('invalid_candidate');RawSummary.parse({...(target.kind!=='personal'?{scopeId:target.id}:{}),id:row.id,name:row.name,size:row.size,revision:row.revision,scope:row.scope,lifecycle:row.lifecycle,recordedAt:row.recorded_at,source:{owner:'materials',objectId:row.id,revision:row.revision,locator:'whole',scope:row.scope,...target.kind!=='personal'?{scopeId:target.id}:{}}});z.uuid().parse(row.blob_id);Digest.parse(row.digest);if(row.size<0||row.size>MAX_TEXT_BYTES)throw Error('invalid_candidate');}
 for(const row of db.prepare('SELECT id,generation,connection,validity,state,name,digest,size,revision FROM materials_imports').all()){const value=ImportMetadata.parse(row);if(['preview','consumed'].includes(value.state)&&(value.digest===null||value.size===null))throw Error('invalid_candidate');}
}
export function candidateRelations(db:Database.Database):{owner:string;objectId:string;kind:'object'|'source'}[]{const targets=createImportTargets(db);return (db.prepare('SELECT id FROM materials_raw').all() as {id:string}[]).flatMap(row=>{const target=targets.read(row.id);return target.kind==='personal'?[]:[{owner:target.kind,objectId:target.id,kind:'object'}];});}

import type Database from 'better-sqlite3';
import {ImportTarget} from '../../../contracts/materials/schema';
export const importTargetMigration=`CREATE TABLE materials_raw_g5 (
 id TEXT PRIMARY KEY,name TEXT NOT NULL,size INTEGER NOT NULL,digest TEXT NOT NULL,blob_id TEXT NOT NULL REFERENCES platform_blobs(id),
 revision INTEGER NOT NULL CHECK(revision=1),scope TEXT NOT NULL CHECK(scope IN ('personal','company','opportunity','project','employment','person')),
 lifecycle TEXT NOT NULL CHECK(lifecycle='evidence-original'),recorded_at TEXT NOT NULL);
 INSERT INTO materials_raw_g5 SELECT * FROM materials_raw;
 DROP TABLE materials_raw;ALTER TABLE materials_raw_g5 RENAME TO materials_raw;
 CREATE TABLE materials_import_targets(import_id TEXT PRIMARY KEY,target_json TEXT NOT NULL);CREATE TABLE materials_raw_targets(material_id TEXT PRIMARY KEY,target_json TEXT NOT NULL);`;
export function createImportTargets(db:Database.Database){const available=()=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE name='materials_raw_targets'").get();return {
 read(id:string,kind:'import'|'raw'='raw'){if(!available())return ImportTarget.parse({kind:'personal'});const row=db.prepare(`SELECT target_json FROM materials_${kind}_targets WHERE ${kind==='import'?'import_id':'material_id'}=?`).get(id) as {target_json:string}|undefined;return row?ImportTarget.parse(JSON.parse(row.target_json)):ImportTarget.parse({kind:'personal'});},
 begin(id:string,target?:ImportTarget){if(target&&target.kind!=='personal'&&!available())throw Error('invalid_capability');if(available())db.prepare('INSERT INTO materials_import_targets VALUES(?,?)').run(id,JSON.stringify(target??{kind:'personal'}));},
 commit(importId:string,materialId:string){if(!available())return;const row=db.prepare('SELECT target_json FROM materials_import_targets WHERE import_id=?').get(importId) as {target_json:string}|undefined;if(row)db.prepare('INSERT INTO materials_raw_targets VALUES(?,?)').run(materialId,row.target_json);},
 purge(id:string,kind:'import'|'raw'='raw'){if(available())db.prepare(`DELETE FROM materials_${kind}_targets WHERE ${kind==='import'?'import_id':'material_id'}=?`).run(id);},
 };}

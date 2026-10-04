import type Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {Receipt} from './schema';
function receipts(db:Database.Database){
 if(!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='migration_import_receipts'").get())return [];
 return (db.prepare('SELECT plan_digest,body FROM migration_import_receipts').all() as {plan_digest:string;body:string}[]).map(row=>{
  const value=Receipt.parse(JSON.parse(row.body));if(value.planDigest!==row.plan_digest||createHash('sha256').update(JSON.stringify(value.manifest)).digest('hex')!==value.planDigest)throw Error('migration_receipt_invalid');return value;
 });
}
export function validateMigrationCandidate(db:Database.Database){receipts(db);}
export function migrationCandidateRelations(db:Database.Database){return receipts(db).flatMap(r=>r.mappings.map(m=>({owner:m.targetOwner,objectId:m.targetIdentity,kind:'object' as const})));}

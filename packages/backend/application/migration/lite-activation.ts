import type Database from 'better-sqlite3';
import {createProfileDomain} from '../../domains/profile/public';
import {validateBusinessCandidate,validateCandidateRelations} from '../../bootstrap/candidate-validation';
import {validateMigrationCandidate} from './candidate-validation';
import {Receipt} from './schema';
const excluded=['research_items','research_documents','ai_legacy_history','ai_tasks','ai_operations','ai_proposals','ai_product_tasks','ai_product_operations','ai_product_proposals','resume_versions','opportunity_submission','interview_sessions','opportunity_offer','opportunity_communication','opportunity_core_history','opportunity_company_history'];
export function assertLiteEmptyHistory(db:Database.Database){for(const table of excluded)if(db.prepare('SELECT 1 FROM sqlite_schema WHERE name=?').get(table)&&(db.prepare('SELECT COUNT(*) AS n FROM '+table).get() as {n:number}).n)throw Error('EXCLUDED_OBJECT_PRESENT');}
/** Must be called while holding the candidate's writer lock through pointer commit. */
export function assertLiteFingerprint(db:Database.Database,verified:{databaseDigest:string;workspaceInstance:string},currentDigest:string,hasNonemptyWal=false){
 if(hasNonemptyWal||currentDigest!==verified.databaseDigest||(db.prepare('SELECT instance FROM platform_workspace').get() as {instance:string}).instance!==verified.workspaceInstance)throw Error('STAGING_VERIFICATION_STALE');
}
export function assertLiteCandidate(db:Database.Database,expectedReceipt:unknown){
 validateBusinessCandidate(db);validateCandidateRelations(db);validateMigrationCandidate(db);assertLiteEmptyHistory(db);
 const receipt=Receipt.parse(expectedReceipt),rows=db.prepare('SELECT body FROM migration_import_receipts').all() as {body:string}[];
 if(rows.length!==1||JSON.stringify(Receipt.parse(JSON.parse(rows[0].body)))!==JSON.stringify(receipt)||receipt.manifest.adapterVersion!=='m-lite-primary-v1'||receipt.mappings.length!==8)throw Error('STAGING_VERIFICATION_STALE');
 for(const [table,count] of [['profile_current',1],['opportunity_company',2],['opportunity_core',3],['resume_documents',2]] as const)if((db.prepare('SELECT COUNT(*) AS n FROM '+table).get() as {n:number}).n!==count)throw Error('STAGING_VERIFICATION_STALE');
}
/** Exact trusted classification metadata only, never TEST-looking names. */
export function assertActiveReplaceable(db:Database.Database,snapshotDigest:string,classification?:{classification:'TEST';databaseDigest:string}){
 if(classification?.classification==='TEST'&&classification.databaseDigest===snapshotDigest)return;
 const profile=createProfileDomain(db).read();if(profile.revision!==0||profile.name||profile.contact||profile.links.length)throw Error('ACTIVE_REAL_DATA_CONFLICT');
 const system=new Set(['platform_workspace','kysely_migration','kysely_migration_lock','platform_migration_batches','platform_migration_fragments','profile_current','platform_local_search_fts_data','platform_local_search_fts_config']);
 for(const {name} of db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all() as {name:string}[])if(!system.has(name)&&(db.prepare('SELECT COUNT(*) AS n FROM '+name).get() as {n:number}).n)throw Error('ACTIVE_REAL_DATA_CONFLICT');
}

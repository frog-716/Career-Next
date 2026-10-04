import type Database from 'better-sqlite3';
import {Document,type OpportunityResolver} from '../../../contracts/resume/schema';
import {assertMigrationStaging,type StagingPermit} from '../../platform/persistence/migration-staging';
export function hasResumeSnapshots(db:Database.Database,permit:StagingPermit){assertMigrationStaging(permit,db);return !!db.prepare('SELECT 1 FROM resume_documents LIMIT 1').get();}
export function importResumeSnapshot(db:Database.Database,permit:StagingPermit,input:unknown,resolveOpportunity:OpportunityResolver['resolveOpportunity']){
 const value=Document.parse(input);assertMigrationStaging(permit,db,[{owner:'resume',objectId:value.id},{owner:'opportunity',objectId:value.opportunityId},{owner:'profile',objectId:'current'}]);if(value.revision!==1||!resolveOpportunity(value.opportunityId))throw Error('invalid_snapshot');
 db.prepare('INSERT INTO resume_documents VALUES (?,?,?,?,?)').run(value.id,value.opportunityId,value.revision,JSON.stringify(value.content),value.recordedAt);return value;
}

import type Database from 'better-sqlite3';
import {Opportunity,type Company} from '../../../../contracts/opportunity/schema';
import {assertMigrationStaging,type StagingPermit} from '../../../platform/persistence/migration-staging';
export function importOpportunitySnapshot(db:Database.Database,permit:StagingPermit,input:unknown,resolveCompany:(id:string)=>Company|undefined){
 const value=Opportunity.parse(input);assertMigrationStaging(permit,db,[{owner:'opportunity',objectId:value.id},{owner:'company',objectId:value.companyId}]);if(value.revision!==1||!resolveCompany(value.companyId))throw Error('invalid_snapshot');
 db.prepare('INSERT INTO opportunity_core VALUES (?,?,?,?)').run(value.id,value.companyId,value.revision,JSON.stringify(value));return value;
}

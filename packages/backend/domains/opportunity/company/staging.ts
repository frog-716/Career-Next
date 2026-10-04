import type Database from 'better-sqlite3';
import {Company} from '../../../../contracts/opportunity/schema';
import {assertMigrationStaging,type StagingPermit} from '../../../platform/persistence/migration-staging';
export function importCompanySnapshot(db:Database.Database,permit:StagingPermit,input:unknown){
 const value=Company.parse(input);assertMigrationStaging(permit,db,[{owner:'company',objectId:value.id}]);if(value.revision!==1)throw Error('invalid_snapshot');
 db.prepare('INSERT INTO opportunity_company VALUES (?,?,?)').run(value.id,value.revision,value.name);return value;
}

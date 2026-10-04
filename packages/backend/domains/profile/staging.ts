import type Database from 'better-sqlite3';
import {Profile} from '../../../contracts/profile/schema';
import {assertMigrationStaging,type StagingPermit} from '../../platform/persistence/migration-staging';
export function importProfileSnapshot(db:Database.Database,permit:StagingPermit,input:unknown){
 assertMigrationStaging(permit,db,[{owner:'profile',objectId:'current'}]);const value=Profile.parse(input),row=db.prepare('SELECT revision FROM profile_current WHERE id=1').get() as {revision:number};
 if(row.revision!==0||value.revision!==1)throw Error('staging_profile_conflict');
 db.prepare('UPDATE profile_current SET revision=?,body=? WHERE id=1').run(value.revision,JSON.stringify({name:value.name,contact:value.contact,links:value.links}));return value;
}

import type Database from 'better-sqlite3';
import {Company} from '../../../../contracts/opportunity/schema';
export function validateCandidate(db:Database.Database):void {
 const companies=new Map<string,Company>();
 for(const row of db.prepare('SELECT id,name,revision FROM opportunity_company').all()){const value=Company.parse(row);companies.set(value.id,value);}
 for(const row of db.prepare('SELECT company_id,revision,name FROM opportunity_company_history').all() as {company_id:string;revision:number;name:string}[]){const value=Company.parse({id:row.company_id,revision:row.revision,name:row.name});const current=companies.get(value.id);if(!current||value.revision>current.revision)throw Error('invalid_candidate');}
}
export function candidateRelations(_db:Database.Database):{owner:string;objectId:string;kind:'object'|'source'}[]{return [];}

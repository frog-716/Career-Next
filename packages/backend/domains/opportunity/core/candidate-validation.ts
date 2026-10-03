import type Database from 'better-sqlite3';
import {Opportunity,History} from '../../../../contracts/opportunity/schema';
export function validateCandidate(db:Database.Database):void {
 const opportunities=new Map<string,Opportunity>();const events=new Map<string,History>();
 for(const row of db.prepare('SELECT id,company_id,revision,content_json FROM opportunity_core').all() as {id:string;company_id:string;revision:number;content_json:string}[]){const value=Opportunity.parse(JSON.parse(row.content_json));if(value.id!==row.id||value.companyId!==row.company_id||value.revision!==row.revision)throw Error('invalid_candidate');opportunities.set(value.id,value);}
 for(const row of db.prepare('SELECT id,opportunity_id,revision,history_json FROM opportunity_core_history').all() as {id:string;opportunity_id:string;revision:number;history_json:string}[]){const value=History.parse(JSON.parse(row.history_json));const current=opportunities.get(row.opportunity_id);if(value.id!==row.id||value.opportunityId!==row.opportunity_id||value.revision!==row.revision||!current||row.revision>current.revision)throw Error('invalid_candidate');events.set(value.id,value);}
 for(const value of events.values())if(value.correctedEventId&&events.get(value.correctedEventId)?.opportunityId!==value.opportunityId)throw Error('invalid_candidate');
}

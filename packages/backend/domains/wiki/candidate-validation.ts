import type Database from 'better-sqlite3';
import {Knowledge,History} from '../../../contracts/wiki/schema';
import type {SourceRef} from '../../../contracts/common/source-ref';
function validateScope(value:Knowledge){if(['personal','cognition'].includes(value.scope)?value.scopeId!==undefined:!value.scopeId)throw Error('invalid_candidate');}
export function validateCandidate(db:Database.Database):void {
 const items=new Map<string,Knowledge>();
 for(const row of db.prepare('SELECT id,revision,status,content_json FROM wiki_knowledge').all() as {id:string;revision:number;status:string;content_json:string}[]){const value=Knowledge.parse(JSON.parse(row.content_json));validateScope(value);if(value.id!==row.id||value.revision!==row.revision||value.status!==row.status)throw Error('invalid_candidate');items.set(value.id,value);}
 for(const row of db.prepare('SELECT knowledge_id,revision,history_json FROM wiki_revisions').all() as {knowledge_id:string;revision:number;history_json:string}[]){const value=History.parse(JSON.parse(row.history_json));validateScope(value.knowledge);const current=items.get(row.knowledge_id);if(!current||value.knowledge.id!==row.knowledge_id||value.knowledge.revision!==row.revision||row.revision>current.revision)throw Error('invalid_candidate');}
}
export function candidateRelations(db:Database.Database):{owner:string;objectId:string;kind:'object'|'source';source?:SourceRef}[]{
 const relations:{owner:string;objectId:string;kind:'object'|'source';source?:SourceRef}[]=[];
 const append=(value:Knowledge)=>{if(value.scopeId)relations.push({owner:value.scope,objectId:value.scopeId,kind:'object'});for(const link of value.sources)relations.push({owner:link.ref.owner,objectId:link.ref.objectId,kind:'source',source:link.ref});};
 for(const row of db.prepare('SELECT content_json FROM wiki_knowledge').all() as {content_json:string}[])append(Knowledge.parse(JSON.parse(row.content_json)));
 for(const row of db.prepare('SELECT history_json FROM wiki_revisions').all() as {history_json:string}[])append(History.parse(JSON.parse(row.history_json)).knowledge);
 return relations;
}

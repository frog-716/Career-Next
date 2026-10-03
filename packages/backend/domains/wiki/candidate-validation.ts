import type Database from 'better-sqlite3';
import {z} from 'zod';
import {Knowledge,History,Scope} from '../../../contracts/wiki/schema';
import {SourceRef} from '../../../contracts/common/source-ref';
import type {Provenance} from '../../../contracts/common/provenance';
function provenanceSource(value:Provenance):SourceRef|undefined{
 if(value.owner==='wiki'){z.uuid().parse(value.objectId);const scope=Scope.parse(value.scope);if(['personal','cognition'].includes(scope)?value.scopeId!==undefined:!value.scopeId)throw Error('invalid_candidate');return;}
 if(value.owner==='search'){z.uuid().parse(value.objectId);if(!['company','opportunity'].includes(value.scope)||!value.scopeId||value.revision!==1)throw Error('invalid_candidate');return;}
 if(value.owner==='materials'){return SourceRef.parse({owner:value.owner,objectId:value.objectId,revision:value.revision,scope:value.scope,...value.scopeId?{scopeId:value.scopeId}:{},locator:'whole'});}
 if(value.owner==='interview'||value.owner==='communication')return SourceRef.parse({owner:value.owner,objectId:value.objectId,revision:value.revision,scope:value.scope,opportunityId:value.scopeId,locator:value.owner==='interview'?'transcript':'text'});
 throw Error('invalid_candidate');
}
function validateScope(value:Knowledge){if(['personal','cognition'].includes(value.scope)?value.scopeId!==undefined:!value.scopeId)throw Error('invalid_candidate');for(const input of value.trustedProvenance??[])provenanceSource(input);}
export function validateCandidate(db:Database.Database):void {
 const items=new Map<string,Knowledge>();
 for(const row of db.prepare('SELECT id,revision,status,content_json FROM wiki_knowledge').all() as {id:string;revision:number;status:string;content_json:string}[]){const value=Knowledge.parse(JSON.parse(row.content_json));validateScope(value);if(value.id!==row.id||value.revision!==row.revision||value.status!==row.status)throw Error('invalid_candidate');items.set(value.id,value);}
 for(const row of db.prepare('SELECT knowledge_id,revision,history_json FROM wiki_revisions').all() as {knowledge_id:string;revision:number;history_json:string}[]){const value=History.parse(JSON.parse(row.history_json));validateScope(value.knowledge);const current=items.get(row.knowledge_id);if(!current||value.knowledge.id!==row.knowledge_id||value.knowledge.revision!==row.revision||row.revision>current.revision)throw Error('invalid_candidate');}
}
export function candidateRelations(db:Database.Database):{owner:string;objectId:string;kind:'object'|'source';source?:SourceRef;provenance?:Provenance}[]{
 const relations:{owner:string;objectId:string;kind:'object'|'source';source?:SourceRef;provenance?:Provenance}[]=[];
 const append=(value:Knowledge)=>{if(value.scopeId)relations.push({owner:value.scope,objectId:value.scopeId,kind:'object'});for(const link of value.sources)relations.push({owner:link.ref.owner,objectId:link.ref.objectId,kind:'source',source:link.ref});for(const provenance of value.trustedProvenance??[]){const source=provenanceSource(provenance);relations.push({owner:provenance.owner,objectId:provenance.objectId,kind:source?'source':'object',...(source?{source}:{}),provenance});if(provenance.scopeId)relations.push({owner:provenance.scope,objectId:provenance.scopeId,kind:'object'});}};
 for(const row of db.prepare('SELECT content_json FROM wiki_knowledge').all() as {content_json:string}[])append(Knowledge.parse(JSON.parse(row.content_json)));
 for(const row of db.prepare('SELECT history_json FROM wiki_revisions').all() as {history_json:string}[])append(History.parse(JSON.parse(row.history_json)).knowledge);
 return relations;
}

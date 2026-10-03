import type Database from 'better-sqlite3';
import type {composeDomains} from './domain-registry';
import {createLocalSearchIndex,type LocalSearchDocument} from '../platform/search/public';
import {LocalSearchRequest} from '../../contracts/application/local-search';

/** Only owner public DTOs enter the index. This adapter owns no business rule or current value. */
export function composeLocalSearch(db:Database.Database,domains:ReturnType<typeof composeDomains>){
 const index=createLocalSearchIndex(db);
 function resolve(owner:LocalSearchDocument['owner'],id:string):LocalSearchDocument|undefined{
  if(owner==='wiki'){const result=domains.wiki.handle({operation:'read',id});if(result.kind!=='knowledge')return;const v=result.knowledge;return {owner,id,revision:v.revision,title:v.title,body:v.body,scope:v.scope,scopeId:v.scopeId,active:v.status==='active'};}
  if(owner==='project'){const result=domains.project.handle({operation:'read',id});if(result.kind!=='project')return;const v=result.project;return {owner,id,revision:v.revision,title:v.name,body:v.description,scope:'project',scopeId:id,active:v.state==='inprogress'||v.state==='paused'};}
  const v=domains.opportunity.capabilities.readOpportunity(id);if(!v)return;
  const company=domains.opportunity.capabilities.readCompany(v.companyId);
  return {owner,id,revision:v.revision,title:(company?.name??'')+' · '+v.role,body:v.jd??'',scope:'opportunity',scopeId:id,active:v.result==='active'};
 }
 return {
  maintenance:()=>index.maintenanceBatch(resolve),
  readable(input:unknown,results:readonly {owner:LocalSearchDocument['owner'];id:string;revision:number}[]){
   const request=LocalSearchRequest.parse(input);
   return results.filter(item=>{const current=resolve(item.owner,item.id);return current&&current.revision===item.revision&&(request.includeInactive||current.active)&&(!request.scope||current.scope===request.scope)&&(!request.scopeId||current.scopeId===request.scopeId);}).map(item=>item.id);
  },
  /** Called under the purge maintenance barrier, before compacting managed content. */
  discard(){
   db.transaction(()=>{db.exec('DELETE FROM platform_local_search_documents;DELETE FROM platform_local_search_dirty;DROP TABLE platform_local_search_fts;');
    db.exec("CREATE VIRTUAL TABLE platform_local_search_fts USING fts5(text,content='platform_local_search_chunks',content_rowid='rowid',tokenize='trigram');");
    db.exec("INSERT OR IGNORE INTO platform_local_search_dirty SELECT 'wiki',id FROM wiki_knowledge;INSERT OR IGNORE INTO platform_local_search_dirty SELECT 'project',id FROM project_current;INSERT OR IGNORE INTO platform_local_search_dirty SELECT 'opportunity',id FROM opportunity_core;");
   })();
  },
 };
}

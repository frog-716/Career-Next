import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { Request,Result,Knowledge,History,ErrorCode } from '../../../contracts/wiki/schema';
import { SourceRef,RawSummary } from '../../../contracts/materials/schema';
import { commandReceipt,executeCommand } from '../../platform/commands/receipts';
export interface WikiDependencies {resolveSource(source:SourceRef):RawSummary|undefined}
export function createWikiDomain(db:Database.Database,dependencies:WikiDependencies){
 function read(id:string){const row=db.prepare('SELECT content_json FROM wiki_knowledge WHERE id=?').get(id) as {content_json:string}|undefined;if(!row)throw Error('not_found');return Knowledge.parse(JSON.parse(row.content_json));}
 function validateSources(sources:Knowledge['sources']){
  for(const {ref} of sources){const found=RawSummary.safeParse(dependencies.resolveSource(ref));if(!found.success||found.data.id!==ref.objectId||found.data.revision!==ref.revision||found.data.scope!==ref.scope||JSON.stringify(found.data.source)!==JSON.stringify(ref))throw Error('source_unavailable');}
 }
 function persist(knowledge:Knowledge,change:History['change'],reason:string,businessTime:History['businessTime']){
  const item=History.parse({knowledge,change,reason,businessTime,recordedAt:knowledge.recordedAt});
  db.prepare('INSERT INTO wiki_knowledge VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,status=excluded.status,content_json=excluded.content_json').run(knowledge.id,knowledge.revision,knowledge.status,JSON.stringify(knowledge));
  db.prepare('INSERT INTO wiki_revisions VALUES (?,?,?)').run(knowledge.id,knowledge.revision,JSON.stringify(item));
  return Result.parse({kind:'knowledge',knowledge});
 }
 function handle(input:unknown):Result{
  const parsed=Request.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};const request=parsed.data;
  try{
   switch(request.operation){
    case 'read':return {kind:'knowledge',knowledge:read(request.id)};
    case 'list':{const rows=db.prepare(`SELECT content_json FROM wiki_knowledge ${request.includeRetired?'':"WHERE status='active'"} ORDER BY json_extract(content_json,'$.recordedAt') DESC,rowid DESC LIMIT 500`).all() as {content_json:string}[];return Result.parse({kind:'list',items:rows.map(row=>JSON.parse(row.content_json))});}
    case 'history':read(request.id);return Result.parse({kind:'history',items:(db.prepare('SELECT history_json FROM wiki_revisions WHERE knowledge_id=? ORDER BY revision DESC').all(request.id) as {history_json:string}[]).map(row=>JSON.parse(row.history_json))});
    case 'receipt':{const old=commandReceipt(db,'wiki',request.commandId);return old===undefined?{kind:'receipt_missing'}:Result.parse(old);}
    case 'create':return executeCommand(db,'wiki',request.commandId,request,()=>{validateSources(request.sources);return persist(Knowledge.parse({id:randomUUID(),title:request.title,body:request.body,scope:request.scope,nature:request.nature,sources:request.sources,revision:1,status:'active',recordedBy:'user',verification:'not_verified',recordedAt:new Date().toISOString()}),'created','用户手工记录',{kind:'unknown'});});
    case 'edit':return executeCommand(db,'wiki',request.commandId,request,()=>{const old=read(request.id);if(old.revision!==request.expectedRevision)throw Error('conflict');validateSources(request.sources);return persist({...old,title:request.title,body:request.body,scope:request.scope,nature:request.nature,sources:request.sources,revision:old.revision+1,recordedAt:new Date().toISOString()},request.change,request.reason,request.businessTime);});
    case 'lifecycle':return executeCommand(db,'wiki',request.commandId,request,()=>{const old=read(request.id);if(old.revision!==request.expectedRevision)throw Error('conflict');const status=request.action==='retire'?'retired':'active';if(old.status===status)throw Error('conflict');return persist({...old,status,revision:old.revision+1,recordedAt:new Date().toISOString()},request.correction?'corrected':request.action==='retire'?'retired':'restored',request.reason,request.businessTime);});
   }
  }catch(error){const code=ErrorCode.safeParse(error instanceof Error?error.message:'storage_failed');return {kind:'failure',code:code.success?code.data:'storage_failed'};}
 }
 return {handle};
}

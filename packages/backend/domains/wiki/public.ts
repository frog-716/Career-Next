import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { Request,Result,Knowledge,History,ErrorCode } from '../../../contracts/wiki/schema';
import type {SourceRef,SourceMetadata} from '../../../contracts/common/source-ref';
import { commandReceipt,executeCommand } from '../../platform/commands/receipts';
export interface WikiDependencies {resolveSource(source:SourceRef):SourceMetadata|undefined;validateScope?(scope:Knowledge['scope'],id?:string):boolean}
export function createWikiDomain(db:Database.Database,dependencies:WikiDependencies){
 function read(id:string){const row=db.prepare('SELECT content_json FROM wiki_knowledge WHERE id=?').get(id) as {content_json:string}|undefined;if(!row)throw Error('not_found');return projectSupport(Knowledge.parse(JSON.parse(row.content_json)));}
 function projectSupport(item:Knowledge):Knowledge{return {...item,reviewRequired:item.sources.some(({ref})=>{const current=dependencies.resolveSource(ref);return !current||current.revision!==ref.revision||current.source.owner!==ref.owner||current.source.objectId!==ref.objectId||current.source.locator!==ref.locator||current.source.scope!==ref.scope;})};}
 function validateSources(sources:Knowledge['sources']){
  for(const {ref} of sources){const found=dependencies.resolveSource(ref);if(!found||found.id!==ref.objectId||found.revision!==ref.revision||found.scope!==ref.scope||found.source.owner!==ref.owner||found.source.objectId!==ref.objectId||found.source.locator!==ref.locator)throw Error('source_unavailable');}
 }
 function persist(knowledge:Knowledge,change:History['change'],reason:string,businessTime:History['businessTime']){
  const item=History.parse({knowledge,change,reason,businessTime,recordedAt:knowledge.recordedAt});
  db.prepare('INSERT INTO wiki_knowledge VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,status=excluded.status,content_json=excluded.content_json').run(knowledge.id,knowledge.revision,knowledge.status,JSON.stringify(knowledge));
  db.prepare('INSERT INTO wiki_revisions VALUES (?,?,?)').run(knowledge.id,knowledge.revision,JSON.stringify(item));
  return Result.parse({kind:'knowledge',knowledge:projectSupport(knowledge)});
 }
 function handle(input:unknown,origin:Knowledge['origin']='manual'):Result{
  const parsed=Request.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};const request=parsed.data;
  try{
   if('scope' in request&&request.operation!=='list'){const local=['personal','cognition'].includes(request.scope);if(local?request.scopeId!==undefined:!request.scopeId)throw Error('scope_unavailable');if(!local&&!dependencies.validateScope?.(request.scope,request.scopeId))throw Error('scope_unavailable');}
   switch(request.operation){
    case 'read':return {kind:'knowledge',knowledge:read(request.id)};
    case 'list':{const rows=db.prepare(`SELECT content_json FROM wiki_knowledge ${request.includeRetired?'':"WHERE status='active'"} ORDER BY json_extract(content_json,'$.recordedAt') DESC,rowid DESC LIMIT 500`).all() as {content_json:string}[];return Result.parse({kind:'list',items:rows.map(row=>projectSupport(Knowledge.parse(JSON.parse(row.content_json)))).filter(item=>request.scope?item.scope===request.scope&&item.scopeId===request.scopeId:item.scope!=='opportunity')});}
    case 'history':read(request.id);return Result.parse({kind:'history',items:(db.prepare('SELECT history_json FROM wiki_revisions WHERE knowledge_id=? ORDER BY revision DESC').all(request.id) as {history_json:string}[]).map(row=>JSON.parse(row.history_json))});
    case 'receipt':{const old=commandReceipt(db,'wiki',request.commandId);return old===undefined?{kind:'receipt_missing'}:Result.parse(old);}
    case 'create':return executeCommand(db,'wiki',request.commandId,request,()=>{validateSources(request.sources);return persist(Knowledge.parse({id:randomUUID(),title:request.title,body:request.body,scope:request.scope,...request.scopeId?{scopeId:request.scopeId}:{},origin,nature:request.nature,sources:request.sources,revision:1,status:'active',recordedBy:'user',verification:'not_verified',recordedAt:new Date().toISOString()}),'created','用户手工记录',{kind:'unknown'});});
    case 'edit':return executeCommand(db,'wiki',request.commandId,request,()=>{const old=read(request.id);if(old.revision!==request.expectedRevision)throw Error('conflict');validateSources(request.sources);return persist({...old,title:request.title,body:request.body,scope:request.scope,...request.scopeId?{scopeId:request.scopeId}:{},origin,nature:request.nature,sources:request.sources,revision:old.revision+1,recordedAt:new Date().toISOString()},request.change,request.reason,request.businessTime);});
    case 'lifecycle':return executeCommand(db,'wiki',request.commandId,request,()=>{const old=read(request.id);if(old.revision!==request.expectedRevision)throw Error('conflict');const status=request.action==='retire'?'retired':'active';if(old.status===status)throw Error('conflict');return persist({...old,status,revision:old.revision+1,recordedAt:new Date().toISOString()},request.correction?'corrected':request.action==='retire'?'retired':'restored',request.reason,request.businessTime);});
   }
  }catch(error){const code=ErrorCode.safeParse(error instanceof Error?error.message:'storage_failed');return {kind:'failure',code:code.success?code.data:'storage_failed'};}
 }
 return {handle,read(id:string){try{return read(id);}catch{return undefined;}},applyProposal(input:unknown){const result=handle(input,'ai_accepted');if(result.kind!=='knowledge')throw Error(result.kind==='failure'?result.code:'storage_failed');return result.knowledge;}};
}

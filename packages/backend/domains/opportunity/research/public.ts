import {sourceScope} from '../../../../contracts/common/source-ref';
import type {Provenance} from '../../../../contracts/common/provenance';
import {redactOwnerReceipts} from '../../../platform/commands/purge-receipts';
import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {Request,Result,ErrorCode,Item,Owner,Resolution,History,type Source} from '../../../../contracts/opportunity/research/schema';
import type {SourceRef} from '../../../../contracts/common/source-ref';
import type {OpportunityCapabilities} from '../../../../contracts/opportunity/capabilities';
import {executeCommand,commandReceipt} from '../../../platform/commands/receipts';
export {researchMigration} from './migration';
export interface ResearchDependencies{core:OpportunityCapabilities;provenanceCurrent?:(input:Provenance)=>{revision:number}|undefined;resolveSource?:(ref:SourceRef)=>{ref:SourceRef;status:'readable'|'unavailable'|'stale';scope?:Owner|{kind:'personal'}}|undefined;}
export function createResearchDomain(db:Database.Database,dependencies:ResearchDependencies){
 const same=(a:Owner,b:Owner)=>a.kind===b.kind&&a.id===b.id;
 function ensureOwner(owner:Owner){if(owner.kind==='company'?!dependencies.core.readCompany(owner.id):!dependencies.core.readOpportunity(owner.id))throw Error('not_found');}
 function current(id:string){const row=db.prepare('SELECT item_json FROM research_items WHERE id=?').get(id) as {item_json:string}|undefined;return row?Item.parse(JSON.parse(row.item_json)):undefined;}
 function documentRevision(owner:Owner){return (db.prepare('SELECT revision FROM research_documents WHERE owner_kind=? AND owner_id=?').get(owner.kind,owner.id) as {revision:number}|undefined)?.revision??0;}
 function touch(owner:Owner){db.prepare('INSERT INTO research_documents VALUES(?,?,1) ON CONFLICT(owner_kind,owner_id) DO UPDATE SET revision=revision+1').run(owner.kind,owner.id);}
 function sourceStatus(source:Source,owner:Owner){const resolved=dependencies.resolveSource?.(source.ref);if(!resolved||resolved.status==='unavailable')return 'unavailable' as const;if(resolved.ref.owner!==source.ref.owner||resolved.ref.objectId!==source.ref.objectId||resolved.ref.revision!==source.ref.revision||resolved.ref.locator!==source.ref.locator||resolved.ref.scope!==source.ref.scope||resolved.status==='stale')return 'stale' as const;const scope=resolved.scope??(sourceScope(source.ref));if(scope.kind==='personal'&&owner.kind==='company')return 'unavailable' as const;if(scope.kind!=='personal'&&(scope.kind!==owner.kind||!('id'in scope)||scope.id!==owner.id))return 'unavailable' as const;return 'readable' as const;}
 function validateSources(sources:Source[],owner:Owner){for(const source of sources){if(sourceStatus(source,owner)!=='readable')throw Error('source_unavailable');}}
 function resolveItem(input:{id:string;revision?:number;viewer:Owner}):Resolution|undefined{
  const latest=current(input.id);if(!latest)return;ensureOwner(input.viewer);let item=latest;
  if(input.revision!==undefined&&input.revision!==latest.revision){const row=db.prepare('SELECT history_json FROM research_history WHERE item_id=? AND revision=?').get(input.id,input.revision) as {history_json:string}|undefined;if(!row)return;item=History.parse(JSON.parse(row.history_json)).item;}
  const viewerOpportunity=input.viewer.kind==='opportunity'?dependencies.core.readOpportunity(input.viewer.id):undefined;
  const allowed=same(item.owner,input.viewer)||(item.owner.kind==='company'&&viewerOpportunity?.companyId===item.owner.id);
  if(!allowed)return;
  const sources=item.sources.map(source=>({source,status:sourceStatus(source,input.viewer.kind==='company'?input.viewer:item.owner)}));
  return Resolution.parse({item,sources,reviewRequired:sources.some(s=>s.status!=='readable'||s.source.assessment==='needs_review')||(item.trustedProvenance??[]).some(p=>{const current=dependencies.provenanceCurrent?.(p);return !current||current.revision!==p.revision;}),editable:same(latest.owner,input.viewer)&&item.revision===latest.revision});
 }
 function save(item:Item,action:'created'|'corrected'|'supplemented'|'withdrawn'|'restored'|'promoted',reason='',businessTime:History['businessTime']={kind:'unknown'}){
  db.prepare('INSERT INTO research_items VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner_kind=excluded.owner_kind,owner_id=excluded.owner_id,revision=excluded.revision,item_json=excluded.item_json').run(item.id,item.owner.kind,item.owner.id,item.revision,JSON.stringify(item));
  const history={item,action,reason,businessTime,recordedAt:new Date().toISOString()};db.prepare('INSERT INTO research_history VALUES(?,?,?)').run(item.id,item.revision,JSON.stringify(history));return Result.parse({kind:'item',item});
 }
 function handle(input:unknown):Result{const parsed=Request.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};const r=parsed.data;try{
  if(r.operation==='receipt'){const receipt=commandReceipt(db,'research',r.commandId);return receipt===undefined?{kind:'receipt_missing'}:Result.parse(receipt);}
  if(r.operation==='resolve'){const resolution=resolveItem(r);return resolution?{kind:'resolution',resolution}:{kind:'failure',code:'not_found'};}
  if(r.operation==='read'){ensureOwner(r.owner);const items=(db.prepare('SELECT id FROM research_items WHERE owner_kind=? AND owner_id=?').all(r.owner.kind,r.owner.id) as {id:string}[]).map(({id})=>resolveItem({id,viewer:r.owner})!);const references=r.owner.kind==='opportunity'?(db.prepare('SELECT * FROM research_references WHERE opportunity_id=?').all(r.owner.id) as {item_id:string;origin_revision:number;company_id:string}[]).map(row=>({itemId:row.item_id,originRevision:row.origin_revision,owner:{kind:'company' as const,id:row.company_id},originOwner:r.owner})):[];return {kind:'document',owner:r.owner,revision:documentRevision(r.owner),items,references};}
  if(r.operation==='history'){ensureOwner(r.owner);const item=current(r.id);if(!item)throw Error('not_found');const histories=(db.prepare('SELECT history_json FROM research_history WHERE item_id=? ORDER BY revision DESC').all(r.id) as {history_json:string}[]).map(row=>History.parse(JSON.parse(row.history_json))).filter(h=>same(h.item.owner,r.owner));if(!histories.length)throw Error('not_found');return {kind:'history',items:histories};}
  return executeCommand(db,'research',r.commandId,r,()=>{ensureOwner(r.owner);if(r.operation==='create'){validateSources(r.sources,r.owner);touch(r.owner);return save(Item.parse({id:randomUUID(),owner:r.owner,revision:1,title:r.title,body:r.body,nature:r.nature,sources:r.sources,leads:r.leads,userConfirmed:r.userConfirmed,independentlyVerified:r.independentlyVerified,active:true,recordedAt:new Date().toISOString()}),'created');}
   const old=current(r.id);if(!old||!same(old.owner,r.owner))throw Error('not_found');if(old.revision!==r.expectedRevision)throw Error('conflict');let item:Item={...old,revision:old.revision+1,recordedAt:new Date().toISOString()};
   if(r.operation==='correct'){validateSources(r.sources,r.owner);item={...item,title:r.title,body:r.body,nature:r.nature,sources:r.sources,leads:r.leads,userConfirmed:false,independentlyVerified:false};touch(r.owner);return save(item,'corrected',r.reason,r.businessTime);}
   if(r.operation==='supplement'){validateSources(r.sources,r.owner);item={...item,sources:r.sources,leads:r.leads,userConfirmed:r.userConfirmed,independentlyVerified:r.independentlyVerified};touch(r.owner);return save(item,'supplemented',r.reason,r.businessTime);}
   if(r.operation==='lifecycle'){if(old.active===(r.action==='restore'))throw Error('invalid_transition');item.active=r.action==='restore';touch(r.owner);return save(item,r.action==='restore'?'restored':'withdrawn',r.reason,r.businessTime);}
   if(r.owner.kind!=='opportunity'||!old.active)throw Error('invalid_transition');const opportunity=dependencies.core.readOpportunity(r.owner.id);if(opportunity?.companyId!==r.companyId||!dependencies.core.readCompany(r.companyId))throw Error('scope_mismatch');const target:Owner={kind:'company',id:r.companyId};if(documentRevision(target)!==r.expectedCompanyDocumentRevision)throw Error('conflict');const existing=(db.prepare('SELECT item_json FROM research_items WHERE owner_kind=? AND owner_id=?').all(target.kind,target.id) as {item_json:string}[]).map(row=>Item.parse(JSON.parse(row.item_json)));if(existing.some(other=>other.active&&other.title===old.title))throw Error('conflict');touch(target);touch(r.owner);item.owner=target;item.sources=old.sources.map(source=>sourceStatus(source,target)==='readable'?source:{...source,purpose:'私有来源；共享不扩大读取权限',excerpt:'',assessment:'needs_review'});
   db.prepare('INSERT INTO research_references VALUES(?,?,?,?)').run(r.owner.id,item.id,old.revision,r.companyId);return save(item,'promoted',r.reason,r.businessTime);
  });
 }catch(error){const parsed=ErrorCode.safeParse(error instanceof Error?error.message:'storage_failed');return {kind:'failure',code:parsed.success?parsed.data:'storage_failed'};}}
 function referencing(ref:{owner:string;objectId:string}){
  const results=new Map<string,{id:string;title:string;revision:number;referencingRevisions:number[];historical:boolean}>();
  const matches=(item:Item)=>item.sources.some(source=>source.ref.owner===ref.owner&&source.ref.objectId===ref.objectId)||!!item.trustedProvenance?.some(p=>p.owner===ref.owner&&p.objectId===ref.objectId);
  for(const row of db.prepare('SELECT item_json FROM research_items').all() as {item_json:string}[]){const item=Item.parse(JSON.parse(row.item_json));if(matches(item))results.set(item.id,{id:item.id,title:item.title,revision:item.revision,referencingRevisions:[item.revision],historical:false});}
  for(const row of db.prepare('SELECT history_json FROM research_history').all() as {history_json:string}[]){const item=History.parse(JSON.parse(row.history_json)).item;if(!matches(item))continue;const live=current(item.id);if(!live)continue;const existing=results.get(item.id);if(existing){if(!existing.referencingRevisions.includes(item.revision))existing.referencingRevisions.push(item.revision);}else results.set(item.id,{id:item.id,title:live.title,revision:live.revision,referencingRevisions:[item.revision],historical:true});}
  return [...results.values()];
 }
 function redactSource(ref:{owner:string;objectId:string}){
  const affected=new Set<string>(),owners=new Map<string,Owner>();
  const matches=(item:Item)=>item.sources.some(source=>source.ref.owner===ref.owner&&source.ref.objectId===ref.objectId);
  const redact=(item:Item):Item=>({...item,sources:item.sources.map(source=>source.ref.owner===ref.owner&&source.ref.objectId===ref.objectId?{...source,excerpt:'',assessment:'needs_review' as const}:source)});
  for(const row of db.prepare('SELECT id,item_json FROM research_items').all() as {id:string;item_json:string}[]){const item=Item.parse(JSON.parse(row.item_json));if(!matches(item))continue;affected.add(item.id);owners.set(item.owner.kind+':'+item.owner.id,item.owner);db.prepare('UPDATE research_items SET item_json=? WHERE id=?').run(JSON.stringify(redact(item)),item.id);}
  // Histories own their stored support even when current content references another source.
  for(const row of db.prepare('SELECT item_id,revision,history_json FROM research_history').all() as {item_id:string;revision:number;history_json:string}[]){const history=History.parse(JSON.parse(row.history_json));if(!matches(history.item))continue;affected.add(row.item_id);owners.set(history.item.owner.kind+':'+history.item.owner.id,history.item.owner);db.prepare('UPDATE research_history SET history_json=? WHERE item_id=? AND revision=?').run(JSON.stringify({...history,item:redact(history.item)}),row.item_id,row.revision);}
  for(const owner of owners.values())touch(owner);
  // Also cover a retained receipt whose source no longer appears in current/history content.
  redactOwnerReceipts(db,'research',[...affected,ref.objectId],{kind:'failure',code:'content_purged'});redactOwnerReceipts(db,'research.proposal',[...affected,ref.objectId],{kind:'failure',code:'content_purged'});
 }
 function applyProposal(input:{commandId:string;owner:Owner;title:string;body:string;sources:Source[];provenance:Provenance[]}){
  return executeCommand(db,'research.proposal',input.commandId,input,()=>{ensureOwner(input.owner);validateSources(input.sources,input.owner);if(input.provenance.some(p=>p.kind==='simulation'||!p.restrictions.read||!p.restrictions.egress))throw Error('source_unavailable');const document=handle({operation:'read',owner:input.owner});if(document.kind!=='document')throw Error('not_found');if(document.items.some(r=>r.item.active&&r.item.title===input.title))throw Error('conflict');touch(input.owner);return save(Item.parse({id:randomUUID(),owner:input.owner,revision:1,title:input.title,body:input.body,nature:'inference',sources:input.sources,leads:[],origin:'ai_accepted',trustedProvenance:input.provenance,userConfirmed:true,independentlyVerified:false,active:true,recordedAt:new Date().toISOString()}),'created');});
 }
 return {handle,applyProposal,resolveItem,redactSource,purgeImpact(id:string){const item=current(id);return item?{id,revision:item.revision,name:item.title,blobIds:[],retentions:[]}:undefined;},referencing,purge(id:string){const item=current(id);db.prepare('DELETE FROM research_references WHERE item_id=?').run(id);db.prepare('DELETE FROM research_history WHERE item_id=?').run(id);db.prepare('DELETE FROM research_items WHERE id=?').run(id);if(item)touch(item.owner);redactOwnerReceipts(db,'research',[id],{kind:'failure',code:'content_purged'});redactOwnerReceipts(db,'research.proposal',[id],{kind:'failure',code:'content_purged'});}};
}

export {validateCandidate,candidateRelations} from './candidate-validation';

export {createResearchAiPolicy} from './ai-policy';

import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {Opportunity,OpportunityView,CoreRequest,Result,History,type Company} from '../../../../contracts/opportunity/schema';
import type {BusinessTime} from '../../../../contracts/common/business-time';
import {redactOwnerReceipts} from '../../../platform/commands/purge-receipts';
import {executeCommand} from '../../../platform/commands/receipts';
import { z } from 'zod';
import { BusinessTime as BusinessTimeSchema } from '../../../../contracts/common/business-time';
import type { OpportunityCapabilities } from '../../../../contracts/opportunity/capabilities';
export const coreMigration=`CREATE TABLE opportunity_core(id TEXT PRIMARY KEY,company_id TEXT NOT NULL REFERENCES opportunity_company(id),revision INTEGER NOT NULL,content_json TEXT NOT NULL);
CREATE TABLE opportunity_core_history(id TEXT PRIMARY KEY,opportunity_id TEXT NOT NULL REFERENCES opportunity_core(id),revision INTEGER NOT NULL,history_json TEXT NOT NULL,UNIQUE(opportunity_id,revision));`;
export function createOpportunityCore(db:Database.Database,dependencies:{resolveCompany(id:string):Company|undefined}){
 function read(id:string){const row=db.prepare('SELECT content_json FROM opportunity_core WHERE id=?').get(id) as {content_json:string}|undefined;if(!row)throw Error('not_found');return Opportunity.parse(JSON.parse(row.content_json));}
 function view(opportunity:Opportunity){const company=dependencies.resolveCompany(opportunity.companyId);if(!company)throw Error('not_found');return OpportunityView.parse({...opportunity,companyName:company.name});}
 function handle(input:CoreRequest,stageOwner?:'submission'|'interview'|'offer'):Result{
  const request=CoreRequest.parse(input);
  if(request.operation==='read')return {kind:'opportunity',opportunity:view(read(request.id))};
  if(request.operation==='list')return Result.parse({kind:'opportunities',items:(db.prepare("SELECT content_json FROM opportunity_core ORDER BY json_extract(content_json,'$.recordedAt') DESC,rowid DESC LIMIT 500").all() as {content_json:string}[]).map(row=>view(Opportunity.parse(JSON.parse(row.content_json))))});
  if(request.operation==='history'){read(request.id);return Result.parse({kind:'history',items:(db.prepare('SELECT history_json FROM opportunity_core_history WHERE opportunity_id=? ORDER BY revision DESC').all(request.id) as {history_json:string}[]).map(row=>JSON.parse(row.history_json))});}
  return executeCommand(db,'opportunity',request.commandId,request,()=>{
   const recordedAt=new Date().toISOString();let opportunity:Opportunity;let previousResult:Opportunity['result']|undefined;let correctedEventId:string|undefined;let previousCompanyId:string|undefined;let previousRole:string|undefined;
   let type:'created'|'identity_edited'|'identity_corrected'|'stage_reached'|'stage_corrected'|'ended'|'end_corrected'|'continued'='created';
   if(request.operation==='create'){
    if(!dependencies.resolveCompany(request.companyId))throw Error('not_found');opportunity={id:randomUUID(),companyId:request.companyId,role:request.role,revision:1,phase:'preparation',result:'active',stageDates:{submitted:{kind:'unknown'},interview:{kind:'unknown'},offer:{kind:'unknown'}},recordedAt};
   }else{
    const old=read(request.id);if(old.revision!==request.expectedRevision)throw Error('conflict');opportunity={...old,revision:old.revision+1,recordedAt};
    switch(request.operation){
     case 'edit':previousCompanyId=old.companyId;previousRole=old.role;if(!dependencies.resolveCompany(request.companyId))throw Error('not_found');if(request.companyId!==old.companyId&&!request.correction)throw Error('invalid_transition');opportunity.companyId=request.companyId;opportunity.role=request.role;type=request.correction?'identity_corrected':'identity_edited';break;
     case 'record-stage':{const ranks={preparation:0,submitted:1,interview:2,offer:3};if(ranks[request.stage]>ranks[old.phase])opportunity.phase=request.stage;const prior=old.stageDates[request.stage];const next=request.businessTime;
      opportunity.stageDates={...old.stageDates,[request.stage]:earliest(prior,next)};type='stage_reached';break;}
     case 'correct-stage':{
      const history=(db.prepare('SELECT history_json FROM opportunity_core_history WHERE opportunity_id=? ORDER BY revision').all(old.id) as {history_json:string}[]).map(row=>History.parse(JSON.parse(row.history_json)));
      const events=new Map<string,{stage:'submitted'|'interview'|'offer';time:History['businessTime'];voided:boolean}>();
      for(const item of history){if(item.type==='stage_reached'&&item.stage&&item.stage!=='preparation')events.set(item.id,{stage:item.stage,time:item.businessTime,voided:false});if(item.type==='stage_corrected'&&item.correctedEventId&&item.stage&&item.stage!=='preparation')events.set(item.correctedEventId,{stage:item.stage,time:item.businessTime,voided:!!item.voided});}
      if(!events.has(request.eventId))throw Error('not_found');const target=history.find(item=>item.id===request.eventId);if(target?.stageOwner&&(target.stageOwner!==stageOwner||request.stage!==target.stage||request.voided))throw Error('invalid_transition');if(stageOwner&&target?.stageOwner!==stageOwner)throw Error('invalid_transition');events.set(request.eventId,{stage:request.stage,time:request.businessTime,voided:request.voided});correctedEventId=request.eventId;
      opportunity.phase='preparation';opportunity.stageDates={submitted:{kind:'unknown'},interview:{kind:'unknown'},offer:{kind:'unknown'}};const ranks={preparation:0,submitted:1,interview:2,offer:3};
      for(const event of events.values()){if(event.voided)continue;if(ranks[event.stage]>ranks[opportunity.phase])opportunity.phase=event.stage;opportunity.stageDates[event.stage]=earliest(opportunity.stageDates[event.stage],event.time);}
      type='stage_corrected';break;
     }
     case 'end':previousResult=old.result;if(old.result===request.outcome)throw Error('invalid_transition');opportunity.result=request.outcome;type='ended';break;
     case 'correct-end':{if(old.result==='active')throw Error('invalid_transition');const history=(db.prepare('SELECT history_json FROM opportunity_core_history WHERE opportunity_id=? ORDER BY revision DESC').all(old.id) as {history_json:string}[]).map(row=>History.parse(JSON.parse(row.history_json)));const corrected=new Set(history.map(item=>item.correctedEventId));const target=history.find(item=>!item.historical&&!corrected.has(item.id)&&['ended','continued','offer_accepted','offer_recruiter_withdrew','offer_user_withdrew'].includes(item.type));if(target?.type!=='ended'||target.result!==old.result||!target.previousResult)throw Error('invalid_transition');opportunity.result=effectiveResult([...history].reverse(),target.id);correctedEventId=target.id;type='end_corrected';break;}
     case 'recontinue':if(old.result==='active')throw Error('invalid_transition');opportunity.result='active';type='continued';break;
    }
   }
   db.prepare('INSERT INTO opportunity_core VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET company_id=excluded.company_id,revision=excluded.revision,content_json=excluded.content_json').run(opportunity.id,opportunity.companyId,opportunity.revision,JSON.stringify(opportunity));
   const history={id:randomUUID(),opportunityId:opportunity.id,revision:opportunity.revision,type,companyId:opportunity.companyId,role:opportunity.role,...previousCompanyId?{previousCompanyId,previousRole}:{},reason:request.operation==='create'?'创建一次尝试':request.reason,businessTime:request.operation==='create'?{kind:'unknown'}:request.businessTime,phase:opportunity.phase,result:opportunity.result,recordedAt,...stageOwner?{stageOwner}:{},...previousResult?{previousResult}:{},...correctedEventId?{correctedEventId}:{},...request.operation==='record-stage'||request.operation==='correct-stage'?{stage:request.stage}:{},...request.operation==='correct-stage'?{voided:request.voided}:{}};
   db.prepare('INSERT INTO opportunity_core_history VALUES (?,?,?,?)').run(history.id,opportunity.id,opportunity.revision,JSON.stringify(history));return Result.parse({kind:'opportunity',opportunity:view(opportunity)});
  });
 }
 function resolveOpportunity(id:string){try{const opportunity=view(read(id));return {id:opportunity.id,companyName:opportunity.companyName,role:opportunity.role};}catch{return undefined;}}
 // Only injected backend Offer composition receives this capability. Renderer
 // Request does not accept arbitrary result values or acceptance-basis claims.
 const recordOfferEvent: OpportunityCapabilities['recordOfferEvent'] = input => {
  const request=z.object({commandId:z.uuid(),opportunityId:z.uuid(),expectedRevision:z.number().int().positive(),action:z.enum(['accepted','conditions_replaced','recruiter_withdrew','user_withdrew','acceptance_corrected','withdrawal_corrected']),businessTime:BusinessTimeSchema,reason:z.string().trim().min(1).max(1000),basisId:z.uuid().optional(),correctedEventId:z.uuid().optional(),historical:z.boolean().optional()}).strict().parse(input);
  return executeCommand(db,'opportunity.offer-event',request.commandId,request,()=>{
   const old=read(request.opportunityId);if(old.revision!==request.expectedRevision)throw Error('conflict');
   const opportunity={...old,revision:old.revision+1,recordedAt:new Date().toISOString()};
   const types={accepted:'offer_accepted',conditions_replaced:'offer_conditions_replaced',recruiter_withdrew:'offer_recruiter_withdrew',user_withdrew:'offer_user_withdrew',acceptance_corrected:'offer_acceptance_corrected',withdrawal_corrected:'offer_withdrawal_corrected'} as const;
   if(request.action==='accepted'&&(!request.basisId||old.phase!=='offer'))throw Error('invalid_transition');
   if(request.action==='acceptance_corrected'||request.action==='withdrawal_corrected'){
    const rows=(db.prepare('SELECT history_json FROM opportunity_core_history WHERE opportunity_id=? ORDER BY revision').all(old.id) as {history_json:string}[]).map(row=>History.parse(JSON.parse(row.history_json)));
    const target=rows.find(row=>row.id===request.correctedEventId&&(request.action==='acceptance_corrected'?row.type==='offer_accepted':['offer_recruiter_withdrew','offer_user_withdrew'].includes(row.type)));
    if(!target||rows.some(row=>row.correctedEventId===target.id))throw Error('invalid_transition');
    if(!request.historical)opportunity.result=effectiveResult(rows,target.id);
   }else if(!request.historical){
    switch(request.action){
     case 'accepted':opportunity.result='accepted';break;
     case 'conditions_replaced':if(old.result==='accepted')opportunity.result='active';break;
     case 'recruiter_withdrew':opportunity.result='recruiter_ended';break;
     case 'user_withdrew':opportunity.result='withdrawn';break;
    }
   }
   const history=History.parse({id:randomUUID(),opportunityId:old.id,revision:opportunity.revision,type:types[request.action],reason:request.reason,companyId:old.companyId,role:old.role,businessTime:request.businessTime,phase:opportunity.phase,result:opportunity.result,previousResult:old.result,recordedAt:opportunity.recordedAt,...request.basisId?{basisId:request.basisId}:{},...request.correctedEventId?{correctedEventId:request.correctedEventId}:{},...request.historical?{historical:true}:{}});
   db.prepare('UPDATE opportunity_core SET revision=?,content_json=? WHERE id=?').run(opportunity.revision,JSON.stringify(opportunity),old.id);
   db.prepare('INSERT INTO opportunity_core_history VALUES (?,?,?,?)').run(history.id,old.id,history.revision,JSON.stringify(history));
   return {opportunity:view(opportunity),eventId:history.id};
  });
 };
 return {handle,resolveOpportunity,recordOfferEvent,purgeImpact(id:string){let value;try{value=read(id);}catch{return undefined;}return {id,companyId:value.companyId,revision:value.revision,name:value.role,blobIds:[],retentions:[]};},purge(id:string){db.transaction(()=>{db.prepare('DELETE FROM opportunity_core_history WHERE opportunity_id=?').run(id);db.prepare('DELETE FROM opportunity_core WHERE id=?').run(id);for(const owner of ['opportunity','opportunity.stage-capability','opportunity.offer-event','opportunity.submission-time-correction','opportunity.interview-confirmation-correction'])redactOwnerReceipts(db,owner,[id],{kind:'failure',code:'not_found'});})();}};
}

function earliest(prior:BusinessTime,next:BusinessTime):BusinessTime {
 if(next.kind==='unknown')return prior;if(prior.kind==='unknown')return next;
 if(prior.kind==='instant'&&next.kind==='instant')return Date.parse(next.instant)<Date.parse(prior.instant)?next:prior;
 const priorDate=prior.kind==='date'?prior.date:prior.instant.slice(0,10);const nextDate=next.kind==='date'?next.date:next.instant.slice(0,10);
 return nextDate<priorDate||nextDate===priorDate&&next.kind==='date'?next:prior;
}

/** Replay only core-owned result meanings; correction records remove their original event,
 * never create a competing real fact or restore a polluted previous snapshot. */
function effectiveResult(events:History[],newCorrection:string):Opportunity['result']{
 const corrected=new Set(events.filter(event=>['end_corrected','offer_acceptance_corrected','offer_withdrawal_corrected'].includes(event.type)).map(event=>event.correctedEventId));corrected.add(newCorrection);
 let result:Opportunity['result']='active';
 for(const event of events){if(event.historical||corrected.has(event.id))continue;
  if(event.type==='ended')result=event.result;
  if(event.type==='continued')result='active';
  if(event.type==='offer_accepted')result='accepted';
  if(event.type==='offer_recruiter_withdrew')result='recruiter_ended';
  if(event.type==='offer_user_withdrew')result='withdrawn';
  if(event.type==='offer_conditions_replaced'&&result==='accepted')result='active';
 }
 return result;
}

export {validateCandidate,candidateRelations} from './candidate-validation';

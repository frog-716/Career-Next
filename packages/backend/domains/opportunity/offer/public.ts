import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { Request, Result, Offer, Original, AcceptanceBasis, Event, type OriginalInput } from '../../../../contracts/opportunity/offer/schema';
import type { SourceRef } from '../../../../contracts/materials/schema';
import type { OpportunityCapabilities } from '../../../../contracts/opportunity/capabilities';
import {redactOwnerReceipts} from '../../../platform/commands/purge-receipts';
import { executeCommand, commandReceipt } from '../../../platform/commands/receipts';
export interface OfferDependencies {
 core: OpportunityCapabilities;
 retainSource?(source:SourceRef,retentionOwnerId:string):void;
 releaseRetention?(retentionOwnerId:string):void;
 validateSource(source:SourceRef): {status:'available';name:string;digest:string}|{status:'unavailable'};
}
export function createOfferDomain(db:Database.Database,dependencies:OfferDependencies) {
 function read(opportunityId:string) {const row=db.prepare('SELECT body_json FROM opportunity_offer WHERE opportunity_id=?').get(opportunityId) as {body_json:string}|undefined;return row?Offer.parse(JSON.parse(row.body_json)):undefined;}
 function opportunity(id:string){const value=dependencies.core.readOpportunity(id);if(!value)throw Error('not_found');return value;}
 function material(input:OriginalInput) {if(input.kind!=='retained')return input;const source=dependencies.validateSource(input.source);if(source.status!=='available')throw Error('source_unavailable');return Original.parse({...input,name:source.name,digest:source.digest});}
 function retain(original:Offer['original'],ownerId:string){if(original.kind!=='retained')return;if(!dependencies.retainSource)throw Error('storage_failed');dependencies.retainSource(original.source,ownerId);}
 function handle(input:unknown):Result {
  const parsed=Request.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};const request=parsed.data;
  try {
   if(request.operation==='offer.receipt'){const receipt=commandReceipt(db,'offer',request.commandId);return receipt===undefined?{kind:'receipt_missing'}:Result.parse(receipt);}
   const currentOpportunity=opportunity(request.opportunityId);
   if(request.operation==='offer.read'){const offer=read(request.opportunityId);return offer?{kind:'offer',offer,opportunity:currentOpportunity}:{kind:'empty',opportunity:currentOpportunity};}
   if(request.operation==='offer.history')return Result.parse({kind:'history',events:(db.prepare('SELECT event_json FROM opportunity_offer_history WHERE offer_id IN (SELECT id FROM opportunity_offer WHERE opportunity_id=?) ORDER BY rowid DESC').all(request.opportunityId) as {event_json:string}[]).map(row=>JSON.parse(row.event_json)),acceptances:(db.prepare('SELECT basis_json FROM opportunity_offer_acceptance WHERE offer_id IN (SELECT id FROM opportunity_offer WHERE opportunity_id=?) ORDER BY rowid DESC').all(request.opportunityId) as {basis_json:string}[]).map(row=>JSON.parse(row.basis_json))});
   return Result.parse(executeCommand(db,'offer',request.commandId,request,()=>{
    const old=read(request.opportunityId);if(request.operation==='offer.receive'&&old)throw Error('already_exists');
    if(currentOpportunity.revision!==request.expectedOpportunityRevision)throw Error('conflict');
    const recordedAt=new Date().toISOString();
    let offer:Offer; let current=currentOpportunity; let type:import('../../../../contracts/opportunity/offer/schema').Event['type']; let coreEventId:string|undefined; let basisId:string|undefined; let eventConditions:Offer|undefined; let previousValid:boolean|undefined;
    if(request.operation==='offer.receive'){
     offer={id:randomUUID(),opportunityId:request.opportunityId,revision:1,conditionsId:randomUUID(),conditions:request.conditions,original:material(request.original),valid:true,receivedAt:request.businessTime,recordedAt};type='received';
     const result=dependencies.core.recordStage({commandId:randomUUID(),opportunityId:request.opportunityId,expectedRevision:request.expectedOpportunityRevision,stage:'offer',businessTime:request.businessTime,reason:request.reason});current=result.opportunity;coreEventId=result.eventId;
    }else{
     if(!old)throw Error('not_found');if(old.revision!==request.expectedRevision)throw Error('conflict');offer={...old,revision:old.revision+1,recordedAt};
     const coreEvent=(action:Parameters<OpportunityCapabilities['recordOfferEvent']>[0]['action'],extras:{basisId?:string;historical?:boolean;correctedEventId?:string}={})=>{
      const result=dependencies.core.recordOfferEvent({commandId:randomUUID(),opportunityId:offer.opportunityId,expectedRevision:request.expectedOpportunityRevision,action,businessTime:request.businessTime,reason:request.reason,...extras});current=result.opportunity;coreEventId=result.eventId;
     };
     if(request.operation==='offer.accept'){
      if(!request.historical&&(!old.valid||current.result==='accepted'))throw Error('invalid_transition');
      let acceptedConditions=old;
      if(request.conditionsId&&request.conditionsId!==old.conditionsId){
       if(!request.historical)throw Error('invalid_transition');
       const prior=(db.prepare('SELECT event_json FROM opportunity_offer_history WHERE offer_id=? ORDER BY rowid DESC').all(old.id) as {event_json:string}[]).map(row=>Event.parse(JSON.parse(row.event_json))).find(event=>event.conditionsId===request.conditionsId&&event.conditions&&event.original);
       if(!prior?.conditions||!prior.original)throw Error('not_found');acceptedConditions={...old,conditionsId:prior.conditionsId,conditions:prior.conditions,original:prior.original};
      }
      if(acceptedConditions.original.kind==='retained'){const checked=material({kind:'retained',source:acceptedConditions.original.source});if(checked.kind!=='retained'||checked.digest!==acceptedConditions.original.digest)throw Error('source_unavailable');}
      eventConditions=acceptedConditions;basisId=randomUUID();retain(acceptedConditions.original,basisId);coreEvent('accepted',{basisId,historical:request.historical});type='accepted';
      const basis=AcceptanceBasis.parse({id:basisId,offerId:offer.id,opportunityId:offer.opportunityId,conditionsId:acceptedConditions.conditionsId,conditions:acceptedConditions.conditions,original:acceptedConditions.original,acceptedAt:request.businessTime,recordedAt,coreEventId});
      db.prepare('INSERT INTO opportunity_offer_acceptance VALUES (?,?,?)').run(basis.id,offer.id,JSON.stringify(basis));
     }else if(request.operation==='offer.replace'){
      const replacement={...offer,conditionsId:randomUUID(),conditions:request.conditions,original:material(request.original),valid:true};
      if(request.historical)eventConditions=replacement;else offer=replacement;
      coreEvent('conditions_replaced',{historical:request.historical});type='conditions_replaced';
     }else if(request.operation==='offer.correct'){
      if(current.result==='accepted'&&JSON.stringify(old.conditions)!==JSON.stringify(request.conditions))throw Error('accepted_conditions_protected');
      offer={...offer,conditions:request.conditions};type='conditions_corrected';
     }else if(request.operation==='offer.withdraw'){
      previousValid=old.valid;if(!request.historical)offer={...offer,valid:false};type=request.by==='recruiter'?'recruiter_withdrew':'user_withdrew';coreEvent(type,{historical:request.historical});
     }else if(request.operation==='offer.correct-withdrawal'){
      const events=(db.prepare('SELECT event_json FROM opportunity_offer_history WHERE offer_id=? ORDER BY rowid').all(offer.id) as {event_json:string}[]).map(row=>Event.parse(JSON.parse(row.event_json)));
      const target=events.find(event=>event.coreEventId===request.coreEventId&&['recruiter_withdrew','user_withdrew'].includes(event.type));if(!target)throw Error('not_found');if(events.some(event=>event.correctedEventId===request.coreEventId))throw Error('invalid_transition');
      const corrected=new Set(events.filter(event=>event.type==='withdrawal_corrected').map(event=>event.correctedEventId));corrected.add(request.coreEventId);let valid=true;
      for(const event of events){if(event.historical||event.coreEventId&&corrected.has(event.coreEventId))continue;if(['received','conditions_replaced'].includes(event.type))valid=true;if(['recruiter_withdrew','user_withdrew'].includes(event.type))valid=false;}
      offer={...offer,valid};coreEvent('withdrawal_corrected',{correctedEventId:request.coreEventId});type='withdrawal_corrected';
     }else if(request.operation==='offer.correct-acceptance'){
      const basis=(db.prepare('SELECT basis_json FROM opportunity_offer_acceptance WHERE offer_id=?').all(offer.id) as {basis_json:string}[]).map(row=>AcceptanceBasis.parse(JSON.parse(row.basis_json))).find(basis=>basis.coreEventId===request.coreEventId);
      if(!basis)throw Error('not_found');coreEvent('acceptance_corrected',{correctedEventId:request.coreEventId});type='acceptance_corrected';
     }else throw Error('invalid_transition');
    }
    if(request.operation==='offer.receive'||request.operation==='offer.replace')retain((eventConditions??offer).original,(eventConditions??offer).conditionsId);
    db.prepare('INSERT INTO opportunity_offer VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,body_json=excluded.body_json').run(offer.id,offer.opportunityId,offer.revision,JSON.stringify(offer));
    const event=Event.parse({id:randomUUID(),offerId:offer.id,opportunityId:offer.opportunityId,type,reason:request.reason,businessTime:request.businessTime,recordedAt,historical:'historical'in request?request.historical:false,...previousValid!==undefined?{previousValid}:{},conditionsId:(eventConditions??offer).conditionsId,...request.operation==='offer.receive'||request.operation==='offer.replace'||request.operation==='offer.correct'?{conditions:(eventConditions??offer).conditions,original:(eventConditions??offer).original}:{},...coreEventId?{coreEventId}:{},...basisId?{basisId}:{},...request.operation==='offer.correct-acceptance'||request.operation==='offer.correct-withdrawal'?{correctedEventId:request.coreEventId}:{}});
    db.prepare('INSERT INTO opportunity_offer_history VALUES (?,?,?)').run(event.id,offer.id,JSON.stringify(event));return Result.parse({kind:'offer',offer,opportunity:current});
   }));
  }catch(error){const code=error instanceof Error?error.message:'storage_failed';return Result.parse({kind:'failure',code:['not_found','conflict','already_exists','invalid_transition','source_unavailable','accepted_conditions_protected'].includes(code)?code:'storage_failed'});}
 }
 function purgeImpact(id:string){const row=db.prepare('SELECT body_json FROM opportunity_offer WHERE id=?').get(id) as {body_json:string}|undefined;if(!row)return undefined;const value=Offer.parse(JSON.parse(row.body_json));const events=(db.prepare('SELECT event_json FROM opportunity_offer_history WHERE offer_id=?').all(id) as {event_json:string}[]).map(item=>Event.parse(JSON.parse(item.event_json)));const bases=(db.prepare('SELECT basis_json FROM opportunity_offer_acceptance WHERE offer_id=?').all(id) as {basis_json:string}[]).map(item=>AcceptanceBasis.parse(JSON.parse(item.basis_json)));const materialOwners=[...events.filter(event=>event.original?.kind==='retained').map(event=>event.conditionsId),...bases.filter(basis=>basis.original.kind==='retained').map(basis=>basis.id),...value.original.kind==='retained'?[value.conditionsId]:[]];return {id,opportunityId:value.opportunityId,revision:value.revision,name:'Offer 条件及接受依据',blobIds:[],retentions:[...new Set(materialOwners)].map(objectId=>({owner:'offer' as const,objectId})),relatedIds:bases.map(item=>item.id)};}
 function purge(id:string){db.transaction(()=>{const impact=purgeImpact(id);if(!impact)return;if(impact.retentions.length&&!dependencies.releaseRetention)throw Error('storage_failed');for(const retention of impact.retentions)dependencies.releaseRetention!(retention.objectId);db.prepare('DELETE FROM opportunity_offer_acceptance WHERE offer_id=?').run(id);db.prepare('DELETE FROM opportunity_offer_history WHERE offer_id=?').run(id);db.prepare('DELETE FROM opportunity_offer WHERE id=?').run(id);redactOwnerReceipts(db,'offer',[id,...impact.relatedIds],{kind:'failure',code:'not_found'});})();}
 return {handle,read,purgeImpact,purge};
}

export {validateCandidate,candidateRelations} from './candidate-validation';

export {createOfferAiPolicy} from './ai-policy';

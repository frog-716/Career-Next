import { it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { createOpportunityDomain } from '../../packages/backend/domains/opportunity/public';
import { opportunityMigration } from '../../packages/backend/domains/opportunity/migration';
import { commandMigration } from '../../packages/backend/platform/commands/receipts';
import { createOfferDomain } from '../../packages/backend/domains/opportunity/offer/public';
import { offerMigration } from '../../packages/backend/domains/opportunity/offer/migration';
import { Result, type Conditions } from '../../packages/contracts/opportunity/offer/schema';
const unknown = { kind: 'unknown' } as const;
export const conditions: Conditions = { role: {kind:'known',value:'Engineer'}, location:unknown, guaranteedCash:{kind:'known',value:'30k per month'}, variableIncome:unknown, equity:unknown, oneTime:unknown, paymentCycle:unknown, other:unknown };
export function fixture() {
 const db=new Database(':memory:'); db.exec(commandMigration);db.exec(opportunityMigration);db.exec(offerMigration);
 const opportunity=createOpportunityDomain(db);const company=opportunity.handle({operation:'company.create',commandId:randomUUID(),name:'Offer Company'});if(company.kind!=='company')throw Error('company fixture');
 const created=opportunity.handle({operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'Engineer'});if(created.kind!=='opportunity')throw Error('opportunity fixture');
 const offer=createOfferDomain(db,{core:opportunity.capabilities,validateSource:()=>({status:'unavailable' as const})});
 return {db,opportunity,offer,id:created.opportunity.id};
}
it('direct receipt creates one current Offer, preserves unknown time and never fabricates prerequisite stages',()=>{
 const {db,opportunity,offer,id}=fixture();try {
 const command={operation:'offer.receive',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:1,conditions,original:{kind:'never_existed',explanation:'Oral agreement'},businessTime:unknown,reason:'Actually received'};
 const received=Result.parse(offer.handle(command));expect(received).toMatchObject({kind:'offer',offer:{opportunityId:id,revision:1,valid:true,conditions,receivedAt:unknown},opportunity:{phase:'offer',result:'active',stageDates:{submitted:unknown,interview:unknown,offer:unknown}}});
 expect(offer.handle(command)).toEqual(received);
 expect(offer.handle({...command,commandId:randomUUID()})).toMatchObject({kind:'failure',code:'already_exists'});
 expect(offer.handle({operation:'offer.read',opportunityId:id})).toEqual(received);
 expect(opportunity.handle({operation:'history',id})).toMatchObject({kind:'history',items:[{type:'stage_reached',stage:'offer'},{type:'created'}]});
 }finally{db.close();}
});
it('accepting 30k freezes known, unknown and absent material; new 25k conditions return to active and reacceptance keeps both bases',()=>{
 const {db,opportunity,offer,id}=fixture();try{
 let received=Result.parse(offer.handle({operation:'offer.receive',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:1,conditions,original:{kind:'never_existed',explanation:'Oral offer, no written original ever existed'},businessTime:unknown,reason:'Actual offer'}));if(received.kind!=='offer')throw Error('receive');
 const acceptance={operation:'offer.accept',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:received.opportunity.revision,expectedRevision:received.offer.revision,businessTime:{kind:'date',date:'2026-09-01'},reason:'Accepted 30k',historical:false};
 let accepted=Result.parse(offer.handle(acceptance));expect(accepted).toMatchObject({kind:'offer',opportunity:{result:'accepted'}});expect(offer.handle(acceptance)).toEqual(accepted);if(accepted.kind!=='offer')throw Error('accept');
 let replaced=Result.parse(offer.handle({operation:'offer.replace',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:accepted.opportunity.revision,expectedRevision:accepted.offer.revision,conditions:{...conditions,guaranteedCash:{kind:'known',value:'25k per month'}},original:{kind:'historically_lost',explanation:'Revised original was lost before recording'},businessTime:{kind:'date',date:'2026-09-02'},reason:'Recruiter formally replaced the valid conditions'}));expect(replaced).toMatchObject({kind:'offer',opportunity:{result:'active',phase:'offer'}});if(replaced.kind!=='offer')throw Error('replace');
 expect(replaced.offer.conditionsId).not.toBe(accepted.offer.conditionsId);
 const acceptedAgain=offer.handle({...acceptance,commandId:randomUUID(),expectedOpportunityRevision:replaced.opportunity.revision,expectedRevision:replaced.offer.revision,businessTime:unknown,reason:'Accepted 25k'});expect(acceptedAgain).toMatchObject({kind:'offer',opportunity:{result:'accepted'}});
 const history=offer.handle({operation:'offer.history',opportunityId:id});expect(history).toMatchObject({kind:'history',acceptances:[{conditions:{guaranteedCash:{kind:'known',value:'25k per month'}},original:{kind:'historically_lost'},acceptedAt:unknown},{conditions,original:{kind:'never_existed'},acceptedAt:{kind:'date',date:'2026-09-01'}}]});
 expect(opportunity.handle({operation:'history',id})).toMatchObject({kind:'history',items:[{type:'offer_accepted'},{type:'offer_conditions_replaced'},{type:'offer_accepted'},{type:'stage_reached'},{type:'created'}]});
 }finally{db.close();}
});
it('typo correction keeps accepted condition identity; explicit correction preserves acceptance basis, while real withdrawals preserve earlier facts',()=>{
 const {db,offer,id}=fixture();try{
 let result=Result.parse(offer.handle({operation:'offer.receive',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:1,conditions,original:{kind:'never_existed',explanation:'Oral'},businessTime:unknown,reason:'Received'}));if(result.kind!=='offer')throw Error('receive');
 const write=(operation:string,extras:Record<string,unknown>={})=>{if(result.kind!=='offer')throw Error('baseline');const next=Result.parse(offer.handle({operation,commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:result.opportunity.revision,expectedRevision:result.offer.revision,businessTime:unknown,reason:'Explicit human fact',...extras}));expect(next.kind).toBe('offer');if(next.kind!=='offer')throw Error('write failed');result=next;return next;};
 const accepted=write('offer.accept',{historical:false});
 if(result.kind!=='offer')throw Error('accepted baseline');
 const typo={operation:'offer.correct',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:result.opportunity.revision,expectedRevision:result.offer.revision,businessTime:unknown,reason:'Correction of a mistaken field',conditions:{...conditions,role:{kind:'known',value:'Engineer, spelling corrected'}}};
 expect(offer.handle(typo)).toEqual({kind:'failure',code:'accepted_conditions_protected'});
 expect(offer.handle({operation:'offer.read',opportunityId:id})).toMatchObject({kind:'offer',offer:{conditionsId:accepted.offer.conditionsId,conditions},opportunity:{result:'accepted'}});
 let history=offer.handle({operation:'offer.history',opportunityId:id});if(history.kind!=='history')throw Error('history');const firstBasis=history.acceptances[0];expect(firstBasis.conditions.role).toEqual({kind:'known',value:'Engineer'});
 const unaccepted=write('offer.correct-acceptance',{coreEventId:firstBasis.coreEventId});expect(unaccepted.opportunity.result).toBe('active');expect(unaccepted.offer.valid).toBe(true);
 const corrected=write('offer.correct',{conditions:{...conditions,role:{kind:'known',value:'Engineer, spelling corrected'}}});expect(corrected.offer.conditionsId).toBe(accepted.offer.conditionsId);
 write('offer.accept',{historical:false});const withdrawn=write('offer.withdraw',{by:'recruiter',historical:false});expect(withdrawn).toMatchObject({offer:{valid:false},opportunity:{result:'recruiter_ended',phase:'offer'}});
 const late=write('offer.accept',{historical:true});expect(late.opportunity.result).toBe('recruiter_ended');expect(late.offer.valid).toBe(false);
 const userWithdrew=write('offer.withdraw',{by:'user',historical:false});expect(userWithdrew.opportunity.result).toBe('withdrawn');
 history=offer.handle({operation:'offer.history',opportunityId:id});expect(history).toMatchObject({kind:'history',acceptances:[{conditions:{role:{kind:'known',value:'Engineer, spelling corrected'}}},{conditions:{role:{kind:'known',value:'Engineer, spelling corrected'}}},{conditions}]});
 if(history.kind!=='history')throw Error('history');const correction=write('offer.correct-acceptance',{coreEventId:history.acceptances[1].coreEventId});expect(correction.opportunity.result).toBe('withdrawn');
 }finally{db.close();}
});
it('a cross-owner exception or failure DTO rolls back the entire receive and original command receipt',()=>{
 const {db,offer,id,opportunity}=fixture();try{
 const command={operation:'offer.receive',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:1,conditions,original:{kind:'never_existed',explanation:'Oral'},businessTime:unknown,reason:'Receive'};
 const broken=createOfferDomain(db,{core:{...opportunity.capabilities,recordStage(input){opportunity.capabilities.recordStage(input);return {kind:'failure',code:'storage_failed'} as never;}},validateSource:()=>({status:'unavailable'})});
 expect(broken.handle(command)).toEqual({kind:'failure',code:'storage_failed'});
 expect(offer.handle({operation:'offer.read',opportunityId:id})).toMatchObject({kind:'empty',opportunity:{phase:'preparation',revision:1}});
 expect(offer.handle({operation:'offer.receipt',commandId:command.commandId})).toEqual({kind:'receipt_missing'});
 const thrown=createOfferDomain(db,{core:{...opportunity.capabilities,recordStage(input){opportunity.capabilities.recordStage(input);throw Error('storage_failed');}},validateSource:()=>({status:'unavailable'})});
 expect(thrown.handle(command)).toEqual({kind:'failure',code:'storage_failed'});expect(offer.handle({operation:'offer.read',opportunityId:id})).toMatchObject({kind:'empty',opportunity:{phase:'preparation',revision:1}});
 }finally{db.close();}
});
it('promised original retention failure never masquerades as historic loss and cannot partially accept',()=>{
 const {db,offer,id,opportunity}=fixture();try{
 const source={owner:'materials',objectId:randomUUID(),revision:1,locator:'whole',scope:'personal'} as const;
 const retained=createOfferDomain(db,{core:opportunity.capabilities,validateSource:()=>({status:'available',name:'Actual original',digest:'a'.repeat(64)}),retainSource(){throw Error('storage_failed');}});
 const received=retained.handle({operation:'offer.receive',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:1,conditions,original:{kind:'retained',source},businessTime:unknown,reason:'Promised original'});
 expect(received).toEqual({kind:'failure',code:'storage_failed'});expect(offer.handle({operation:'offer.read',opportunityId:id})).toMatchObject({kind:'empty',opportunity:{phase:'preparation'}});
 let fail=false;const preserving=createOfferDomain(db,{core:opportunity.capabilities,validateSource:()=>({status:'available',name:'Actual original',digest:'a'.repeat(64)}),retainSource(){if(fail)throw Error('storage_failed');}});
 const actual=preserving.handle({operation:'offer.receive',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:1,conditions,original:{kind:'retained',source},businessTime:unknown,reason:'Actual received'});if(actual.kind!=='offer')throw Error('fixture');fail=true;
 const command={operation:'offer.accept',commandId:randomUUID(),opportunityId:id,expectedRevision:actual.offer.revision,expectedOpportunityRevision:actual.opportunity.revision,businessTime:unknown,reason:'Actual acceptance',historical:false};
 expect(preserving.handle(command)).toEqual({kind:'failure',code:'storage_failed'});expect(offer.handle({operation:'offer.history',opportunityId:id})).toMatchObject({kind:'history',acceptances:[]});expect(opportunity.handle({operation:'read',id})).toMatchObject({kind:'opportunity',opportunity:{result:'active',revision:2}});expect(offer.handle({operation:'offer.receipt',commandId:command.commandId})).toEqual({kind:'receipt_missing'});
 }finally{db.close();}
});
it('late-recorded old conditions and their acceptance never overwrite later current effective conditions or result',()=>{
 const {db,offer,id}=fixture();try{
 const received=offer.handle({operation:'offer.receive',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:1,conditions,original:{kind:'never_existed',explanation:'Oral'},businessTime:{kind:'date',date:'2026-09-10'},reason:'Current actual offer'});if(received.kind!=='offer')throw Error('fixture');
 const old=offer.handle({operation:'offer.replace',commandId:randomUUID(),opportunityId:id,expectedRevision:received.offer.revision,expectedOpportunityRevision:received.opportunity.revision,conditions:{...conditions,guaranteedCash:{kind:'known',value:'35k old terms'}},original:{kind:'historically_lost',explanation:'Old terms document was already lost'},businessTime:{kind:'date',date:'2026-08-01'},reason:'Late recording earlier true terms',historical:true});
 expect(old).toMatchObject({kind:'offer',offer:{conditions,conditionsId:received.offer.conditionsId},opportunity:{result:'active'}});if(old.kind!=='offer')throw Error('old terms');
 const history=offer.handle({operation:'offer.history',opportunityId:id});expect(history).toMatchObject({kind:'history',events:[{type:'conditions_replaced',historical:true,conditions:{guaranteedCash:{kind:'known',value:'35k old terms'}}},{}]});if(history.kind!=='history')throw Error('history');
 const accepted=offer.handle({operation:'offer.accept',commandId:randomUUID(),opportunityId:id,expectedRevision:old.offer.revision,expectedOpportunityRevision:old.opportunity.revision,conditionsId:history.events[0].conditionsId,businessTime:{kind:'date',date:'2026-08-02'},reason:'Late actual acceptance of earlier terms',historical:true});
 expect(accepted).toMatchObject({kind:'offer',offer:{conditions,conditionsId:received.offer.conditionsId},opportunity:{result:'active'}});
 expect(offer.handle({operation:'offer.history',opportunityId:id})).toMatchObject({kind:'history',acceptances:[{conditions:{guaranteedCash:{kind:'known',value:'35k old terms'}},original:{kind:'historically_lost'},acceptedAt:{kind:'date',date:'2026-08-02'}}]});
 }finally{db.close();}
});
it('mistaken Offer withdrawal is corrected on the same Offer with validity and the prior result restored, without overwriting later real facts',()=>{
 const {db,opportunity,offer,id}=fixture();try{
  const send=(operation:string,extras:Record<string,unknown>={})=>{const state=offer.handle({operation:'offer.read',opportunityId:id});if(state.kind!=='offer')throw Error();return offer.handle({operation,commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:state.opportunity.revision,expectedRevision:state.offer.revision,businessTime:unknown,reason:'Explicit correction or real event',...extras});};
  expect(offer.handle({operation:'offer.receive',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:1,conditions,original:{kind:'never_existed',explanation:'Verbal conditions'},businessTime:unknown,reason:'Actual offer'}).kind).toBe('offer');
  send('offer.accept',{historical:false});send('offer.withdraw',{by:'recruiter',historical:false});
  const h=offer.handle({operation:'offer.history',opportunityId:id});if(h.kind!=='history')throw Error();const withdrawal=h.events.find(event=>event.type==='recruiter_withdrew')!;
  expect(send('offer.correct-withdrawal',{coreEventId:withdrawal.coreEventId})).toMatchObject({kind:'offer',offer:{valid:true},opportunity:{result:'accepted'}});
  expect(send('offer.correct-withdrawal',{coreEventId:withdrawal.coreEventId})).toMatchObject({kind:'failure',code:'invalid_transition'});
  send('offer.withdraw',{by:'user',historical:false});const second=offer.handle({operation:'offer.history',opportunityId:id});if(second.kind!=='history')throw Error();const user=second.events.find(event=>event.type==='user_withdrew')!;
  send('offer.replace',{conditions:{...conditions,guaranteedCash:{kind:'known',value:'25k'}},original:{kind:'never_existed',explanation:'New verbal conditions'},historical:false});
  expect(send('offer.correct-withdrawal',{coreEventId:user.coreEventId})).toMatchObject({kind:'offer',offer:{valid:true,conditions:{guaranteedCash:{value:'25k'}}},opportunity:{result:'active'}});
  expect(offer.handle({operation:'offer.history',opportunityId:id})).toMatchObject({kind:'history',acceptances:[{conditions:{guaranteedCash:{value:'30k per month'}}}]});
 }finally{db.close();}
});
it('correcting a generic mistaken end after formal replacement cannot restore acceptance of obsolete conditions',()=>{
 const {db,opportunity,offer,id}=fixture();try{
  offer.handle({operation:'offer.receive',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:1,conditions,original:{kind:'never_existed',explanation:'Verbal conditions'},businessTime:unknown,reason:'Actual offer'});
  offer.handle({operation:'offer.accept',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:2,expectedRevision:1,businessTime:unknown,reason:'Accepted old conditions',historical:false});
  opportunity.handle({operation:'end',commandId:randomUUID(),id,expectedRevision:3,outcome:'withdrawn',businessTime:unknown,reason:'Mistaken withdrawal'});
  offer.handle({operation:'offer.replace',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:4,expectedRevision:2,conditions:{...conditions,guaranteedCash:{kind:'known',value:'25k'}},original:{kind:'never_existed',explanation:'New verbal conditions'},businessTime:unknown,reason:'Formal new conditions',historical:false});
  expect(opportunity.handle({operation:'correct-end',commandId:randomUUID(),id,expectedRevision:5,businessTime:unknown,reason:'Correct the false withdrawal'})).toMatchObject({kind:'opportunity',opportunity:{result:'active'}});
 }finally{db.close();}
});
for(const reverse of [true,false])it('correcting two mistaken withdrawals in either order restores the same accepted basis and validity: '+reverse,()=>{
 const {db,offer,id}=fixture();try{
  const send=(operation:string,extras:Record<string,unknown>={})=>{const state=offer.handle({operation:'offer.read',opportunityId:id});if(state.kind!=='offer')throw Error();return offer.handle({operation,commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:state.opportunity.revision,expectedRevision:state.offer.revision,businessTime:unknown,reason:'Explicit event and correction',...extras});};
  offer.handle({operation:'offer.receive',commandId:randomUUID(),opportunityId:id,expectedOpportunityRevision:1,conditions,original:{kind:'never_existed',explanation:'Verbal reality'},businessTime:unknown,reason:'Actual offer'});
  send('offer.accept',{historical:false});send('offer.withdraw',{by:'recruiter',historical:false});send('offer.withdraw',{by:'user',historical:false});
  const history=offer.handle({operation:'offer.history',opportunityId:id});if(history.kind!=='history')throw Error();const targets=history.events.filter(event=>['recruiter_withdrew','user_withdrew'].includes(event.type));if(!reverse)targets.reverse();
  for(const target of targets)expect(send('offer.correct-withdrawal',{coreEventId:target.coreEventId}).kind).toBe('offer');
  expect(offer.handle({operation:'offer.read',opportunityId:id})).toMatchObject({kind:'offer',offer:{valid:true},opportunity:{result:'accepted'}});
  expect(offer.handle({operation:'offer.history',opportunityId:id})).toMatchObject({kind:'history',acceptances:history.acceptances});
 }finally{db.close();}
});

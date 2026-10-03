import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {createOpportunityDomain} from '../../packages/backend/domains/opportunity/public';
import {opportunityMigration} from '../../packages/backend/domains/opportunity/migration';
import {createResearchDomain} from '../../packages/backend/domains/opportunity/research/public';
import {researchMigration} from '../../packages/backend/domains/opportunity/research/migration';
import {createInterviewDomain} from '../../packages/backend/domains/opportunity/interview/public';
import {interviewMigration} from '../../packages/backend/domains/opportunity/interview/migration';
import {createOfferDomain} from '../../packages/backend/domains/opportunity/offer/public';
import {offerMigration} from '../../packages/backend/domains/opportunity/offer/migration';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';
import {Conditions} from '../../packages/contracts/opportunity/offer/schema';
import type {OpportunityCapabilities} from '../../packages/contracts/opportunity/capabilities';

it('RV-MODULE actual SQLite mutations stay inside the executing owner; core writes occur only inside its public capability',()=>{
 let capabilityDepth=0;const trace:{sql:string;inCapability:boolean}[]=[];
 const db=new Database(':memory:',{verbose:sql=>trace.push({sql:String(sql),inCapability:capabilityDepth>0})});
 db.exec(commandMigration+opportunityMigration+researchMigration+interviewMigration+offerMigration);
 const core=createOpportunityDomain(db);const c=core.handle({operation:'company.create',commandId:crypto.randomUUID(),name:'Boundary Company'});if(c.kind!=='company')throw Error();
 const o=core.handle({operation:'create',commandId:crypto.randomUUID(),companyId:c.company.id,role:'Boundary role'});if(o.kind!=='opportunity')throw Error();
 const through=<T>(callback:()=>T)=>{capabilityDepth++;try{return callback();}finally{capabilityDepth--;}};
 const capabilities:OpportunityCapabilities={readOpportunity:core.capabilities.readOpportunity,readCompany:core.capabilities.readCompany,recordStage:input=>through(()=>core.capabilities.recordStage(input)),correctInterviewConfirmation:input=>through(()=>core.capabilities.correctInterviewConfirmation(input)),recordOfferEvent:input=>through(()=>core.capabilities.recordOfferEvent(input))};
 const owners={research:createResearchDomain(db,{core:capabilities}),interview:createInterviewDomain(db,{core:capabilities}),offer:createOfferDomain(db,{core:capabilities,validateSource:()=>({status:'unavailable'})})};
 try{
  for(const owner of Object.values(owners))expect(owner.handle({operation:'end',commandId:crypto.randomUUID(),id:o.opportunity.id,expectedRevision:1,outcome:'withdrawn',reason:'foreign operation',businessTime:{kind:'unknown'}})).toEqual({kind:'failure',code:'invalid_request'});
  expect(core.capabilities.readOpportunity(o.opportunity.id)).toMatchObject({revision:1,phase:'preparation',result:'active'});
  function check(name:keyof typeof owners,input:unknown){trace.length=0;const result=owners[name].handle(input);expect(result.kind).not.toBe('failure');
   const mutations=trace.filter(({sql})=>/^\s*(?:INSERT|UPDATE|DELETE)/i.test(sql));expect(mutations.length).toBeGreaterThan(0);
   for(const {sql,inCapability} of mutations){const table=/^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i.exec(sql)?.[1];expect(table,'actual SQL: '+sql).toBeDefined();if(table?.startsWith('platform_'))continue;if(inCapability)expect(table).toMatch(/^opportunity_core/);else expect(table).toMatch(name==='research'?/^research_/:name==='interview'?/^interview_/:/^opportunity_offer/);}
  }
  check('research',{operation:'create',commandId:crypto.randomUUID(),owner:{kind:'opportunity',id:o.opportunity.id},title:'Owned research',body:'No competing core body',nature:'unknown',sources:[],leads:[],userConfirmed:false,independentlyVerified:false});
  check('interview',{operation:'interview.confirm',commandId:crypto.randomUUID(),opportunityId:o.opportunity.id,expectedOpportunityRevision:1,title:'Real round',confirmationTime:{kind:'unknown'}});
  const conditions=Conditions.parse(Object.fromEntries(['role','location','guaranteedCash','variableIncome','equity','oneTime','paymentCycle','other'].map(key=>[key,{kind:'unknown'}])));
  check('offer',{operation:'offer.receive',commandId:crypto.randomUUID(),opportunityId:o.opportunity.id,expectedOpportunityRevision:2,conditions,original:{kind:'never_existed',explanation:'Only a verbal reality'},reason:'Real Offer received',businessTime:{kind:'unknown'}});
  const final=core.capabilities.readOpportunity(o.opportunity.id)!;expect(final).toMatchObject({phase:'offer',result:'active',stageDates:{submitted:{kind:'unknown'},interview:{kind:'unknown'},offer:{kind:'unknown'}}});expect(Object.keys(final)).not.toContain('preparation');
 }finally{db.close();}
});

import {expect,it} from 'vitest';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';
import {opportunityMigration} from '../../packages/backend/domains/opportunity/migration';
import {createOpportunityDomain} from '../../packages/backend/domains/opportunity/public';
it('real first Submission advances phase through its public capability, late first stays at Offer',()=>{
 const db=new Database(':memory:');db.exec(commandMigration+opportunityMigration);
 try{const owner=createOpportunityDomain(db);const company=owner.handle({operation:'company.create',commandId:randomUUID(),name:'G4 fixture'});if(company.kind!=='company')throw Error();
 const created=owner.handle({operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'G4'});if(created.kind!=='opportunity')throw Error();
 const {id}=created.opportunity;
 const first=owner.capabilities.recordStage({commandId:randomUUID(),opportunityId:id,expectedRevision:1,stage:'submitted',businessTime:{kind:'date',date:'2026-09-20'},reason:'真实首次投递'});
 expect(first.opportunity.phase).toBe('submitted');
 const history=owner.handle({operation:'history',id});expect(history.kind==='history'&&history.items[0].stageOwner).toBe('submission');
 const offered=owner.capabilities.recordStage({commandId:randomUUID(),opportunityId:id,expectedRevision:2,stage:'offer',businessTime:{kind:'unknown'},reason:'实际收到'});
 const late=owner.capabilities.recordStage({commandId:randomUUID(),opportunityId:id,expectedRevision:offered.opportunity.revision,stage:'submitted',businessTime:{kind:'date',date:'2026-09-18'},reason:'补录实际日期'});
 expect(late.opportunity.phase).toBe('offer');expect(late.opportunity.stageDates.submitted).toEqual({kind:'date',date:'2026-09-18'});
 const correction=owner.handle({operation:'correct-stage',commandId:randomUUID(),id,expectedRevision:late.opportunity.revision,eventId:first.eventId,stage:'submitted',voided:true,reason:'不能绕过 Submission',businessTime:{kind:'unknown'}});
 expect(correction).toEqual({kind:'failure',code:'invalid_transition'});
 }finally{db.close();}
});

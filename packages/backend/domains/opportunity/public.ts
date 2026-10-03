import type Database from 'better-sqlite3';
import {Request,Result,CompanyRequest,CoreRequest,ErrorCode} from '../../../contracts/opportunity/schema';
import {commandReceipt} from '../../platform/commands/receipts';
import {createCompanyDomain} from './company/public';
import {createOpportunityCore} from './core/public';
import type { OpportunityCapabilities } from '../../../contracts/opportunity/capabilities';
import { executeCommand } from '../../platform/commands/receipts';
export function createOpportunityDomain(db:Database.Database){
 const company=createCompanyDomain(db);const core=createOpportunityCore(db,{resolveCompany:company.resolveCompany});
 function handle(input:unknown):Result{
  const parsed=Request.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};
  try{const request=parsed.data;if(request.operation==='receipt'){const receipt=commandReceipt(db,'opportunity',request.commandId);return receipt===undefined?{kind:'receipt_missing'}:Result.parse(receipt);}const companyRequest=CompanyRequest.safeParse(request);return Result.parse(companyRequest.success?company.handle(companyRequest.data):core.handle(CoreRequest.parse(request)));}
  catch(error){const code=ErrorCode.safeParse(error instanceof Error?error.message:'storage_failed');return {kind:'failure',code:code.success?code.data:'storage_failed'};}
 }
 const capabilities: OpportunityCapabilities = {
  readCompany:company.resolveCompany,
  readOpportunity(id){try{const result=core.handle({operation:'read',id});if(result.kind!=='opportunity')throw Error('storage_failed');return result.opportunity;}catch(error){if(error instanceof Error&&error.message==='not_found')return undefined;throw error;}},
  recordStage(input){return executeCommand(db,'opportunity.stage-capability',input.commandId,input,()=>{
   const result=core.handle({operation:'record-stage',commandId:input.commandId,id:input.opportunityId,expectedRevision:input.expectedRevision,stage:input.stage,businessTime:input.businessTime,reason:input.reason},input.stage==='submitted'?'submission':input.stage);
   if(result.kind!=='opportunity')throw Error('storage_failed');
   const history=core.handle({operation:'history',id:input.opportunityId});if(history.kind!=='history')throw Error('storage_failed');
   const event=history.items.find(item=>item.revision===result.opportunity.revision);if(!event)throw Error('storage_failed');
   return {opportunity:result.opportunity,eventId:event.id};
  });},
  correctSubmissionTime(input){return executeCommand(db,'opportunity.submission-time-correction',input.commandId,input,()=>{const result=core.handle({operation:'correct-stage',commandId:input.commandId,id:input.opportunityId,expectedRevision:input.expectedRevision,eventId:input.eventId,stage:'submitted',voided:false,businessTime:input.businessTime,reason:input.reason},'submission');if(result.kind!=='opportunity')throw Error('storage_failed');return {opportunity:result.opportunity,eventId:input.eventId};});},
  correctInterviewConfirmation(input){return executeCommand(db,'opportunity.interview-confirmation-correction',input.commandId,input,()=>{const result=core.handle({operation:'correct-stage',commandId:input.commandId,id:input.opportunityId,expectedRevision:input.expectedRevision,eventId:input.eventId,stage:'interview',voided:false,businessTime:input.businessTime,reason:input.reason},'interview');if(result.kind!=='opportunity')throw Error('storage_failed');return {opportunity:result.opportunity,eventId:input.eventId};});},
  recordOfferEvent:core.recordOfferEvent,
 };
 return {handle,maintenanceObjects:core.maintenanceObjects,maintenanceCompanies:company.maintenanceObjects,resolveOpportunity:core.resolveOpportunity,capabilities,purgeImpact:core.purgeImpact,purge:core.purge,companyPurgeImpact:company.purgeImpact,purgeCompany:company.purge};
}

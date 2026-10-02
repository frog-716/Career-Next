import type Database from 'better-sqlite3';
import {Request,Result,CompanyRequest,CoreRequest,ErrorCode} from '../../../contracts/opportunity/schema';
import {commandReceipt} from '../../platform/commands/receipts';
import {createCompanyDomain} from './company/public';
import {createOpportunityCore} from './core/public';
export function createOpportunityDomain(db:Database.Database){
 const company=createCompanyDomain(db);const core=createOpportunityCore(db,{resolveCompany:company.resolveCompany});
 function handle(input:unknown):Result{
  const parsed=Request.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};
  try{const request=parsed.data;if(request.operation==='receipt'){const receipt=commandReceipt(db,'opportunity',request.commandId);return receipt===undefined?{kind:'receipt_missing'}:Result.parse(receipt);}const companyRequest=CompanyRequest.safeParse(request);return Result.parse(companyRequest.success?company.handle(companyRequest.data):core.handle(CoreRequest.parse(request)));}
  catch(error){const code=ErrorCode.safeParse(error instanceof Error?error.message:'storage_failed');return {kind:'failure',code:code.success?code.data:'storage_failed'};}
 }
 return {handle,resolveOpportunity:core.resolveOpportunity};
}

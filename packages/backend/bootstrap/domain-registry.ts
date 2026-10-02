import type Database from 'better-sqlite3';
import { createEmploymentDomain } from '../domains/employment/public';
import { createProjectDomain } from '../domains/project/public';
import { createOpportunityDomain } from '../domains/opportunity/public';
import { createProfileDomain } from '../domains/profile/public';
import { createResumeDomain } from '../domains/resume/public';
import { createWikiDomain } from '../domains/wiki/public';
import type { Store } from '../domains/materials/store';
import { Result as ResumeResult,Request as ResumeRequest } from '../../contracts/resume/schema';
import {printingMetadata} from './printing-metadata';
import { registerDomains } from './generated/routing';
export function composeDomains(db:Database.Database,materials:Store){
 const wiki=createWikiDomain(db,{resolveSource:materials.resolveSourceMetadata});
 const employment=createEmploymentDomain(db);
 const project=createProjectDomain(db,{resolveEmployment:employment.resolveEmployment,resolvePerson:employment.resolvePerson});
 const opportunity=createOpportunityDomain(db);
 const profile=createProfileDomain(db);
 const resume=createResumeDomain(db,{resolveOpportunity:opportunity.resolveOpportunity,profile});
 const metadata=printingMetadata();
 const printedResume={handle(input:unknown){const request=ResumeRequest.parse(input);return request.operation==='resume.name-version'?resume.prepareVersion(request,metadata):resume.handle(request);}};
 const handle=registerDomains({wiki,employment,project,opportunity,profile,resume:printedResume});
 return {handle,resume,pendingPrint(commandId:string){const result=ResumeResult.parse(resume.handle({operation:'resume.receipt',commandId}));if(result.status!=='pending-job')return undefined;return result.job;}};
}

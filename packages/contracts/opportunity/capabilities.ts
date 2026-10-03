import type { BusinessTime } from '../common/business-time';
import type { Company, OpportunityView } from './schema';

/** Backend-only public capabilities; not renderer commands or writable repositories. */
export interface OpportunityCapabilities {
  readOpportunity(id: string): OpportunityView | undefined;
  readCompany(id: string): Company | undefined;
  recordStage(input: {
    commandId: string;
    opportunityId: string;
    expectedRevision: number;
    stage: 'submitted' | 'interview' | 'offer';
    businessTime: BusinessTime;
    reason: string;
  }): { opportunity: OpportunityView; eventId: string };
  correctSubmissionTime(input: {commandId:string;opportunityId:string;expectedRevision:number;eventId:string;businessTime:BusinessTime;reason:string}):{opportunity:OpportunityView;eventId:string};
  correctInterviewConfirmation(input: {commandId:string;opportunityId:string;expectedRevision:number;eventId:string;businessTime:BusinessTime;reason:string}):{opportunity:OpportunityView;eventId:string};
  recordOfferEvent(input: {
    commandId: string;
    opportunityId: string;
    expectedRevision: number;
    action: 'accepted' | 'conditions_replaced' | 'recruiter_withdrew' | 'user_withdrew' | 'acceptance_corrected' | 'withdrawal_corrected';
    businessTime: BusinessTime;
    reason: string;
    basisId?: string;
    correctedEventId?: string;
    historical?: boolean;
  }): { opportunity: OpportunityView; eventId: string };
}

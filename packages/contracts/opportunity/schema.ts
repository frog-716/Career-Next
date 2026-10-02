import { z } from 'zod';
import { BusinessTime,CommandId,Revision } from '../common/business-time.ts';
export const Company=z.object({id:z.uuid(),name:z.string().trim().min(1).max(200),revision:Revision}).strict();
export type Company=z.infer<typeof Company>;
export const Phase=z.enum(['preparation','submitted','interview','offer']);
export type Phase=z.infer<typeof Phase>;
export const Outcome=z.enum(['active','accepted','recruiter_ended','withdrawn']);
export const Opportunity=z.object({id:z.uuid(),companyId:z.uuid(),role:z.string().trim().min(1).max(200),revision:Revision,phase:Phase,result:Outcome,stageDates:z.object({submitted:BusinessTime,interview:BusinessTime,offer:BusinessTime}).strict(),recordedAt:z.string()}).strict();
export type Opportunity=z.infer<typeof Opportunity>;
export const OpportunityView=Opportunity.extend({companyName:z.string()}).strict();
export type OpportunityView=z.infer<typeof OpportunityView>;
export const History=z.object({id:z.uuid(),opportunityId:z.uuid(),revision:Revision,type:z.enum(['created','identity_edited','identity_corrected','stage_reached','stage_corrected','ended','end_corrected','continued']),reason:z.string(),companyId:z.uuid(),role:z.string(),previousCompanyId:z.uuid().optional(),previousRole:z.string().optional(),businessTime:BusinessTime,phase:Phase,result:Outcome,stage:Phase.optional(),voided:z.boolean().optional(),previousResult:Outcome.optional(),correctedEventId:z.uuid().optional(),recordedAt:z.string()}).strict();
export type History=z.infer<typeof History>;
const Command={commandId:CommandId};const Existing={...Command,id:z.uuid(),expectedRevision:Revision};const Event={...Existing,reason:z.string().trim().min(1).max(1000),businessTime:BusinessTime};
export const CompanyRequest=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('company.create'),...Command,name:Company.shape.name}).strict(),
 z.object({operation:z.literal('company.rename'),...Existing,name:Company.shape.name}).strict(),
 z.object({operation:z.literal('company.list')}).strict(),
]);
export type CompanyRequest=z.infer<typeof CompanyRequest>;
export const CoreRequest=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('create'),...Command,companyId:z.uuid(),role:Opportunity.shape.role}).strict(),
 z.object({operation:z.literal('edit'),...Event,companyId:z.uuid(),role:Opportunity.shape.role,correction:z.boolean()}).strict(),
 z.object({operation:z.literal('record-stage'),...Event,stage:z.enum(['submitted','interview','offer'])}).strict(),
 z.object({operation:z.literal('correct-stage'),...Event,eventId:z.uuid(),stage:z.enum(['submitted','interview','offer']),voided:z.boolean()}).strict(),
 z.object({operation:z.literal('end'),...Event,outcome:z.enum(['withdrawn','recruiter_ended'])}).strict(),
 z.object({operation:z.literal('correct-end'),...Event}).strict(),
 z.object({operation:z.literal('recontinue'),...Event}).strict(),
 z.object({operation:z.literal('read'),id:z.uuid()}).strict(),
 z.object({operation:z.literal('list')}).strict(),
 z.object({operation:z.literal('history'),id:z.uuid()}).strict(),
]);
export type CoreRequest=z.infer<typeof CoreRequest>;
export const Request=z.discriminatedUnion('operation',[...CompanyRequest.options,...CoreRequest.options,z.object({operation:z.literal('receipt'),commandId:CommandId}).strict()]);
export type Request=z.infer<typeof Request>;
export const ErrorCode=z.enum(['invalid_request','not_found','conflict','invalid_transition','storage_failed']);
export const Result=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('company'),company:Company}).strict(),
 z.object({kind:z.literal('companies'),items:z.array(Company)}).strict(),
 z.object({kind:z.literal('opportunity'),opportunity:OpportunityView}).strict(),
 z.object({kind:z.literal('opportunities'),items:z.array(OpportunityView)}).strict(),
 z.object({kind:z.literal('history'),items:z.array(History)}).strict(),
 z.object({kind:z.literal('receipt_missing')}).strict(),
 z.object({kind:z.literal('failure'),code:ErrorCode}).strict(),
]);
export type Result=z.infer<typeof Result>;

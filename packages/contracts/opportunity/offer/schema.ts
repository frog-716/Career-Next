import { z } from 'zod';
import { BusinessTime, CommandId, Revision } from '../../common/business-time.ts';
import { SourceRef } from '../../materials/schema.ts';
import { OpportunityView } from '../schema.ts';
export const Condition = z.discriminatedUnion('kind', [z.object({kind:z.literal('unknown')}).strict(),z.object({kind:z.literal('known'),value:z.string().trim().min(1).max(4000)}).strict()]);
export const Conditions = z.object({role:Condition,location:Condition,guaranteedCash:Condition,variableIncome:Condition,equity:Condition,oneTime:Condition,paymentCycle:Condition,other:Condition}).strict();
export type Conditions = z.infer<typeof Conditions>;
const Missing = [z.object({kind:z.literal('never_existed'),explanation:z.string().trim().min(1).max(1000)}).strict(),z.object({kind:z.literal('historically_lost'),explanation:z.string().trim().min(1).max(1000)}).strict()] as const;
export const OriginalInput = z.discriminatedUnion('kind',[...Missing,z.object({kind:z.literal('retained'),source:SourceRef}).strict()]);
export type OriginalInput = z.infer<typeof OriginalInput>;
export const Original = z.discriminatedUnion('kind',[...Missing,z.object({kind:z.literal('retained'),source:SourceRef,name:z.string(),digest:z.string().regex(/^[a-f0-9]{64}$/)}).strict()]);
export const Offer = z.object({id:z.uuid(),opportunityId:z.uuid(),revision:Revision,conditionsId:z.uuid(),conditions:Conditions,original:Original,valid:z.boolean(),receivedAt:BusinessTime,recordedAt:z.string()}).strict();
export type Offer = z.infer<typeof Offer>;
export const AcceptanceBasis = z.object({id:z.uuid(),offerId:z.uuid(),opportunityId:z.uuid(),conditionsId:z.uuid(),conditions:Conditions,original:Original,acceptedAt:BusinessTime,recordedAt:z.string(),coreEventId:z.uuid()}).strict();
export type AcceptanceBasis = z.infer<typeof AcceptanceBasis>;
export const Event = z.object({id:z.uuid(),offerId:z.uuid(),opportunityId:z.uuid(),type:z.enum(['received','conditions_corrected','conditions_replaced','accepted','recruiter_withdrew','user_withdrew','acceptance_corrected','withdrawal_corrected']),reason:z.string(),businessTime:BusinessTime,recordedAt:z.string(),historical:z.boolean(),previousValid:z.boolean().optional(),conditionsId:z.uuid(),conditions:Conditions.optional(),original:Original.optional(),coreEventId:z.uuid().optional(),basisId:z.uuid().optional(),correctedEventId:z.uuid().optional()}).strict();
export type Event = z.infer<typeof Event>;
const Shared={commandId:CommandId,opportunityId:z.uuid(),expectedOpportunityRevision:Revision,businessTime:BusinessTime,reason:z.string().trim().min(1).max(1000)};
const Existing={...Shared,expectedRevision:Revision};
export const Request = z.discriminatedUnion('operation',[
 z.object({operation:z.literal('offer.read'),opportunityId:z.uuid()}).strict(),
 z.object({operation:z.literal('offer.history'),opportunityId:z.uuid()}).strict(),
 z.object({operation:z.literal('offer.receipt'),commandId:CommandId}).strict(),
 z.object({operation:z.literal('offer.receive'),...Shared,conditions:Conditions,original:OriginalInput}).strict(),
 z.object({operation:z.literal('offer.correct'),...Existing,conditions:Conditions}).strict(),
 z.object({operation:z.literal('offer.replace'),...Existing,conditions:Conditions,original:OriginalInput,historical:z.boolean().default(false)}).strict(),
 z.object({operation:z.literal('offer.accept'),...Existing,historical:z.boolean(),previousValid:z.boolean().optional(),conditionsId:z.uuid().optional()}).strict(),
 z.object({operation:z.literal('offer.withdraw'),...Existing,by:z.enum(['recruiter','user']),historical:z.boolean()}).strict(),
 z.object({operation:z.literal('offer.correct-acceptance'),...Existing,coreEventId:z.uuid()}).strict(),
 z.object({operation:z.literal('offer.correct-withdrawal'),...Existing,coreEventId:z.uuid()}).strict(),
]);
export type Request = z.infer<typeof Request>;
export const Result = z.discriminatedUnion('kind',[
 z.object({kind:z.literal('offer'),offer:Offer,opportunity:OpportunityView}).strict(),
 z.object({kind:z.literal('empty'),opportunity:OpportunityView}).strict(),
 z.object({kind:z.literal('history'),events:z.array(Event),acceptances:z.array(AcceptanceBasis)}).strict(),
 z.object({kind:z.literal('receipt_missing')}).strict(),
 z.object({kind:z.literal('failure'),code:z.enum(['invalid_request','not_found','conflict','already_exists','invalid_transition','source_unavailable','accepted_conditions_protected','storage_failed'])}).strict(),
]);
export type Result = z.infer<typeof Result>;

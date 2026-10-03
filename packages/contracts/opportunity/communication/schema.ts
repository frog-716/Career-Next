import {z} from 'zod';
import {BusinessTime,CommandId,Revision} from '../../common/business-time.ts';
import {CommunicationSourceRef} from '../../common/source-ref.ts';
import {SentResumeInput,SentResume,Greeting} from '../submission/schema.ts';
export const Communication=z.strictObject({id:z.uuid(),opportunityId:z.uuid(),revision:Revision,source:CommunicationSourceRef,medium:z.enum(['text','phone','other']),purpose:z.enum(['general','salary','offer_followup','preemployment','resend']),text:z.string().max(256000),businessTime:BusinessTime,recordedAt:z.string().datetime(),historical:z.boolean(),archived:z.boolean(),sentMaterial:SentResume.optional(),greeting:Greeting.optional()});
export type Communication=z.infer<typeof Communication>;
const Shared={commandId:CommandId,businessTime:BusinessTime,reason:z.string().trim().min(1).max(2000)};
export const Request=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('communication.list'),opportunityId:z.uuid()}),
 z.strictObject({operation:z.literal('communication.read'),id:z.uuid()}),
 z.strictObject({operation:z.literal('communication.history'),id:z.uuid()}),
 z.strictObject({operation:z.literal('communication.receipt'),commandId:CommandId}),
 z.strictObject({operation:z.literal('communication.record'),...Shared,opportunityId:z.uuid(),medium:z.enum(['text','phone','other']),purpose:z.enum(['general','salary','offer_followup','preemployment']),text:z.string().min(1).max(256000),historical:z.boolean()}),
 z.strictObject({operation:z.literal('communication.resend'),...Shared,opportunityId:z.uuid(),text:z.string().max(256000),resume:SentResumeInput,greeting:Greeting,historical:z.boolean()}),
 z.strictObject({operation:z.literal('communication.correct'),...Shared,id:z.uuid(),expectedRevision:Revision,text:z.string().min(1).max(256000)}),
 z.strictObject({operation:z.literal('communication.archive'),commandId:CommandId,id:z.uuid(),expectedRevision:Revision,archived:z.boolean(),reason:z.string().trim().min(1).max(2000)})
]);
export type Request=z.infer<typeof Request>;
export const History=z.strictObject({id:z.uuid(),communicationId:z.uuid(),revision:Revision,type:z.enum(['recorded','text_corrected','archived','restored']),reason:z.string(),businessTime:BusinessTime,recordedAt:z.string()});
export const Result=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('saved'),id:z.uuid(),revision:Revision}),
 z.strictObject({kind:z.literal('communication'),communication:Communication}),
 z.strictObject({kind:z.literal('list'),items:z.array(Communication)}),
 z.strictObject({kind:z.literal('history'),items:z.array(History)}),
 z.strictObject({kind:z.literal('receipt_missing')}),
 z.strictObject({kind:z.literal('purged'),id:z.uuid()}),
 z.strictObject({kind:z.literal('failure'),code:z.enum(['invalid_request','not_found','conflict','first_submission_required','source_unavailable','storage_failed'])})
]);
export type Result=z.infer<typeof Result>;

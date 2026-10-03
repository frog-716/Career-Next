import {z} from 'zod';
import {BusinessTime,CommandId,Revision} from '../../common/business-time.ts';
import {Snapshot,PdfArtifact} from '../../resume/schema.ts';
import {OpportunityView} from '../schema.ts';
const Explanation=z.string().trim().min(1).max(2000);
export const Candidate=z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('resume'),id:z.uuid()}),z.strictObject({kind:z.literal('artifact'),id:z.uuid()})]);
const Missing=[z.strictObject({kind:z.literal('not_used')}),z.strictObject({kind:z.literal('content_unknown'),explanation:Explanation}),z.strictObject({kind:z.literal('file_missing'),knownContent:z.string().min(1).max(500000),explanation:Explanation})] as const;
export const SentResumeInput=z.discriminatedUnion('kind',[...Missing,z.strictObject({kind:z.literal('retained'),candidate:Candidate})]);
export type SentResumeInput=z.infer<typeof SentResumeInput>;
export const SentResume=z.discriminatedUnion('kind',[...Missing,z.strictObject({kind:z.literal('retained'),candidate:Candidate,name:z.string(),pdf:PdfArtifact,snapshot:Snapshot.optional()})]);
export type SentResume=z.infer<typeof SentResume>;
export const Greeting=z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('not_used')}),z.strictObject({kind:z.literal('empty')}),z.strictObject({kind:z.literal('unknown')}),z.strictObject({kind:z.literal('known'),text:z.string().min(1).max(20000)})]);
export const Submission=z.strictObject({id:z.uuid(),opportunityId:z.uuid(),revision:Revision,resume:SentResume,greeting:Greeting,businessTime:BusinessTime,recordedAt:z.string().datetime(),historical:z.boolean(),coreEventId:z.uuid()});
export type Submission=z.infer<typeof Submission>;
export const Request=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('submission.read'),opportunityId:z.uuid()}),
 z.strictObject({operation:z.literal('submission.receipt'),commandId:CommandId}),
 z.strictObject({operation:z.literal('submission.correct-time'),commandId:CommandId,opportunityId:z.uuid(),expectedOpportunityRevision:Revision,expectedRevision:Revision,businessTime:BusinessTime,reason:Explanation}),
 z.strictObject({operation:z.literal('submission.record-first'),commandId:CommandId,opportunityId:z.uuid(),expectedOpportunityRevision:Revision,resume:SentResumeInput,greeting:Greeting,businessTime:BusinessTime,reason:Explanation,historical:z.boolean()})
]);
export type Request=z.infer<typeof Request>;
export const Result=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('submission'),submission:Submission,opportunity:OpportunityView}),
 z.strictObject({kind:z.literal('empty'),opportunity:OpportunityView}),
 z.strictObject({kind:z.literal('purged'),id:z.uuid()}),
 z.strictObject({kind:z.literal('receipt_missing')}),
 z.strictObject({kind:z.literal('failure'),code:z.enum(['invalid_request','not_found','conflict','already_exists','source_unavailable','storage_failed'])})
]);
export type Result=z.infer<typeof Result>;

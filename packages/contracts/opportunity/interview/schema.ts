import {z} from 'zod';
import {BusinessTime} from '../../common/business-time.ts';
const Id=z.uuid(),Revision=z.number().int().positive();
export const RoundState=z.enum(['awaiting_schedule','scheduled','awaiting_rebooking','completed','permanently_cancelled']);
export type RoundState=z.infer<typeof RoundState>;
export const Session=z.strictObject({id:Id,opportunityId:Id,revision:Revision,title:z.string().trim().min(1).max(200),kind:z.enum(['real','simulation']),realRoundId:Id.optional(),state:z.enum([...RoundState.options,'pending','cancelled']),confirmationTime:BusinessTime,scheduledTime:BusinessTime,completionTime:BusinessTime,stageEventId:Id.optional(),recordedAt:z.iso.datetime(),preparation:z.string().max(100000).optional(),transcript:z.strictObject({text:z.string().max(100000),version:Revision}).optional(),finalReview:z.strictObject({text:z.string().max(100000),transcriptVersion:Revision.nullable(),needsRecheck:z.boolean()}).optional()});
export type Session=z.infer<typeof Session>;
export const History=z.strictObject({id:Id,sessionId:Id,type:z.string(),reason:z.string().max(2000),previousState:z.string().optional(),state:z.string(),businessTime:BusinessTime,recordedAt:z.iso.datetime()});
export type History=z.infer<typeof History>;
const base={commandId:Id};
export const Request=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('interview.list'),opportunityId:Id}),
 z.strictObject({operation:z.literal('interview.read'),id:Id}),
 z.strictObject({operation:z.literal('interview.history'),id:Id}),
 z.strictObject({operation:z.literal('interview.confirm'),...base,opportunityId:Id,expectedOpportunityRevision:Revision,title:Session.shape.title,confirmationTime:BusinessTime}),
 z.strictObject({operation:z.literal('interview.create-simulation'),...base,opportunityId:Id,realRoundId:Id,title:Session.shape.title}),
 z.strictObject({operation:z.literal('interview.transition-simulation'),...base,id:Id,expectedRevision:Revision,state:z.enum(['pending','completed','cancelled']),businessTime:BusinessTime,reason:z.string().trim().min(1).max(2000)}),
 z.strictObject({operation:z.literal('interview.save-document'),...base,id:Id,expectedRevision:Revision,document:z.enum(['preparation','transcript','final-review']),text:z.string().max(100000)}),
 z.strictObject({operation:z.literal('interview.transition'),...base,id:Id,expectedRevision:Revision,action:z.enum(['schedule','temporarily_cancel','complete','permanently_cancel']),businessTime:BusinessTime,reason:z.string().trim().min(1).max(2000)}),
 z.strictObject({operation:z.literal('interview.correct-time'),...base,id:Id,expectedRevision:Revision,expectedOpportunityRevision:Revision,field:z.enum(['confirmation','scheduled','completion']),businessTime:BusinessTime,reason:z.string().trim().min(1).max(2000)}),
 z.strictObject({operation:z.literal('interview.correct-terminal'),...base,id:Id,expectedRevision:Revision,state:RoundState,businessTime:BusinessTime,reason:z.string().trim().min(1).max(2000)}),
 z.strictObject({operation:z.literal('interview.receipt'),commandId:Id}),
]);
export type Request=z.infer<typeof Request>;
export const ErrorCode=z.enum(['invalid_request','content_purged','not_found','conflict','invalid_transition','invalid_relation','storage_failed']);
export const Result=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('session'),session:Session}),
 z.strictObject({kind:z.literal('sessions'),items:z.array(Session),opportunityRevision:Revision}),
 z.strictObject({kind:z.literal('history'),items:z.array(History)}),
 z.strictObject({kind:z.literal('saved'),id:Id,revision:Revision}),
 z.strictObject({kind:z.literal('receipt_missing')}),
 z.strictObject({kind:z.literal('failure'),code:ErrorCode}),
]);
export type Result=z.infer<typeof Result>;

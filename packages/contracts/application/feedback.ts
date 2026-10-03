import {z} from 'zod';
export const Screenshot=z.strictObject({blobId:z.uuid(),name:z.string().max(255),digest:z.string().regex(/^[a-f0-9]{64}$/),size:z.number().int().positive().max(2*1024*1024),mime:z.enum(['image/png','image/jpeg','image/webp'])});
export const Feedback=z.strictObject({id:z.uuid(),revision:z.number().int().positive(),location:z.strictObject({path:z.string().max(500).regex(/^\/[a-zA-Z0-9/_-]*$/),version:z.string().max(100)}),entries:z.array(z.strictObject({text:z.string().trim().min(1).max(10000),recordedAt:z.string().datetime()})).min(1).max(200),screenshot:Screenshot.optional(),archived:z.boolean(),recordedAt:z.string().datetime()});
const existing={commandId:z.uuid(),id:z.uuid(),expectedRevision:z.number().int().positive()};
export const FeedbackRequest=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('feedback.create'),commandId:z.uuid(),text:z.string().trim().min(1).max(10000),location:Feedback.shape.location,screenshotCandidateId:z.uuid().optional()}),
 z.strictObject({operation:z.literal('feedback.append'),...existing,text:z.string().trim().min(1).max(10000)}),
 z.strictObject({operation:z.literal('feedback.archive'),...existing,archived:z.boolean()}),
 z.strictObject({operation:z.literal('feedback.list')}),
 z.strictObject({operation:z.literal('feedback.read'),id:z.uuid()}),
 z.strictObject({operation:z.literal('feedback.export'),id:z.uuid()}),
 z.strictObject({operation:z.literal('feedback.receipt'),commandId:z.uuid()})
]);
export const FeedbackResult=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('feedback'),feedback:Feedback}),
 z.strictObject({kind:z.literal('feedback_list'),items:z.array(Feedback).max(500)}),
 z.strictObject({kind:z.literal('feedback_conflict'),feedback:Feedback}),
 z.strictObject({kind:z.literal('feedback_export'),filename:z.string().max(255),text:z.string().max(4*1024*1024)})
]);
export type Feedback=z.infer<typeof Feedback>;export type Screenshot=z.infer<typeof Screenshot>;export type FeedbackRequest=z.infer<typeof FeedbackRequest>;

export type FeedbackResult=z.infer<typeof FeedbackResult>;

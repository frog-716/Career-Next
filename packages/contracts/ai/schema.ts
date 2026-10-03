import {SearchRequest,SearchResult} from './search.ts';
import {ProductRequest,ProductResult} from './product.ts';
import {z} from 'zod';
import {SourceRef} from '../common/source-ref.ts';
import {Provenance,Target,Content,Recipient,Budget,Change,ProposalState} from './protocol.ts';
import {Operation} from './execution.ts';
export * from './protocol.ts';
export * from './execution.ts';
const Before=Content.extend({id:z.uuid(),revision:z.number().int().positive()}).strict();
export const WikiRequest=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('ai.prepare'),commandId:z.uuid(),sources:z.array(SourceRef).min(1).max(20),target:Target,budget:Budget}).strict(),
 z.object({operation:z.literal('ai.authorize'),commandId:z.uuid(),operationId:z.uuid(),manifestDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({operation:z.literal('ai.retry-explicit'),commandId:z.uuid(),taskId:z.uuid(),acknowledgeUnknown:z.literal(true)}).strict(),
 z.object({operation:z.literal('ai.read'),taskId:z.uuid()}).strict(),
 z.object({operation:z.literal('ai.list')}).strict(),
 z.object({operation:z.literal('ai.stop'),commandId:z.uuid(),taskId:z.uuid(),mode:z.enum(['stop','revoke'])}).strict(),
 z.object({operation:z.literal('ai.decide'),commandId:z.uuid(),proposalId:z.uuid(),action:z.enum(['accept','edit-accept','reject','ignore']),edited:Content.optional()}).strict(),
 z.object({operation:z.literal('ai.receipt'),commandId:z.uuid()}).strict(),
]);
export type WikiRequest=z.infer<typeof WikiRequest>;
export const Proposal=z.object({id:z.uuid(),taskId:z.uuid(),operationId:z.uuid(),target:Target,change:Change,before:Before.optional(),dependencies:z.array(z.object({owner:z.string().max(80),objectId:z.string().max(160),revision:z.number().int().positive(),role:z.enum(['target','evidence'])}).strict()).max(1000),provenance:z.array(Provenance).max(1000),sources:z.array(SourceRef).max(20),state:ProposalState,ignored:z.boolean(),validity:z.enum(['current','stale','conflict','source_unavailable']),receiptId:z.uuid().optional()}).strict();
export type Proposal=z.infer<typeof Proposal>;
export const Task=z.object({id:z.uuid(),policy:z.literal('wiki-organize'),target:Target,sources:z.array(SourceRef).max(20),budget:Budget,usedRequests:z.number().int().nonnegative(),state:z.enum(['awaiting_authorization','running','needs_attention','completed','stopped','revoked','purged']),contentAvailability:z.enum(['available','some_unavailable']).optional(),operations:z.array(Operation).max(20),proposals:z.array(Proposal).max(400)}).strict();
export type Task=z.infer<typeof Task>;
const TaskResult=z.object({kind:z.literal('task'),task:Task}).strict();
const DecidedResult=z.object({kind:z.literal('decided'),proposalId:z.uuid(),state:z.enum(['pending','accepted','rejected']),receiptId:z.uuid()}).strict();
const FailureResult=z.object({kind:z.literal('failure'),code:z.string().max(500)}).strict();
export const WikiResult=z.discriminatedUnion('kind',[
 TaskResult,
 z.object({kind:z.literal('tasks'),tasks:z.array(Task).max(100)}).strict(),
 DecidedResult,
 z.object({kind:z.literal('receipt'),receipt:z.union([TaskResult,DecidedResult,FailureResult])}).strict(),
 z.object({kind:z.literal('receipt_missing')}).strict(),
 FailureResult,
]);
export type WikiResult=z.infer<typeof WikiResult>;

export const Request=z.discriminatedUnion('operation',[...WikiRequest.options,...ProductRequest.options,...SearchRequest.options]);export type Request=z.infer<typeof Request>;
export const Result=z.discriminatedUnion('kind',[...WikiResult.options,...ProductResult.options,...SearchResult.options]);export type Result=z.infer<typeof Result>;

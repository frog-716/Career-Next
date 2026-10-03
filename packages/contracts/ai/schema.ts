import {z} from 'zod';
import {SourceRef} from '../common/source-ref.ts';
export const Target=z.object({scope:z.enum(['personal','cognition','project','employment','person','opportunity']),scopeId:z.uuid().optional()}).strict().refine(value=>['personal','cognition'].includes(value.scope)?value.scopeId===undefined:value.scopeId!==undefined,'object scope requires identity');
export type Target=z.infer<typeof Target>;
export const Budget=z.object({requests:z.number().int().min(1).max(10),inputBytes:z.number().int().min(1).max(1048576),outputBytes:z.number().int().min(1).max(262144)}).strict();
export type Budget=z.infer<typeof Budget>;
export const Content=z.object({title:z.string().trim().min(1).max(200),body:z.string().trim().min(1).max(64000),nature:z.enum(['fact_statement','observation','hypothesis'])}).strict();
export type Content=z.infer<typeof Content>;
const Explanation={reason:z.string().trim().min(1).max(1000),citations:z.array(z.uuid()).max(20),unknowns:z.array(z.string().max(500)).max(20)};
export const Change=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('create'),content:Content,...Explanation}).strict(),
 z.object({kind:z.literal('edit'),itemId:z.uuid(),content:Content,...Explanation}).strict(),
 z.object({kind:z.literal('retire'),itemId:z.uuid(),...Explanation}).strict(),
]);
export type Change=z.infer<typeof Change>;
export const ProviderOutput=z.object({proposals:z.array(Change).max(20)}).strict();
export type ProviderOutput=z.infer<typeof ProviderOutput>;
export const Request=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('ai.prepare'),commandId:z.uuid(),sources:z.array(SourceRef).min(1).max(20),target:Target,budget:Budget}).strict(),
 z.object({operation:z.literal('ai.authorize'),commandId:z.uuid(),operationId:z.uuid(),manifestDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({operation:z.literal('ai.retry-explicit'),commandId:z.uuid(),taskId:z.uuid(),acknowledgeUnknown:z.literal(true)}).strict(),
 z.object({operation:z.literal('ai.read'),taskId:z.uuid()}).strict(),
 z.object({operation:z.literal('ai.list')}).strict(),
 z.object({operation:z.literal('ai.stop'),commandId:z.uuid(),taskId:z.uuid(),mode:z.enum(['stop','revoke'])}).strict(),
 z.object({operation:z.literal('ai.decide'),commandId:z.uuid(),proposalId:z.uuid(),action:z.enum(['accept','edit-accept','reject','ignore']),edited:Content.optional()}).strict(),
 z.object({operation:z.literal('ai.receipt'),commandId:z.uuid()}).strict(),
]);
export type Request=z.infer<typeof Request>;
export const Recipient=z.object({service:z.string().min(1).max(100),endpoint:z.string().min(1).max(500),account:z.string().min(1).max(100),generation:z.string().min(1).max(100),model:z.string().min(1).max(100)}).strict();
export const OperationState=z.enum(['not_sent','dispatching','processing','success','failure','outcome_unknown']);
export const ProposalState=z.enum(['pending','accepted','rejected']);
export {Provenance} from '../common/provenance.ts';
import {Provenance} from '../common/provenance.ts';
const Before=Content.extend({id:z.uuid(),revision:z.number().int().positive()}).strict();
export const Manifest=z.object({taskId:z.uuid(),target:Target,recipient:Recipient,granularity:z.literal('fulltext'),system:z.string().max(2000),tools:z.tuple([]),materials:z.array(z.object({ref:SourceRef,body:z.string().max(262144),nature:z.string().max(80)}).strict()).max(20),knowledge:z.array(Before).max(500),budget:Budget,validity:z.object({workspaceInstance:z.string().min(1),backendGeneration:z.string().min(1),expiresAt:z.iso.datetime()}).strict(),stopBoundary:z.literal('before-handoff'),provenance:z.array(Provenance).max(1000)}).strict();
export type Manifest=z.infer<typeof Manifest>;
export const Operation=z.object({id:z.uuid(),taskId:z.uuid(),state:OperationState,manifestDigest:z.string().regex(/^[a-f0-9]{64}$/),manifest:Manifest.optional(),provenance:z.array(Provenance).max(1000),recipient:Recipient,reserved:Budget,actualOutputBytes:z.number().int().nonnegative().optional(),reason:z.string().max(500).optional(),authorized:z.boolean()}).strict();
export type Operation=z.infer<typeof Operation>;
export const Proposal=z.object({id:z.uuid(),taskId:z.uuid(),operationId:z.uuid(),target:Target,change:Change,before:Before.optional(),dependencies:z.array(z.object({owner:z.string().max(80),objectId:z.string().max(160),revision:z.number().int().positive(),role:z.enum(['target','evidence'])}).strict()).max(1000),provenance:z.array(Provenance).max(1000),sources:z.array(SourceRef).max(20),state:ProposalState,ignored:z.boolean(),validity:z.enum(['current','stale','conflict','source_unavailable']),receiptId:z.uuid().optional()}).strict();
export type Proposal=z.infer<typeof Proposal>;
export const Task=z.object({id:z.uuid(),policy:z.literal('wiki-organize'),target:Target,sources:z.array(SourceRef).max(20),budget:Budget,usedRequests:z.number().int().nonnegative(),state:z.enum(['awaiting_authorization','running','needs_attention','completed','stopped','revoked','purged']),contentAvailability:z.enum(['available','some_unavailable']).optional(),operations:z.array(Operation).max(20),proposals:z.array(Proposal).max(400)}).strict();
export type Task=z.infer<typeof Task>;
const TaskResult=z.object({kind:z.literal('task'),task:Task}).strict();
const DecidedResult=z.object({kind:z.literal('decided'),proposalId:z.uuid(),state:z.enum(['pending','accepted','rejected']),receiptId:z.uuid()}).strict();
const FailureResult=z.object({kind:z.literal('failure'),code:z.string().max(500)}).strict();
export const Result=z.discriminatedUnion('kind',[
 TaskResult,
 z.object({kind:z.literal('tasks'),tasks:z.array(Task).max(100)}).strict(),
 DecidedResult,
 z.object({kind:z.literal('receipt'),receipt:z.union([TaskResult,DecidedResult,FailureResult])}).strict(),
 z.object({kind:z.literal('receipt_missing')}).strict(),
 FailureResult,
]);
export type Result=z.infer<typeof Result>;

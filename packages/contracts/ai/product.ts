import {Document,ResumeBlock} from '../resume/schema.ts';
import {z} from 'zod';
import {SourceRef} from '../common/source-ref.ts';
import {Provenance} from '../common/provenance.ts';
import {Budget,Change,Content} from './protocol.ts';
import {Operation} from './execution.ts';
import {ProductTarget,Dependency} from './product-context.ts';
export const ProductInput=z.strictObject({target:ProductTarget,sources:z.array(SourceRef).max(20),egressSourceIds:z.array(z.uuid()).max(20),wikiIds:z.array(z.uuid()).max(20),egressWikiIds:z.array(z.uuid()).max(20),objects:z.array(z.strictObject({owner:z.enum(['project','employment']),objectId:z.uuid(),egress:z.boolean()})).max(20)});
export type ProductInput=z.infer<typeof ProductInput>;
export const ResumeBlockChange=z.strictObject({kind:z.literal('resume-block'),blockId:z.uuid(),after:ResumeBlock,reason:z.string().trim().min(1).max(1000),citations:z.array(z.uuid()).max(20),unknowns:z.array(z.string().max(500)).max(20)});
export const ResumeAddChange=ResumeBlockChange.omit({kind:true,blockId:true}).extend({kind:z.literal('resume-add'),afterBlockId:z.uuid()}).strict();
export const ResumeDeleteChange=ResumeBlockChange.omit({kind:true,after:true}).extend({kind:z.literal('resume-delete')}).strict();
export const ProductChange=z.union([Change,ResumeBlockChange,ResumeAddChange,ResumeDeleteChange]);export type ProductChange=z.infer<typeof ProductChange>;
export const ProductProviderOutput=z.strictObject({proposals:z.array(ProductChange).max(20)});
export const ProductProposal=z.strictObject({id:z.uuid(),taskId:z.uuid(),operationId:z.uuid(),target:ProductTarget,change:ProductChange,dependencies:z.array(Dependency).max(1000),sources:z.array(SourceRef).max(20),provenance:z.array(Provenance).max(1000),state:z.enum(['pending','accepted','rejected']),ignored:z.boolean(),validity:z.enum(['current','stale','conflict','source_unavailable']),receiptId:z.uuid().optional(),adoptedContent:Content.optional()});
export type ProductProposal=z.infer<typeof ProductProposal>;
export const ProductTask=z.strictObject({id:z.uuid(),policy:z.string().max(80),input:ProductInput.optional(),budget:Budget,usedRequests:z.number().int().nonnegative(),state:z.enum(['awaiting_authorization','running','needs_attention','completed','stopped','revoked','purged']),contentAvailability:z.enum(['available','some_unavailable']).optional(),operations:z.array(Operation).max(20),proposals:z.array(ProductProposal).max(400)});
export type ProductTask=z.infer<typeof ProductTask>;
export const ProductRequest=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('product.prepare'),commandId:z.uuid(),input:ProductInput,budget:Budget}),
 z.strictObject({operation:z.literal('product.authorize'),commandId:z.uuid(),operationId:z.uuid(),manifestDigest:z.string().regex(/^[a-f0-9]{64}$/)}),
 z.strictObject({operation:z.literal('product.read'),taskId:z.uuid()}),
 z.strictObject({operation:z.literal('product.list')}),
 z.strictObject({operation:z.literal('product.stop'),commandId:z.uuid(),taskId:z.uuid(),mode:z.enum(['stop','revoke'])}),
 z.strictObject({operation:z.literal('product.resume'),commandId:z.uuid(),taskId:z.uuid(),acknowledgeStopped:z.literal(true)}),
 z.strictObject({operation:z.literal('product.retry-explicit'),commandId:z.uuid(),taskId:z.uuid(),acknowledgeUnknown:z.literal(true)}),
 z.strictObject({operation:z.literal('product.decide'),commandId:z.uuid(),proposalIds:z.array(z.uuid()).min(1).max(20),action:z.enum(['accept','edit-accept','reject','ignore']),edited:z.union([Content,ResumeBlock]).optional()}),
 z.strictObject({operation:z.literal('product.receipt'),commandId:z.uuid()})
]);
export type ProductRequest=z.infer<typeof ProductRequest>;
export const ResumeApplication=z.strictObject({before:Document,after:Document});export type ResumeApplication=z.infer<typeof ResumeApplication>;
const Decided=z.strictObject({kind:z.literal('product_decided'),proposalIds:z.array(z.uuid()).max(20),state:z.enum(['pending','accepted','rejected']),receiptId:z.uuid(),owner:z.string().max(80),objectId:z.string().max(160),resumeApplication:ResumeApplication.optional()});
const One=z.strictObject({kind:z.literal('product_task'),task:ProductTask});
export const ProductResult=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('product_conflict'),code:z.string().max(100),proposalIds:z.array(z.uuid()).min(1).max(20)}),
 One,z.strictObject({kind:z.literal('product_tasks'),tasks:z.array(ProductTask).max(100)}),Decided,
 z.strictObject({kind:z.literal('product_receipt'),receipt:z.union([One,Decided,z.strictObject({kind:z.literal('failure'),code:z.string().max(500)})])})
]);
export type ProductResult=z.infer<typeof ProductResult>;

import { z } from 'zod';
export const MAX_TEXT_BYTES = 256 * 1024;
export { Identity } from '../common/runtime.ts';
import type { Identity } from '../common/runtime.ts';
import {FeishuDocumentSource,FeishuDocumentProvenance,FeishuDocumentLimitations,FeishuDocumentReadBoundary} from '../platform/feishu-document.ts';
import {BitableRecordSource,BitableRawProvenance} from '../platform/feishu-bitable-raw-preview.ts';
export {MaterialsSourceRef as SourceRef} from '../common/source-ref.ts';
import {MaterialsSourceRef as SourceRef} from '../common/source-ref.ts';
export type SourceRef = z.infer<typeof SourceRef>;
export const ImportTarget=z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('personal')}),z.strictObject({kind:z.enum(['company','opportunity','project','employment','person']),id:z.uuid()})]);export type ImportTarget=z.infer<typeof ImportTarget>;
// Source revision is external; Materials SourceRef and local Raw revision remain 1.
export const FeishuOrigin=z.strictObject({kind:z.literal('feishu'),identity:z.literal('user'),url:z.url().max(2000),wikiNodeId:z.string().regex(/^[A-Za-z0-9]{1,128}$/),documentId:z.string().regex(/^[A-Za-z0-9]{1,128}$/),revisionId:z.number().int().positive()}).refine(value=>{const url=new URL(value.url);return url.protocol==='https:'&&!url.username&&!url.password&&url.hostname.endsWith('.feishu.cn')&&url.pathname==='/wiki/'+value.wikiNodeId&&!url.search&&!url.hash;},'Selected Feishu wiki URL must match its node identity');
export type FeishuOrigin=z.infer<typeof FeishuOrigin>;
export const FeishuBitableRecordOrigin=z.strictObject({kind:z.literal('feishu_bitable_record'),identity:z.literal('user'),source:BitableRecordSource,provenance:BitableRawProvenance,confirmationCommandId:z.uuid()}).refine(({source,provenance})=>source.bitableRef===provenance.bitable_ref&&source.tableRef===provenance.table_ref&&source.viewRef===provenance.view_ref,'Bitable source references must match provenance');
export const FeishuDocumentOrigin=z.strictObject({kind:z.literal('feishu_document'),identity:z.literal('user'),source:FeishuDocumentSource,provenance:FeishuDocumentProvenance,limitations:FeishuDocumentLimitations,readBoundary:FeishuDocumentReadBoundary,confirmationCommandId:z.uuid()});
export const MaterialOrigin=z.union([FeishuOrigin,FeishuBitableRecordOrigin,FeishuDocumentOrigin]);
export type MaterialOrigin=z.infer<typeof MaterialOrigin>;
export const Preview = z.object({ importId: z.uuid(), target:ImportTarget.optional(), origin:MaterialOrigin.optional(), revision: z.literal(1), name: z.string().max(255), size: z.number().int().max(MAX_TEXT_BYTES), digest: z.string().regex(/^[a-f0-9]{64}$/), text: z.string().max(MAX_TEXT_BYTES), saved: z.literal(false) }).strict();
export type Preview = z.infer<typeof Preview>;
export const RawSummary = z.object({ id: z.uuid(), name: z.string().max(255), size: z.number().int(), scope: z.enum(['personal','company','opportunity','project','employment','person']),scopeId:z.uuid().optional(), origin:MaterialOrigin.optional(), lifecycle: z.literal('evidence-original'), revision: z.literal(1), source: SourceRef, recordedAt: z.string() }).strict();
export type RawSummary = z.infer<typeof RawSummary>;
export const Raw = RawSummary.extend({ text: z.string().max(MAX_TEXT_BYTES), digest: z.string() }).strict();
export type Raw = z.infer<typeof Raw>;
export const Confirm = z.object({ commandId: z.uuid(), importId: z.uuid(), expectedRevision: z.literal(1), digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export type Confirm = z.infer<typeof Confirm>;
export const ErrorCode = z.enum(['unsupported_file','file_failed','storage_failed','db_failed','conflict','invalid_capability','not_found','content_unavailable','disconnected','outcome_unknown','invalid_request','workspace_busy']);
export type ErrorCode = z.infer<typeof ErrorCode>;
export const Receipt = z.discriminatedUnion('status', [
  z.object({ status: z.literal('committed'), commandId: z.uuid(), materialId: z.uuid(), source: SourceRef }).strict(),
  z.object({ status: z.literal('failed'), commandId: z.uuid(), code: ErrorCode }).strict(),
  z.object({ status: z.literal('pending'), commandId: z.uuid() }).strict(),
  z.object({ status: z.literal('not_found'), commandId: z.uuid() }).strict(),
]);
export type Receipt = z.infer<typeof Receipt>;
export const Request = z.discriminatedUnion('operation', [
  z.strictObject({operation:z.literal('fixture-candidates'),target:ImportTarget}),
  z.strictObject({operation:z.literal('fixture-body'),target:ImportTarget,candidateId:z.uuid()}),
  z.object({ operation: z.literal('select'),target:ImportTarget.optional() }).strict(),
  z.object({ operation: z.literal('confirm'), input: Confirm }).strict(),
  z.object({ operation: z.literal('cancel'), importId: z.uuid() }).strict(),
  z.object({ operation: z.literal('list') }).strict(),
  z.object({ operation: z.literal('read'), materialId: z.uuid() }).strict(),
  z.object({ operation: z.literal('receipt'), commandId: z.uuid() }).strict(),
]);
export type Request = z.infer<typeof Request>;
export const Result = z.discriminatedUnion('kind', [
  z.strictObject({kind:z.literal('fixture-candidates'),target:ImportTarget,adapter:z.literal('controlled-feishu-shaped-fixture; no network'),candidates:z.array(z.strictObject({id:z.uuid(),title:z.string().max(255),url:z.url()})).max(20)}),
  z.object({ kind: z.literal('preview'), preview: Preview }).strict(),
  z.object({ kind: z.literal('cancelled') }).strict(),
  z.object({ kind: z.literal('receipt'), receipt: Receipt }).strict(),
  z.object({ kind: z.literal('raw'), raw: Raw }).strict(),
  z.object({ kind: z.literal('list'), items: z.array(RawSummary) }).strict(),
  z.object({ kind: z.literal('failure'), code: ErrorCode }).strict(),
]);
export type Result = z.infer<typeof Result>;
export interface MaterialsBridge { ready(): Promise<Identity>; request(input: Request): Promise<Result>; reconnect(): Promise<Identity> }
declare global { interface Window { careerMaterials: MaterialsBridge } }

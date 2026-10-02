import { z } from 'zod';
export const MAX_TEXT_BYTES = 256 * 1024;
export const Identity = z.object({ protocolVersion: z.literal(1), workspaceInstance: z.uuid(), backendGeneration: z.uuid(), connectionGeneration: z.uuid() }).strict();
export type Identity = z.infer<typeof Identity>;
export const SourceRef = z.object({ owner: z.literal('materials'), objectId: z.uuid(), revision: z.literal(1), locator: z.literal('whole'), scope: z.literal('personal') }).strict();
export type SourceRef = z.infer<typeof SourceRef>;
export const Preview = z.object({ importId: z.uuid(), revision: z.literal(1), name: z.string().max(255), size: z.number().int().max(MAX_TEXT_BYTES), digest: z.string().regex(/^[a-f0-9]{64}$/), text: z.string().max(MAX_TEXT_BYTES), saved: z.literal(false) }).strict();
export type Preview = z.infer<typeof Preview>;
export const RawSummary = z.object({ id: z.uuid(), name: z.string().max(255), size: z.number().int(), scope: z.literal('personal'), lifecycle: z.literal('evidence-original'), revision: z.literal(1), source: SourceRef, recordedAt: z.string() }).strict();
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
  z.object({ operation: z.literal('select') }).strict(),
  z.object({ operation: z.literal('confirm'), input: Confirm }).strict(),
  z.object({ operation: z.literal('cancel'), importId: z.uuid() }).strict(),
  z.object({ operation: z.literal('list') }).strict(),
  z.object({ operation: z.literal('read'), materialId: z.uuid() }).strict(),
  z.object({ operation: z.literal('receipt'), commandId: z.uuid() }).strict(),
]);
export type Request = z.infer<typeof Request>;
export const Result = z.discriminatedUnion('kind', [
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

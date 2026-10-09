import {z} from 'zod';
import {MaterialsSourceRef} from '../common/source-ref.ts';
export const DOCUMENT_MAX_BYTES=180*1024;
export const DocumentDigest=z.string().regex(/^[a-f0-9]{64}$/);
export const FeishuDocumentSource=z.strictObject({documentIdentity:DocumentDigest,type:z.literal('docx'),accountIdentity:DocumentDigest.nullable(),sourceUrl:z.url().nullable(),displayTitle:z.string().min(1).max(1000)});
export const FeishuDocumentProvenance=z.strictObject({revision:z.number().int().positive(),retrievedAt:z.iso.datetime(),contentDigest:DocumentDigest,previewDigest:DocumentDigest,complete:z.literal(true)});
export const FeishuContentBlock=z.strictObject({kind:z.enum(['paragraph','heading','bullet','ordered','code','quote','todo','table','cell','container','divider','image','attachment','linked_content','unsupported']),text:z.string().max(DOCUMENT_MAX_BYTES),depth:z.number().int().min(0).max(32),done:z.boolean().nullable().optional()});
export const FeishuDocumentLimitations=z.array(z.enum(['images_not_downloaded','attachments_not_downloaded','linked_content_not_expanded','unsupported_blocks','connection_identity_unavailable'])).max(5);
export const FeishuDocumentReadBoundary=z.strictObject({maxPages:z.literal(5),pageSize:z.literal(100),maxBlocks:z.literal(500),maxTextBytes:z.literal(DOCUMENT_MAX_BYTES),metadataRequests:z.literal(2),requestsMade:z.number().int().min(3).max(9)});
export const FeishuDocumentPreview=z.strictObject({kind:z.literal('document_preview'),ref:z.uuid(),title:z.string().min(1).max(1000),text:z.string().max(DOCUMENT_MAX_BYTES),blocks:z.array(FeishuContentBlock).max(500),source:FeishuDocumentSource,provenance:FeishuDocumentProvenance,limitations:FeishuDocumentLimitations,readBoundary:FeishuDocumentReadBoundary});
export const FeishuDocumentFailure=z.strictObject({kind:z.literal('failure'),reason:z.enum(['invalid_request','reference_unavailable','not_connected','reauthorization_required','permission_required','connection_invalid','unsupported_type','read_failed','read_busy','cancelled','limit_exceeded','version_changed','account_changed','preview_unavailable'])});
export const FeishuDocumentRequest=z.strictObject({requestId:z.uuid(),selectedRef:z.uuid()});
export const FeishuDocumentCachedPreviewRequest=z.strictObject({selectedRef:z.uuid()});
export const FeishuDocumentResult=z.union([FeishuDocumentPreview,FeishuDocumentFailure]);
export const FeishuDocumentPreviewReadyRequest=z.strictObject({previewRef:z.uuid(),previewDigest:DocumentDigest});
export const FeishuDocumentCancelRequest=z.union([z.strictObject({requestId:z.uuid()}),z.strictObject({previewRef:z.uuid()})]);
export const FeishuDocumentCancelResult=z.union([z.strictObject({kind:z.literal('cancelled')}),FeishuDocumentFailure]);
export const FeishuDocumentImportRequest=FeishuDocumentPreviewReadyRequest.extend({commandId:z.uuid(),continueAfterNotFound:z.literal(true).optional()});
export const FeishuDocumentImportResult=z.union([z.strictObject({kind:z.literal('raw_saved'),materialId:z.uuid(),commandId:z.uuid(),source:MaterialsSourceRef,previewDigest:DocumentDigest,duplicate:z.boolean()}),z.strictObject({kind:z.literal('failure'),reason:z.enum(['invalid_request','preview_unavailable','source_version_conflict','save_failed','result_unknown'])})]);
export type FeishuDocumentPreview=z.infer<typeof FeishuDocumentPreview>;
export type FeishuDocumentResult=z.infer<typeof FeishuDocumentResult>;
export type FeishuContentBlock=z.infer<typeof FeishuContentBlock>;
export interface FeishuDocumentBridge {
 cachedPreview(input:z.infer<typeof FeishuDocumentCachedPreviewRequest>):Promise<FeishuDocumentResult>;
 preview(input:z.infer<typeof FeishuDocumentRequest>):Promise<FeishuDocumentResult>;
 cancel(input:z.infer<typeof FeishuDocumentCancelRequest>):Promise<z.infer<typeof FeishuDocumentCancelResult>>;
 importPreview(input:z.infer<typeof FeishuDocumentImportRequest>):Promise<z.infer<typeof FeishuDocumentImportResult>>;
}
declare global {interface Window{careerFeishuDocument?:FeishuDocumentBridge}}

import {z} from 'zod';
import {MaterialsSourceRef} from '../common/source-ref.ts';
export const BitableRecordSource=z.strictObject({bitableRef:z.uuid(),bitableTitle:z.string().min(1).max(1000),tableRef:z.uuid(),tableName:z.string().min(1).max(1000),viewRef:z.uuid(),viewName:z.string().min(1).max(1000)});
export const BitableRecordSelectionRequest=z.strictObject({recordRef:z.uuid()});
export const BitableRawPreviewFailure=z.strictObject({kind:z.literal('failure'),reason:z.enum(['invalid_request','selected_snapshot_unavailable','preview_unavailable'])});
export const SelectedBitableRecordMetadata=z.strictObject({kind:z.literal('selected_record'),recordRef:z.uuid(),source:BitableRecordSource,title:z.string().max(12000)});
export const SelectedBitableRecordResult=z.union([SelectedBitableRecordMetadata,BitableRawPreviewFailure]);
export const IncludedField=z.strictObject({name:z.string().max(1000),type:z.string().max(100),mode:z.enum(['value','count_placeholder'])});
export const ExcludedComplexField=z.strictObject({name:z.string().max(1000),type:z.string().max(100),reason:z.enum(['content_not_read','not_expanded','display_not_available','unsupported'])});
export const IgnoredField=z.strictObject({name:z.string().max(1000),reason:z.enum(['empty','technical_field','display_not_available','unsupported'])});
export const BitableRawProvenance=z.strictObject({source_type:z.literal('feishu_bitable_record'),bitable_ref:z.uuid(),table_ref:z.uuid(),view_ref:z.uuid(),record_ref:z.uuid(),selected_at:z.iso.datetime(),retrieved_at:z.iso.datetime().nullable(),upstream_updated_at:z.iso.datetime().nullable(),included_fields:z.array(IncludedField).max(64),excluded_complex_fields:z.array(ExcludedComplexField).max(64),preview_digest:z.string().regex(/^[a-f0-9]{64}$/)});
export const BitableRawPreview=z.strictObject({kind:z.literal('raw_preview'),ref:z.uuid(),source:BitableRecordSource,title:z.string().max(12000),text:z.string().max(1000000),includedFields:z.array(IncludedField).max(64),excludedComplexFields:z.array(ExcludedComplexField).max(64),ignoredFields:z.array(IgnoredField).max(64),provenance:BitableRawProvenance});
export const BitableRawPreviewResult=z.union([BitableRawPreview,BitableRawPreviewFailure]);
export const BitableRawPreviewRefRequest=z.strictObject({previewRef:z.uuid()});
export const BitableRawPreviewReadyRequest=BitableRawPreviewRefRequest.extend({previewDigest:z.string().regex(/^[a-f0-9]{64}$/)});
export const BitableRawPreviewCancelled=z.union([z.strictObject({kind:z.literal('cancelled')}),BitableRawPreviewFailure]);
export const BitableRawPreviewReady=z.union([z.strictObject({kind:z.literal('ready_for_import_confirmation'),previewRef:z.uuid(),previewDigest:z.string().regex(/^[a-f0-9]{64}$/)}),BitableRawPreviewFailure]);
export const BitableRawImportRequest=BitableRawPreviewReadyRequest.extend({commandId:z.uuid()});
export const BitableRawImportResult=z.union([z.strictObject({kind:z.literal('raw_saved'),materialId:z.uuid(),commandId:z.uuid(),source:MaterialsSourceRef,previewDigest:z.string().regex(/^[a-f0-9]{64}$/),duplicate:z.boolean()}),z.strictObject({kind:z.literal('failure'),reason:z.enum(['invalid_request','preview_unavailable','save_failed','result_unknown'])})]);
export type BitableRawPreview=z.infer<typeof BitableRawPreview>;
export type BitableRawPreviewResult=z.infer<typeof BitableRawPreviewResult>;
export type SelectedBitableRecordMetadata=z.infer<typeof SelectedBitableRecordMetadata>;
export interface FeishuBitableRawPreviewBridge{
 getSelectedRecord():Promise<z.infer<typeof SelectedBitableRecordResult>>;
 selectRecord(input:z.infer<typeof BitableRecordSelectionRequest>):Promise<z.infer<typeof SelectedBitableRecordResult>>;
 prepareRawPreview(input:z.infer<typeof BitableRecordSelectionRequest>):Promise<BitableRawPreviewResult>;
 cancelRawPreview(input:z.infer<typeof BitableRawPreviewRefRequest>):Promise<z.infer<typeof BitableRawPreviewCancelled>>;
 readyRawPreview(input:z.infer<typeof BitableRawPreviewReadyRequest>):Promise<z.infer<typeof BitableRawPreviewReady>>;
 importRawPreview?(input:z.infer<typeof BitableRawImportRequest>):Promise<z.infer<typeof BitableRawImportResult>>;
}
declare global{interface Window{careerFeishuBitableRawPreview?:FeishuBitableRawPreviewBridge}}

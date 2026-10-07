import {z} from 'zod';
export const BitablePreviewSelectionRequest=z.strictObject({tableRef:z.uuid(),viewRef:z.uuid()});
export const BitablePreviewRequest=BitablePreviewSelectionRequest.extend({limit:z.literal(5)});
export const PreviewCell=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('empty')}),
 z.strictObject({kind:z.literal('text'),value:z.string().max(12000)}),
 z.strictObject({kind:z.literal('number'),value:z.number().finite()}),
 z.strictObject({kind:z.literal('date'),value:z.union([z.string().max(100),z.number().finite()])}),
 z.strictObject({kind:z.literal('choice'),value:z.array(z.string().max(1000)).max(100)}),
 z.strictObject({kind:z.literal('boolean'),value:z.boolean()}),
 z.strictObject({kind:z.literal('summary'),category:z.enum(['attachment','linked_record','user','formula','lookup','rich_content','other']),count:z.number().int().nonnegative().max(100000).optional(),present:z.boolean()}),
]);
export const PreviewColumn=z.strictObject({name:z.string().min(1).max(1000),type:z.string().min(1).max(100)});
export const BitablePreviewFailure=z.strictObject({kind:z.literal('failure'),reason:z.enum(['invalid_request','reference_unavailable','selection_required','selection_locked','not_connected','connection_invalid','reauthorization_required','permission_required','preview_failed'])});
export const BitablePreviewSelection=z.strictObject({kind:z.literal('selection'),table:z.strictObject({ref:z.uuid(),name:z.string()}),view:z.strictObject({ref:z.uuid(),name:z.string()})});
export const BitablePreviewSelectionResult=z.union([BitablePreviewSelection,BitablePreviewFailure]);
export const BitablePreviewResult=z.union([z.strictObject({kind:z.literal('records'),columns:z.array(PreviewColumn).max(64),items:z.array(z.strictObject({ref:z.uuid(),cells:z.array(PreviewCell).max(64)})).max(5),hasMore:z.boolean()}),BitablePreviewFailure]);
export type PreviewCell=z.infer<typeof PreviewCell>;
export type PreviewColumn=z.infer<typeof PreviewColumn>;
export type BitablePreviewResult=z.infer<typeof BitablePreviewResult>;
export type BitablePreviewSelectionResult=z.infer<typeof BitablePreviewSelectionResult>;
export interface FeishuBitablePreviewBridge{
 selectBitablePreview(input:z.infer<typeof BitablePreviewSelectionRequest>):Promise<BitablePreviewSelectionResult>;
 previewBitableRecords(input:z.infer<typeof BitablePreviewRequest>):Promise<BitablePreviewResult>;
}
declare global{interface Window{careerFeishuBitablePreview?:FeishuBitablePreviewBridge}}

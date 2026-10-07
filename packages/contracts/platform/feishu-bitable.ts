import {z} from 'zod';
import type {FeishuDocumentMetadata} from './feishu-discovery';

export const BitableTablesRequest=z.strictObject({selectedRef:z.uuid()});
export const BitableTableRequest=z.strictObject({tableRef:z.uuid()});
export const BitableFailure=z.strictObject({kind:z.literal('failure'),reason:z.enum(['invalid_request','reference_unavailable','not_connected','connection_invalid','reauthorization_required','permission_required','structure_failed'])});
export const BitableTable=z.strictObject({ref:z.uuid(),name:z.string().min(1).max(1000)});
export const BitableView=z.strictObject({ref:z.uuid(),name:z.string().min(1).max(1000),type:z.string().min(1).max(100)});
export const BitableField=z.strictObject({name:z.string().min(1).max(1000),type:z.string().min(1).max(100)});
export const BitableTablesResult=z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('tables'),title:z.string().min(1).max(1000),items:z.array(BitableTable).max(300),hasMore:z.boolean()}),BitableFailure]);
export const BitableViewsResult=z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('views'),items:z.array(BitableView).max(300),hasMore:z.boolean()}),BitableFailure]);
export const BitableFieldsResult=z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('fields'),items:z.array(BitableField).max(300),hasMore:z.boolean()}),BitableFailure]);
export type BitableTablesResult=z.infer<typeof BitableTablesResult>;
export type BitableViewsResult=z.infer<typeof BitableViewsResult>;
export type BitableFieldsResult=z.infer<typeof BitableFieldsResult>;
export type BitableFailure=z.infer<typeof BitableFailure>;
export interface FeishuBitableBridge{
 getSelectedBitable():Promise<FeishuDocumentMetadata|null>;
 listBitableTables(input:z.infer<typeof BitableTablesRequest>):Promise<BitableTablesResult>;
 listBitableViews(input:z.infer<typeof BitableTableRequest>):Promise<BitableViewsResult>;
 listBitableFields(input:z.infer<typeof BitableTableRequest>):Promise<BitableFieldsResult>;
}
declare global{interface Window{careerFeishuBitable?:FeishuBitableBridge}}

import {z} from 'zod';

export const FeishuSearchQuery=z.string().refine(value=>value.trim().length>0&&Array.from(value).length<=30,'请输入1至30字的标题关键词');
export const FeishuSearchRequest=z.strictObject({searchId:z.uuid(),query:FeishuSearchQuery});
export const FeishuDocumentType=z.enum(['doc','docx','wiki','sheet','bitable','mindnote','file','folder','catalog','slides','shortcut','other']);
export const FeishuDocumentMetadata=z.strictObject({ref:z.uuid(),title:z.string().min(1).max(1000),type:FeishuDocumentType,updatedAt:z.string().datetime().nullable(),url:z.url().nullable()});
export const FeishuSearchResult=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('results'),items:z.array(FeishuDocumentMetadata).max(20),hasMore:z.boolean()}),
 z.strictObject({kind:z.literal('failure'),reason:z.enum(['not_connected','reauthorization_required','permission_required','connection_invalid','search_failed','search_busy','invalid_request'])}),
]);
export type FeishuDocumentMetadata=z.infer<typeof FeishuDocumentMetadata>;
export type FeishuSearchRequest=z.infer<typeof FeishuSearchRequest>;
export type FeishuSearchResult=z.infer<typeof FeishuSearchResult>;
export interface FeishuDiscoveryBridge{searchDocuments(input:FeishuSearchRequest):Promise<FeishuSearchResult>}
declare global{interface Window{careerFeishuDiscovery?:FeishuDiscoveryBridge}}

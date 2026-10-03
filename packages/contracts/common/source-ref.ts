import {z} from 'zod';
/** Source identity is resolved by its actual owner, never copied into Materials. */
export const MaterialsSourceRef=z.object({owner:z.literal('materials'),objectId:z.uuid(),revision:z.literal(1),locator:z.literal('whole'),scope:z.literal('personal')}).strict();
export const TranscriptSourceRef=z.object({owner:z.literal('interview'),objectId:z.uuid(),revision:z.number().int().positive(),locator:z.literal('transcript'),scope:z.literal('opportunity'),opportunityId:z.uuid()}).strict();
export const CommunicationSourceRef=z.object({owner:z.literal('communication'),objectId:z.uuid(),revision:z.number().int().positive(),locator:z.literal('text'),scope:z.literal('opportunity'),opportunityId:z.uuid()}).strict();
export const SourceRef=z.discriminatedUnion('owner',[MaterialsSourceRef,TranscriptSourceRef,CommunicationSourceRef]);
export type SourceRef=z.infer<typeof SourceRef>;
/** Read-only current owner metadata. An older ref is not silently upgraded. */
export interface SourceMetadata {id:string;revision:number;scope:string;source:SourceRef}

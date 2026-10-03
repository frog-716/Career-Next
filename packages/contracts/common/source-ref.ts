import {z} from 'zod';
/** Source identity is resolved by its actual owner, never copied into Materials. */
export const MaterialsSourceRef=z.object({owner:z.literal('materials'),objectId:z.uuid(),revision:z.literal(1),locator:z.literal('whole'),scope:z.enum(['personal','company','opportunity','project','employment','person']),scopeId:z.uuid().optional()}).strict().refine(ref=>ref.scope==='personal'?ref.scopeId===undefined:ref.scopeId!==undefined,'object source requires scopeId');
export const TranscriptSourceRef=z.object({owner:z.literal('interview'),objectId:z.uuid(),revision:z.number().int().positive(),locator:z.literal('transcript'),scope:z.literal('opportunity'),opportunityId:z.uuid()}).strict();
export const CommunicationSourceRef=z.object({owner:z.literal('communication'),objectId:z.uuid(),revision:z.number().int().positive(),locator:z.literal('text'),scope:z.literal('opportunity'),opportunityId:z.uuid()}).strict();
export const SearchSourceRef=z.strictObject({owner:z.literal('search'),objectId:z.uuid(),revision:z.literal(1),locator:z.uuid(),scope:z.enum(['company','opportunity']),scopeId:z.uuid()});
export const SourceRef=z.discriminatedUnion('owner',[MaterialsSourceRef,TranscriptSourceRef,CommunicationSourceRef,SearchSourceRef]);
export type SourceRef=z.infer<typeof SourceRef>;
/** Read-only current owner metadata. An older ref is not silently upgraded. */
export interface SourceMetadata {id:string;revision:number;scope:string;source:SourceRef}

export function sourceScope(ref:SourceRef):{kind:string;id?:string}{return ref.owner==='materials'||ref.owner==='search'?{kind:ref.scope,...ref.scopeId?{id:ref.scopeId}:{}}:{kind:ref.scope,id:ref.opportunityId};}

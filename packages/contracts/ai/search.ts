import {z} from 'zod';import {SearchSourceRef} from '../common/source-ref.ts';
export const SearchOwner=z.strictObject({kind:z.enum(['company','opportunity']),id:z.uuid()});
export const SearchRun=z.strictObject({id:z.uuid(),owner:SearchOwner,query:z.string().trim().min(1).max(2000),adapter:z.literal('controlled-fixture'),network:z.literal('none'),recordedAt:z.iso.datetime(),results:z.array(z.strictObject({id:z.uuid(),title:z.string().max(200),url:z.url().max(2000),body:z.string().max(64000),source:SearchSourceRef})).max(20)});export type SearchRun=z.infer<typeof SearchRun>;
export const SearchRequest=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('search.preview'),owner:SearchOwner,query:SearchRun.shape.query}),
 z.strictObject({operation:z.literal('search.run'),commandId:z.uuid(),owner:SearchOwner,query:SearchRun.shape.query,confirmed:z.literal(true)}),
 z.strictObject({operation:z.literal('search.read'),id:z.uuid()}),z.strictObject({operation:z.literal('search.list')}),z.strictObject({operation:z.literal('search.receipt'),commandId:z.uuid()})
]);export type SearchRequest=z.infer<typeof SearchRequest>;
export const SearchResult=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('search_preview'),owner:SearchOwner,query:SearchRun.shape.query,adapter:z.literal('controlled-fixture'),network:z.literal('none'),recipient:z.literal('local controlled Search fixture; no public network')}),
 z.strictObject({kind:z.literal('search_run'),run:SearchRun}),z.strictObject({kind:z.literal('search_runs'),runs:z.array(SearchRun).max(100)}),
]);export type SearchResult=z.infer<typeof SearchResult>;

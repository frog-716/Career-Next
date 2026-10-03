import { z } from 'zod';

export const LocalSearchOwner = z.enum(['wiki', 'opportunity', 'project']);
export const LocalSearchRequest = z.strictObject({
  operation: z.literal('local-search.query'),
  owner: LocalSearchOwner,
  query: z.string().trim().min(1).max(64),
  scope: z.enum(['personal', 'cognition', 'project', 'employment', 'person', 'opportunity']).optional(),
  scopeId: z.uuid().optional(),
  includeInactive: z.boolean().default(false),
  cursor: z.strictObject({ objectId: z.uuid(), ordinal: z.number().int().nonnegative() }).optional(),
});
export const LocalSearchResult = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('local-search.results'),
    items: z.array(z.strictObject({ owner: LocalSearchOwner, id: z.uuid(), revision: z.number().int().positive(), title: z.string(), snippet: z.string() })).max(50),
    partial: z.boolean(),
    notice: z.enum(['检索完成', '结果未完整检索']),
    cursor: LocalSearchRequest.shape.cursor,
    observed: z.strictObject({ rows: z.number().int().nonnegative(), bytes: z.number().int().nonnegative(), comparisons: z.number().int().nonnegative(), elapsedMs: z.number().nonnegative() }),
  }),
  z.strictObject({ kind: z.literal('local-search.failure'), code: z.enum(['invalid_request', 'index_unavailable', 'cancelled', 'disconnected']), partial: z.literal(true), notice: z.literal('结果未完整检索') }),
]);
export type LocalSearchRequest = z.infer<typeof LocalSearchRequest>;
export type LocalSearchResult = z.infer<typeof LocalSearchResult>;
export type LocalSearchBridge={request(input:LocalSearchRequest):Promise<LocalSearchResult>};
declare global{interface Window{careerSearch:LocalSearchBridge}}

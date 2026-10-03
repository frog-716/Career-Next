import {z} from 'zod';
export const Provenance=z.object({owner:z.string().min(1).max(80),objectId:z.string().min(1).max(160),revision:z.number().int().positive(),scope:z.string().min(1).max(160),scopeId:z.uuid().optional(),kind:z.string().min(1).max(80),restrictions:z.object({read:z.boolean(),egress:z.boolean()}).strict(),generation:z.number().int().nonnegative().optional()}).strict();
export type Provenance=z.infer<typeof Provenance>;

import {z} from 'zod';
/** Content-free notification; only the trusted host decides which cached bodies are invalid. */
export const FeishuCacheEviction=z.strictObject({kind:z.literal('feishu_cache_evicted'),materialIds:z.array(z.uuid()).max(10000),previewRefs:z.array(z.uuid()).max(10000),recordRefs:z.array(z.uuid()).max(10000),all:z.boolean()});
export type FeishuCacheEviction=z.infer<typeof FeishuCacheEviction>;

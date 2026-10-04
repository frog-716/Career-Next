import {z} from 'zod';
/** Credential-free wire body. Included in the immutable egress preview. */
export const DeepSeekRequest=z.strictObject({model:z.literal('deepseek-flash'),thinking:z.strictObject({type:z.literal('disabled')}),response_format:z.strictObject({type:z.literal('json_object')}),stream:z.literal(false),max_tokens:z.number().int().min(1).max(2048),messages:z.tuple([z.strictObject({role:z.literal('system'),content:z.string().max(4000)}),z.strictObject({role:z.literal('user'),content:z.string().max(1048576)})])});
export const ProviderUsage=z.strictObject({model:z.string().min(1).max(100),inputTokens:z.number().int().nonnegative(),outputTokens:z.number().int().nonnegative(),totalTokens:z.number().int().nonnegative(),cost:z.literal('not_reported')});

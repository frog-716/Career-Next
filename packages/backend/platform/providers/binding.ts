import {z}from'zod';
/** Host-to-writer metadata only: no credential bytes or renderer operation. */
export const ProviderBinding=z.strictObject({provider:z.literal('deepseek-v4.1-flash').optional(),enabled:z.boolean(),generation:z.string().min(1).max(100)});
export type ProviderBinding=z.infer<typeof ProviderBinding>;

import {deepSeekRecipient} from './deepseek';
import {createDeterministicFakeProvider} from './deterministic-fake';
export function providerRecipient(binding:ProviderBinding){return binding.provider==='deepseek-v4.1-flash'?deepSeekRecipient(binding.generation):createDeterministicFakeProvider(binding.generation).recipient;}

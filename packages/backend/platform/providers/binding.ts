import {z}from'zod';
/** Main-to-utility metadata only: no credential bytes or renderer operation. */
export const ProviderBinding=z.strictObject({enabled:z.boolean(),generation:z.string().min(1).max(100)});
export type ProviderBinding=z.infer<typeof ProviderBinding>;

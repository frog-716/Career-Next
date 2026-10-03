import {z} from 'zod';
export const Preferences=z.strictObject({revision:z.number().int().nonnegative(),pinned:z.enum(['wiki','opportunity','project','employment']).nullable()});
export const PreferencesRequest=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('preferences.read')}),
 z.strictObject({operation:z.literal('preferences.pin'),commandId:z.uuid(),expectedRevision:z.number().int().nonnegative(),pinned:Preferences.shape.pinned}),
 z.strictObject({operation:z.literal('preferences.receipt'),commandId:z.uuid()})
]);
export const PreferencesResult=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('preferences'),preferences:Preferences}),
 z.strictObject({kind:z.literal('preferences_conflict'),preferences:Preferences}),
 z.strictObject({kind:z.literal('receipt_missing')})
]);
export type Preferences=z.infer<typeof Preferences>;

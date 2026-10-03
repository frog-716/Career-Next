import {z} from 'zod';
export const ModuleId=z.enum(['wiki','opportunity','project','employment']);
export const ModuleOrder=z.array(ModuleId).length(4).refine(order=>new Set(order).size===4,'all four modules exactly once');
export const Preferences=z.strictObject({revision:z.number().int().nonnegative(),pinned:ModuleId.nullable(),order:ModuleOrder.default(['wiki','opportunity','project','employment'])});
export const PreferencesRequest=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('preferences.reorder'),commandId:z.uuid(),expectedRevision:z.number().int().nonnegative(),order:ModuleOrder}),
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

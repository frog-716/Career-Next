import {z} from 'zod';
export const SafeLink=z.string().max(2048).refine(value=>{try{return ['https:','http:','mailto:'].includes(new URL(value).protocol);}catch{return false;}},'只支持 http、https 和 mailto 链接');
export const Profile=z.strictObject({revision:z.number().int().nonnegative(),name:z.string().max(120),contact:z.string().max(500),links:z.array(z.strictObject({label:z.string().max(120),href:SafeLink})).max(20)});
export type Profile=z.infer<typeof Profile>;
export const Request=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('profile.read')}),
 z.strictObject({operation:z.literal('profile.save'),commandId:z.uuid(),expectedRevision:z.number().int().nonnegative(),name:z.string().max(120),contact:z.string().max(500),links:Profile.shape.links}),
 z.strictObject({operation:z.literal('profile.receipt'),commandId:z.uuid()})
]);
export const Result=z.discriminatedUnion('status',[
 z.strictObject({status:z.literal('profile'),profile:Profile}),
 z.strictObject({status:z.literal('conflict'),profile:Profile}),
 z.strictObject({status:z.literal('not-found')}),
 z.strictObject({status:z.literal('failure'),code:z.enum(['invalid-request','storage-failed'])})
]);
export type Request=z.infer<typeof Request>;
export type Result=z.infer<typeof Result>;
export interface ProfileReader {read():Profile}

import {FeedbackRequest,FeedbackResult} from './feedback.ts';
import {PreferencesRequest,PreferencesResult} from './preferences.ts';
import {z} from 'zod';
const Ref=z.strictObject({owner:z.string().min(1).max(80),objectId:z.string().min(1).max(160)});
export const BackupSettings=z.strictObject({enabled:z.boolean(),periodHours:z.number().int().min(1).max(8760),retainCount:z.number().int().min(1).max(1000)});
export const DataRequestSchema=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('data.status')}),
 z.strictObject({operation:z.literal('data.targets')}),
 z.strictObject({operation:z.literal('data.settings'),settings:BackupSettings}),
 z.strictObject({operation:z.literal('data.backup')}),
 z.strictObject({operation:z.literal('data.restore.prepare'),backupId:z.uuid()}),
 z.strictObject({operation:z.literal('data.restore.activate'),candidateId:z.uuid(),confirmed:z.literal(true)}),
 z.strictObject({operation:z.literal('data.purge.plan'),references:z.array(Ref).min(1).max(1000)}),
 z.strictObject({operation:z.literal('data.purge.confirm'),planId:z.uuid(),selectedCopyIds:z.array(z.uuid()).max(10000),confirmed:z.literal(true)})
]);
export const Request=z.discriminatedUnion('operation',[...DataRequestSchema.options,...PreferencesRequest.options,...FeedbackRequest.options]);
export const Copy=z.strictObject({id:z.uuid(),relativePath:z.string(),kind:z.string(),state:z.string(),createdAt:z.string(),sourceCopyId:z.uuid().optional(),reason:z.string().optional()});
export const Impact=z.strictObject({references:z.array(Ref),description:z.string().max(300),independentReferences:z.array(z.string().max(200)).max(1000),files:z.array(z.string().max(500).regex(/^(blobs|staging|cache|quarantine|proposals|summaries)\/[^/].*$/)).max(10000),dependencies:z.string().max(256)});
export const Plan=z.strictObject({id:z.uuid(),createdAt:z.string(),impact:Impact,copies:z.array(Copy),externalLimit:z.string()});
export const Result=z.discriminatedUnion('kind',[
 ...PreferencesResult.options,...FeedbackResult.options,
 z.strictObject({kind:z.literal('data_targets'),targets:z.array(z.strictObject({owner:z.string().max(80),objectId:z.string().max(160),label:z.string().max(255)})).max(10000)}),
 z.strictObject({kind:z.literal('data_status'),settings:BackupSettings,copies:z.array(Copy),activeWorkspace:z.string(),dataLocation:z.string().optional(),lastCompleteAt:z.string().optional(),automaticDue:z.boolean(),pendingPurgeCount:z.number().int().nonnegative(),provider:z.literal('deterministic fake only; real provider not configured')}),
 z.strictObject({kind:z.literal('backup'),copy:Copy}),z.strictObject({kind:z.literal('restore_candidate'),copy:Copy,purgeWarnings:z.array(Ref).max(1000)}),
 z.strictObject({kind:z.literal('restored'),workspaceInstance:z.uuid(),copy:Copy}),z.strictObject({kind:z.literal('purge_plan'),plan:Plan}),
 z.strictObject({kind:z.literal('purged'),references:z.array(Ref).optional(),planId:z.uuid(),scope:z.enum(['all_managed_copies','selected_scope']),remainingCopyIds:z.array(z.uuid()),externalLimit:z.string()}),
 z.strictObject({kind:z.literal('failure'),code:z.string().max(100),purgeReferences:z.array(Ref).optional()})
]);
export type DataRequest=z.infer<typeof Request>;export type DataResult=z.infer<typeof Result>;export type PurgeImpact=z.infer<typeof Impact>;export type PurgePlan=z.infer<typeof Plan>;

export const PurgeNotification=z.strictObject({workspaceInstance:z.uuid(),references:z.array(Ref).max(10000)});
export type PurgeNotification=z.infer<typeof PurgeNotification>;

import {z} from 'zod';
const Identity=z.string().min(1).max(160);
export const HistoryReference=z.strictObject({owner:z.enum(['company','opportunity','research','resume','profile','materials','wiki','project','employment','person','submission','communication','interview','offer']),objectId:Identity});
export type HistoryReference=z.infer<typeof HistoryReference>;
export const LegacyStatus=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('known'),value:z.enum(['pending','accepted','rejected','resolved','superseded'])}),
 z.strictObject({kind:z.literal('unrecognized'),original:z.string().min(1).max(160)}),
]);
const Target=z.strictObject({legacyType:z.enum(['company','opportunity','research','resume']),legacyIdentity:Identity,resolution:z.enum(['resolved','unresolved']),ownerReference:HistoryReference.optional()}).refine(t=>t.resolution!=='resolved'||!!t.ownerReference,'resolved_target_reference_required').refine(t=>!t.ownerReference||t.ownerReference.owner===t.legacyType,'target_owner_type_mismatch');
const Basis=z.strictObject({reason:z.string().max(10000),evidence:z.string().max(20000),sources:z.array(z.strictObject({sourceSystem:z.literal('career-legacy'),sourceType:z.enum(['material','wiki','research','resume','opportunity','other']),legacyIdentity:Identity,ownerReference:HistoryReference.optional()})).max(100)});
const Purged=z.strictObject({availability:z.literal('purged')});
const ResearchContent=z.discriminatedUnion('availability',[
 z.strictObject({availability:z.literal('available'),proposal:z.strictObject({title:z.string().min(1).max(300),body:z.string().max(50000),nature:z.enum(['fact_statement','observation','hypothesis','inference','unknown'])}),basis:Basis}),Purged,
]);
const ResumeContent=z.discriminatedUnion('availability',[
 z.strictObject({availability:z.literal('available'),proposal:z.strictObject({title:z.string().min(1).max(300),changeKind:z.enum(['add','rewrite','remove']),sectionIdentity:Identity.nullable(),blockIdentity:Identity.nullable(),text:z.string().max(50000)}),basis:Basis}),Purged,
]);
const Common={id:z.uuid(),sourceSystem:z.literal('career-legacy'),snapshotDigest:z.string().regex(/^[a-f0-9]{64}$/),sourceRecordIdentity:Identity,legacyStatus:LegacyStatus,target:Target,recordedAt:z.iso.datetime({offset:true}).nullable(),archivedAt:z.iso.datetime({offset:true}),readOnly:z.literal(true),independentlyVerified:z.literal(false)};
export const LegacyProposalHistory=z.discriminatedUnion('kind',[
 z.strictObject({...Common,kind:z.literal('research'),content:ResearchContent}),
 z.strictObject({...Common,kind:z.literal('resume'),content:ResumeContent}),
]);
export type LegacyProposalHistory=z.infer<typeof LegacyProposalHistory>;
export const LegacyHistoryImport=z.discriminatedUnion('kind',[LegacyProposalHistory.options[0].omit({id:true,archivedAt:true}),LegacyProposalHistory.options[1].omit({id:true,archivedAt:true})]);
export type LegacyHistoryImport=z.infer<typeof LegacyHistoryImport>;
export const LegacyHistoryRequest=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('legacy-history.list'),afterId:z.uuid().optional()}),
 z.strictObject({operation:z.literal('legacy-history.read'),id:z.uuid()}),
]);
export type LegacyHistoryRequest=z.infer<typeof LegacyHistoryRequest>;
export const LegacyHistoryResult=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('legacy_history_list'),items:z.array(LegacyProposalHistory).max(100),nextAfterId:z.uuid().optional()}),
 z.strictObject({kind:z.literal('legacy_history'),item:LegacyProposalHistory}),
]);
export type LegacyHistoryResult=z.infer<typeof LegacyHistoryResult>;

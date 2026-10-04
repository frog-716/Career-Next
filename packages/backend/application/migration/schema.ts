import {z} from 'zod';
import {Profile} from '../../../contracts/profile/schema';
import {Alignment,Span} from '../../../contracts/resume/schema';
import {LegacyStatus,LegacyProposalHistory} from '../../../contracts/ai/legacy-history/schema';
const ResearchContent=LegacyProposalHistory.options[0].shape.content;
const ResumeContent=LegacyProposalHistory.options[1].shape.content;
const Identity=z.string().min(1).max(200),Digest=z.string().regex(/^[a-f0-9]{64}$/);
const Common={identity:Identity,revision:z.number().int().nonnegative(),recordedAt:z.iso.datetime().nullable()};
const LegacyParagraph=z.strictObject({id:Identity,alignment:Alignment.optional(),spans:z.array(Span).max(1000)});
const LegacyBlock=z.discriminatedUnion('type',[
 z.strictObject({type:z.literal('paragraph'),...LegacyParagraph.shape}),
 z.strictObject({type:z.literal('bullet-list'),id:Identity,items:z.array(LegacyParagraph).max(200)}),
]);
export const LegacyRecord=z.discriminatedUnion('kind',[
 z.strictObject({...Common,kind:z.literal('profile'),origin:z.enum(['primary','secondary']),basics:z.strictObject({name:Profile.shape.name,phone:z.string().max(150),email:z.string().max(150),wechat:z.string().max(150),links:z.array(z.strictObject({label:z.string().max(120),url:z.string().max(2048)})).max(20)})}),
 z.strictObject({...Common,kind:z.literal('company'),name:z.string().trim().min(1).max(200)}),
 z.strictObject({...Common,kind:z.literal('opportunity'),companyIdentity:Identity,title:z.string().trim().min(1).max(200),jd:z.string().max(100000).optional(),phase:z.literal('resume'),result:z.literal('active'),url:z.literal('').optional()}),
 z.strictObject({...Common,kind:z.literal('resume'),opportunityIdentity:Identity,document:z.strictObject({schemaVersion:z.literal(1),identityNameAlignment:Alignment.optional(),sections:z.array(z.strictObject({id:Identity,type:z.enum(['summary','skills','experience','projects','education']),title:z.string().max(120),blocks:z.array(LegacyBlock).min(1).max(200)})).min(1).max(30)})}),
 z.strictObject({...Common,kind:z.literal('research-proposal'),legacyStatus:LegacyStatus,target:z.strictObject({type:z.enum(['company','opportunity','research']),identity:Identity}),content:ResearchContent}),
 z.strictObject({...Common,kind:z.literal('resume-proposal'),legacyStatus:LegacyStatus,target:z.strictObject({type:z.literal('resume'),identity:Identity}),content:ResumeContent}),
]);
export type LegacyRecord=z.infer<typeof LegacyRecord>;
export const Classification=z.strictObject({version:z.literal(1),records:z.array(z.strictObject({identity:Identity,classification:z.enum(['REAL','TEST','UNKNOWN'])})).min(1).max(1000)});
/** Only M1-A's approved preparation/active subset; unsupported semantics fail closed. */
export const Mapping=z.strictObject({version:z.literal('M1-A-fixture-v1'),profileAuthority:z.literal('primary'),opportunityPhase:z.literal('resume-to-preparation'),opportunityResult:z.literal('active'),unknownDates:z.literal('preserve'),alignment:z.literal('preserve'),proposals:z.literal('archive-only')});
export const AdapterVersion='m1b-synthetic-v1' as const;
export const Manifest=z.strictObject({sourceDigest:Digest,sourceSchemaDigest:Digest,sourceVersion:z.literal(1),classificationDigest:Digest,mappingDigest:Digest,adapterVersion:z.literal(AdapterVersion),recordIdentities:z.array(Identity).min(1).max(1000),workspaceInstance:z.uuid()});
export type Manifest=z.infer<typeof Manifest>;
export const IdentityMapping=z.strictObject({sourceIdentity:Identity,kind:z.enum(['profile','company','opportunity','resume','research-proposal','resume-proposal']),targetOwner:z.enum(['profile','company','opportunity','resume','ai-legacy-history']),targetIdentity:z.string().min(1).max(200),legacyRevision:z.number().int().nonnegative(),legacyRecordedAt:z.iso.datetime().nullable()});
export const Receipt=z.strictObject({planDigest:Digest,manifest:Manifest,status:z.literal('complete'),mappings:z.array(IdentityMapping).max(1000)}).superRefine((receipt,context)=>{
 const identities=receipt.mappings.map(m=>m.sourceIdentity);
 if(new Set(identities).size!==identities.length||JSON.stringify([...identities].sort())!==JSON.stringify([...receipt.manifest.recordIdentities].sort()))context.addIssue({code:'custom',message:'migration_identity_set_mismatch'});
 for(const mapping of receipt.mappings){const owner=mapping.kind.endsWith('-proposal')?'ai-legacy-history':mapping.kind;if(mapping.targetOwner!==owner||mapping.kind==='profile'&&mapping.targetIdentity!=='current'||mapping.kind!=='profile'&&!z.uuid().safeParse(mapping.targetIdentity).success)context.addIssue({code:'custom',message:'migration_mapping_invalid'});}
});
export type Receipt=z.infer<typeof Receipt>;

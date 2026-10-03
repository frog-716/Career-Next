import {ResumeBlock} from '../resume/schema.ts';
import {z} from 'zod';
import {Target} from './protocol.ts';
export const ProductTarget=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('resume-optimize'),resumeId:z.uuid(),blockIds:z.array(z.uuid()).min(1).max(20),changeKinds:z.array(z.enum(['rewrite','add','delete'])).min(1).max(3).default(['rewrite','add','delete'])}),
 z.strictObject({kind:z.literal('research-organize'),owner:z.strictObject({kind:z.enum(['company','opportunity']),id:z.uuid()}),reviewId:z.uuid().optional(),searchRunId:z.uuid().optional()}),
 z.strictObject({kind:z.literal('research-promotion'),itemId:z.uuid(),opportunityId:z.uuid(),companyId:z.uuid()}),
 z.strictObject({kind:z.literal('greeting'),opportunityId:z.uuid(),includeName:z.boolean().default(false)}),
 z.strictObject({kind:z.literal('interview-preparation'),interviewId:z.uuid()}),
 z.strictObject({kind:z.literal('interview-review'),interviewId:z.uuid()}),
 z.strictObject({kind:z.literal('offer-assist'),opportunityId:z.uuid()}),
 z.strictObject({kind:z.literal('simulation-return'),simulationId:z.uuid(),transcriptVersion:z.number().int().positive(),wikiTarget:Target.refine(target=>['personal','cognition','project'].includes(target.scope),'Only personal/cognition/project Wiki'),selectionStart:z.number().int().nonnegative(),selectionEnd:z.number().int().positive().max(100000),confirmedRealMeaning:z.literal(true),meaning:z.string().trim().min(1).max(1000)})
]);
export type ProductTarget=z.infer<typeof ProductTarget>;
export const Dependency=z.strictObject({owner:z.string().min(1).max(80),objectId:z.string().min(1).max(160),revision:z.number().int().nonnegative(),role:z.enum(['target','evidence']),scope:z.string().max(160).optional(),scopeId:z.uuid().optional(),locator:z.string().max(100).optional(),digest:z.string().regex(/^[a-f0-9]{64}$/).optional()});
export type Dependency=z.infer<typeof Dependency>;
export const ProductContext=z.strictObject({target:ProductTarget,body:z.string().max(262144),missing:z.array(z.string().max(1000)).max(30),dependencies:z.array(Dependency).max(1000),sentFiles:z.array(z.strictObject({owner:z.literal('submission'),objectId:z.uuid(),name:z.string().max(255),digest:z.string().regex(/^[a-f0-9]{64}$/),size:z.number().int().positive().max(262144),encoding:z.literal('base64'),data:z.string().max(349528)})).max(1).optional(),promotion:z.strictObject({id:z.uuid(),revision:z.number().int().positive(),title:z.string().max(200),body:z.string().max(64000)}).optional(),resumeBlocks:z.array(z.strictObject({sectionId:z.uuid(),blockId:z.uuid(),block:ResumeBlock,canDelete:z.boolean(),title:z.string().max(200),text:z.string().max(64000),digest:z.string().regex(/^[a-f0-9]{64}$/),anchorDigest:z.string().regex(/^[a-f0-9]{64}$/)})).max(20).optional(),identityFields:z.array(z.strictObject({field:z.literal('name'),value:z.string().max(120)})).max(1)});
export type ProductContext=z.infer<typeof ProductContext>;

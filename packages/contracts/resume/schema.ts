import { z } from 'zod';
const Id=z.uuid();
const Revision=z.number().int().nonnegative();
import {Profile,SafeLink,type ProfileReader} from '../profile/schema.ts';
export {Profile,SafeLink} from '../profile/schema.ts';
export const Mark=z.discriminatedUnion('type',[
 z.strictObject({type:z.literal('bold')}),z.strictObject({type:z.literal('italic')}),z.strictObject({type:z.literal('strike')}),z.strictObject({type:z.literal('link'),href:SafeLink})
]);
export const Span=z.strictObject({text:z.string().max(10000),marks:z.array(Mark).max(4)});
export type Span=z.infer<typeof Span>;
const Paragraph=z.strictObject({id:Id,type:z.literal('paragraph'),spans:z.array(Span).max(1000)});
const BulletList=z.strictObject({id:Id,type:z.literal('bullet-list'),items:z.array(z.strictObject({id:Id,paragraphId:Id,spans:z.array(Span).max(1000)})).max(200)});
export const Section=z.strictObject({id:Id,kind:z.enum(['summary','skills','experience','project','education']),title:z.string().max(120),blocks:z.array(z.discriminatedUnion('type',[Paragraph,BulletList])).max(200)});
export const CareerDocument=z.strictObject({schemaVersion:z.literal(1),sections:z.array(Section).min(1).max(30),layout:z.strictObject({template:z.literal('a4-basic'),fontSize:z.number().int().min(10).max(14),identityPosition:z.literal('top')})}).superRefine((document,context)=>{
 const ids:string[]=[];
 for(const section of document.sections){ids.push(section.id);for(const block of section.blocks){ids.push(block.id);if(block.type==='bullet-list')for(const item of block.items)ids.push(item.id,item.paragraphId);}}
 if(new Set(ids).size!==ids.length)context.addIssue({code:'custom',message:'文档区块 ID 必须唯一'});
 if(JSON.stringify(document).length>500000)context.addIssue({code:'custom',message:'文档超过本轮有界编辑范围'});
});
export type CareerDocument=z.infer<typeof CareerDocument>;

export const Document=z.strictObject({id:Id,opportunityId:Id,revision:Revision,content:CareerDocument,recordedAt:z.string().datetime()});
export const Snapshot=z.strictObject({id:Id,resumeId:Id,opportunityId:Id,resumeRevision:Revision,profileRevision:Revision,content:CareerDocument,profile:Profile,contentHash:z.string().regex(/^[a-f0-9]{64}$/),templateVersion:z.literal('a4-basic-1'),fontVersion:z.string().min(1).max(120),engineVersion:z.string().min(1).max(120),rendererVersion:z.literal('career-print-1'),recordedAt:z.string().datetime()});
export const PdfArtifact=z.strictObject({blobId:Id,digest:z.string().regex(/^[a-f0-9]{64}$/),size:z.number().int().positive().max(16*1024*1024)});
export const Version=z.strictObject({id:Id,resumeId:Id,name:z.string().trim().min(1).max(120),snapshot:Snapshot,pdf:PdfArtifact,recordedAt:z.string().datetime()});
export const NameVersion=z.strictObject({operation:z.literal('resume.name-version'),commandId:Id,resumeId:Id,expectedRevision:Revision,expectedProfileRevision:Revision,name:z.string().trim().min(1).max(120)});
export const Request=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('resume.open'),commandId:Id,opportunityId:Id}),
 z.strictObject({operation:z.literal('resume.read'),resumeId:Id}),
 z.strictObject({operation:z.literal('resume.save'),commandId:Id,resumeId:Id,expectedRevision:Revision,expectedProfileRevision:Revision,content:CareerDocument}),
 NameVersion,
 z.strictObject({operation:z.literal('resume.versions'),resumeId:Id}),
 z.strictObject({operation:z.literal('resume.version'),resumeId:Id,versionId:Id}),
 z.strictObject({operation:z.literal('resume.restore'),commandId:Id,resumeId:Id,versionId:Id,expectedRevision:Revision,expectedProfileRevision:Revision}),
 z.strictObject({operation:z.literal('resume.receipt'),commandId:Id})
]);
export const Result=z.discriminatedUnion('status',[
 z.strictObject({status:z.literal('document'),document:Document,profile:Profile,opportunity:z.strictObject({id:Id,companyName:z.string(),role:z.string()})}),
 z.strictObject({status:z.literal('pending-job'),job:Snapshot,name:z.string()}),
 z.strictObject({status:z.literal('version'),version:Version}),
 z.strictObject({status:z.literal('versions'),versions:z.array(Version)}),
 z.strictObject({status:z.literal('conflict'),profile:Profile,document:Document.optional()}),
 z.strictObject({status:z.literal('not-found')}),
 z.strictObject({status:z.literal('failure'),code:z.enum(['invalid-request','storage-failed','opportunity-unavailable','pdf-failed'])})
]);
export type Request=z.infer<typeof Request>;
export type Result=z.infer<typeof Result>;
export type Snapshot=z.infer<typeof Snapshot>;
export type PdfArtifact=z.infer<typeof PdfArtifact>;
export type Version=z.infer<typeof Version>;
export interface OpportunityResolver {resolveOpportunity(id:string):{id:string;companyName:string;role:string}|undefined;profile:ProfileReader}

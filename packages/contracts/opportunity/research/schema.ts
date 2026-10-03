import {z} from 'zod';
import {SourceRef} from '../../common/source-ref.ts';
import {BusinessTime} from '../../common/business-time.ts';
export const Owner=z.object({kind:z.enum(['company','opportunity']),id:z.uuid()}).strict();export type Owner=z.infer<typeof Owner>;
export const Source=z.object({ref:SourceRef,purpose:z.string().trim().min(1).max(500),excerpt:z.string().max(8000),assessment:z.enum(['supports','lead_only','needs_review'])}).strict().refine(source=>source.assessment!=='supports'||source.excerpt.trim().length>0,{message:'Supporting evidence requires an excerpt',path:['excerpt']});export type Source=z.infer<typeof Source>;
export const Lead=z.object({title:z.string().trim().min(1).max(200),url:z.url().max(2000).regex(/^https?:\/\//i)}).strict();
export const Nature=z.enum(['fact_statement','inference','unknown']);
const Content={title:z.string().trim().min(1).max(200),body:z.string().trim().min(1).max(64000),nature:Nature,sources:z.array(Source).max(20),leads:z.array(Lead).max(20)};
export const Item=z.object({id:z.uuid(),owner:Owner,revision:z.number().int().positive(),...Content,userConfirmed:z.boolean(),independentlyVerified:z.boolean(),active:z.boolean(),recordedAt:z.string()}).strict();export type Item=z.infer<typeof Item>;
export const SourceStatus=z.object({source:Source,status:z.enum(['readable','unavailable','stale'])}).strict();
export const Resolution=z.object({item:Item,sources:z.array(SourceStatus),reviewRequired:z.boolean(),editable:z.boolean()}).strict();export type Resolution=z.infer<typeof Resolution>;
export const Reference=z.object({itemId:z.uuid(),originRevision:z.number().int().positive(),owner:Owner,originOwner:Owner}).strict();
export const History=z.object({item:Item,action:z.enum(['created','corrected','supplemented','withdrawn','restored','promoted']),reason:z.string(),businessTime:BusinessTime,recordedAt:z.string()}).strict();
export type History=z.infer<typeof History>;
const Existing={commandId:z.uuid(),id:z.uuid(),owner:Owner,expectedRevision:z.number().int().positive(),reason:z.string().trim().min(1).max(1000),businessTime:BusinessTime};
export const Request=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('create'),commandId:z.uuid(),owner:Owner,...Content,userConfirmed:z.boolean(),independentlyVerified:z.boolean()}).strict(),
 z.object({operation:z.literal('correct'),...Existing,...Content,reevaluatedSources:z.literal(true)}).strict(),
 z.object({operation:z.literal('supplement'),...Existing,sources:z.array(Source).max(20),leads:z.array(Lead).max(20),userConfirmed:z.boolean(),independentlyVerified:z.boolean()}).strict(),
 z.object({operation:z.literal('lifecycle'),...Existing,action:z.enum(['withdraw','restore'])}).strict(),
 z.object({operation:z.literal('promote'),...Existing,companyId:z.uuid(),expectedCompanyDocumentRevision:z.number().int().nonnegative(),sharingConfirmed:z.literal(true)}).strict(),
 z.object({operation:z.literal('read'),owner:Owner}).strict(),
 z.object({operation:z.literal('resolve'),id:z.uuid(),viewer:Owner,revision:z.number().int().positive().optional()}).strict(),
 z.object({operation:z.literal('history'),id:z.uuid(),owner:Owner}).strict(),
 z.object({operation:z.literal('receipt'),commandId:z.uuid()}).strict(),
]);export type Request=z.infer<typeof Request>;
export const ErrorCode=z.enum(['invalid_request','content_purged','not_found','conflict','source_unavailable','scope_mismatch','invalid_transition','storage_failed']);
export const Result=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('item'),item:Item}).strict(),
 z.object({kind:z.literal('document'),owner:Owner,revision:z.number().int().nonnegative(),items:z.array(Resolution),references:z.array(Reference)}).strict(),
 z.object({kind:z.literal('resolution'),resolution:Resolution}).strict(),
 z.object({kind:z.literal('history'),items:z.array(History)}).strict(),
 z.object({kind:z.literal('receipt_missing')}).strict(),
 z.object({kind:z.literal('failure'),code:ErrorCode}).strict(),
]);export type Result=z.infer<typeof Result>;

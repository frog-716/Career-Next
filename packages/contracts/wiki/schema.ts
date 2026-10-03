import { z } from 'zod';
import { SourceRef } from '../common/source-ref.ts';
import { BusinessTime } from '../common/business-time.ts';
export const SourceLink=z.object({ref:SourceRef,purpose:z.string().trim().min(1).max(500)}).strict();
export const Scope=z.enum(['personal','cognition','project','employment','person','opportunity']);
export const Nature=z.enum(['fact_statement','observation','hypothesis']);
const Content=z.object({title:z.string().trim().min(1).max(200),body:z.string().trim().min(1).max(64000),scope:Scope,scopeId:z.uuid().optional(),nature:Nature,sources:z.array(SourceLink).max(20)}).strict();
export const Knowledge=Content.extend({id:z.uuid(),revision:z.number().int().positive(),status:z.enum(['active','retired']),recordedBy:z.literal('user'),verification:z.literal('not_verified'),recordedAt:z.string(),reviewRequired:z.boolean().optional(),origin:z.enum(['manual','ai_accepted']).optional()}).strict();
export type Knowledge=z.infer<typeof Knowledge>;
export const History=z.object({knowledge:Knowledge,change:z.enum(['created','edited','retired','restored','corrected']),reason:z.string(),businessTime:BusinessTime,recordedAt:z.string()}).strict();
export type History=z.infer<typeof History>;
export const ErrorCode=z.enum(['invalid_request','content_purged','not_found','source_unavailable','scope_unavailable','conflict','storage_failed']);
export const Request=z.discriminatedUnion('operation',[
 Content.extend({operation:z.literal('create'),commandId:z.uuid()}).strict(),
 Content.extend({operation:z.literal('edit'),commandId:z.uuid(),id:z.uuid(),expectedRevision:z.number().int().positive(),reason:z.string().trim().min(1).max(1000),businessTime:BusinessTime,change:z.enum(['edited','corrected'])}).strict(),
 z.object({operation:z.literal('lifecycle'),commandId:z.uuid(),id:z.uuid(),expectedRevision:z.number().int().positive(),action:z.enum(['retire','restore']),reason:z.string().trim().min(1).max(1000),businessTime:BusinessTime,correction:z.boolean()}).strict(),
 z.object({operation:z.literal('read'),id:z.uuid()}).strict(),
 z.object({operation:z.literal('list'),includeRetired:z.boolean().optional(),scope:Scope.optional(),scopeId:z.uuid().optional()}).strict(),
 z.object({operation:z.literal('history'),id:z.uuid()}).strict(),
 z.object({operation:z.literal('receipt'),commandId:z.uuid()}).strict(),
]);
export type Request=z.infer<typeof Request>;
export const Result=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('knowledge'),knowledge:Knowledge}).strict(),
 z.object({kind:z.literal('list'),items:z.array(Knowledge)}).strict(),
 z.object({kind:z.literal('history'),items:z.array(History)}).strict(),
 z.object({kind:z.literal('receipt_missing')}).strict(),
 z.object({kind:z.literal('failure'),code:ErrorCode}).strict(),
]);
export type Result=z.infer<typeof Result>;

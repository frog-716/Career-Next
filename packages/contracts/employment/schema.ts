import { z } from 'zod';
import { BusinessTime, CommandId, Revision } from '../common/business-time';
const text=z.string().trim().min(1).max(300);
export const EmploymentRelation=z.object({id:z.uuid(),company:text,role:text,status:z.enum(['current','historical']),revision:Revision}).strict();
export type EmploymentRelation=z.infer<typeof EmploymentRelation>;
export const PersonRelation=z.object({id:z.uuid(),employmentId:z.uuid(),name:text,role:z.string().max(300),revision:Revision}).strict();
export type PersonRelation=z.infer<typeof PersonRelation>;
export const Employment=EmploymentRelation.extend({goal:z.string().max(4000),start:BusinessTime,plannedEnd:BusinessTime,actualEnd:BusinessTime,recordedAt:z.iso.datetime()}).strict();
export type Employment=z.infer<typeof Employment>;
export const Person=PersonRelation.extend({recordedAt:z.iso.datetime()}).strict();
export type Person=z.infer<typeof Person>;
const change={mode:z.enum(['correction','change']),reason:z.string().trim().min(1).max(1000),occurredAt:BusinessTime};
const edit={id:z.uuid(),expectedRevision:Revision,commandId:CommandId};
export const Request=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('list')}).strict(),
 z.object({operation:z.literal('read'),id:z.uuid()}).strict(),
 z.object({operation:z.literal('create'),commandId:CommandId,company:text,role:text,goal:z.string().max(4000),started:z.literal(true),start:BusinessTime,plannedEnd:BusinessTime}).strict(),
 z.object({operation:z.literal('edit'),...edit,...change,company:text,role:text,goal:z.string().max(4000),start:BusinessTime,plannedEnd:BusinessTime,actualEnd:BusinessTime}).strict(),
 z.object({operation:z.literal('end'),...edit,...change,actualEnd:BusinessTime}).strict(),
 z.object({operation:z.literal('reopen'),...edit,...change}).strict(),
 z.object({operation:z.literal('history'),id:z.uuid()}).strict(),
 z.object({operation:z.literal('person.create'),commandId:CommandId,employmentId:z.uuid(),name:text,role:z.string().max(300),occurredAt:BusinessTime}).strict(),
 z.object({operation:z.literal('person.edit'),...edit,...change,employmentId:z.uuid(),name:text,role:z.string().max(300)}).strict(),
 z.object({operation:z.literal('person.history'),id:z.uuid(),employmentId:z.uuid()}).strict(),
 z.object({operation:z.literal('receipt'),commandId:CommandId}).strict(),
]);
export type Request=z.infer<typeof Request>;
export const EmploymentHistory=z.object({revision:Revision,action:z.enum(['created','edited','ended','reopened']),mode:z.enum(['record','correction','change']),reason:z.string(),occurredAt:BusinessTime,recordedAt:z.iso.datetime(),employment:Employment}).strict();
export const PersonHistory=z.object({revision:Revision,mode:z.enum(['record','correction','change']),reason:z.string(),occurredAt:BusinessTime,recordedAt:z.iso.datetime(),person:Person}).strict();
export const Result=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('list'),employments:z.array(Employment)}).strict(),
 z.object({kind:z.literal('employment'),employment:Employment,people:z.array(Person)}).strict(),
 z.object({kind:z.literal('person'),person:Person}).strict(),
 z.object({kind:z.literal('history'),history:z.array(EmploymentHistory)}).strict(),
 z.object({kind:z.literal('person.history'),history:z.array(PersonHistory)}).strict(),
 z.object({kind:z.literal('failure'),code:z.enum(['invalid_input','not_found','conflict','invalid_transition','storage_error']),current:z.union([Employment,Person]).optional()}).strict(),
 z.object({kind:z.literal('not_recorded')}).strict(),
]);
export type Result=z.infer<typeof Result>;

import {z} from 'zod';
import {BusinessTime,CommandId,Revision} from '../common/business-time.ts';
import {EmploymentRelation,PersonRelation} from '../employment/schema.ts';
const name=z.string().trim().min(1).max(300);
export const State=z.enum(['inprogress','paused','completed','cancelled']);
export const Project=z.object({
 id:z.uuid(),revision:Revision,name,description:z.string().max(12000),tags:z.array(z.string().trim().min(1).max(100)).max(30),
 state:State,stateNote:z.string().max(1000),employmentId:z.uuid().nullable(),contextId:z.uuid(),recordedAt:z.iso.datetime(),
}).strict();
export type Project=z.infer<typeof Project>;
export const Participation=z.object({
 id:z.uuid(),projectId:z.uuid(),contextId:z.uuid(),employmentId:z.uuid(),personId:z.uuid(),projectRole:z.string().max(1000),active:z.boolean(),recordedAt:z.iso.datetime(),
}).strict();
export type Participation=z.infer<typeof Participation>;
export const ParticipantView=Participation.extend({person:PersonRelation.nullable(),employment:EmploymentRelation.nullable()}).strict();
const change={mode:z.enum(['change','correction']),reason:z.string().trim().min(1).max(1000),occurredAt:BusinessTime};
const command={commandId:CommandId,id:z.uuid(),expectedRevision:Revision};
export const Request=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('list')}).strict(),
 z.object({operation:z.literal('read'),id:z.uuid()}).strict(),
 z.object({operation:z.literal('create'),commandId:CommandId,name,description:z.string().max(12000),tags:z.array(z.string().trim().min(1).max(100)).max(30),employmentId:z.uuid().nullable(),occurredAt:BusinessTime}).strict(),
 z.object({operation:z.literal('edit'),...command,...change,name,description:z.string().max(12000),tags:z.array(z.string().trim().min(1).max(100)).max(30)}).strict(),
 z.object({operation:z.literal('state.change'),...command,...change,state:State}).strict(),
 z.object({operation:z.literal('reopen'),...command,reason:change.reason,occurredAt:BusinessTime}).strict(),
 z.object({operation:z.literal('associate'),...command,...change,employmentId:z.uuid().nullable()}).strict(),
 z.object({operation:z.literal('participant.join'),...command,...change,personId:z.uuid(),projectRole:z.string().max(1000)}).strict(),
 z.object({operation:z.literal('participant.edit'),...command,...change,participationId:z.uuid(),projectRole:z.string().max(1000)}).strict(),
 z.object({operation:z.literal('participant.leave'),...command,...change,participationId:z.uuid()}).strict(),
 z.object({operation:z.literal('history'),id:z.uuid()}).strict(),
 z.object({operation:z.literal('receipt'),commandId:CommandId}).strict(),
]);
export type Request=z.infer<typeof Request>;
export const History=z.object({
 revision:Revision,action:z.enum(['created','edited','state_changed','reopened','associated','joined','rejoined','left','role_changed']),
 mode:z.enum(['record','change','correction']),reason:z.string(),occurredAt:BusinessTime,recordedAt:z.iso.datetime(),project:Project,participants:z.array(Participation),
}).strict();
export type History=z.infer<typeof History>;
export const Result=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('list'),projects:z.array(Project.extend({employment:EmploymentRelation.nullable()}).strict())}).strict(),
 z.object({kind:z.literal('project'),project:Project,employment:EmploymentRelation.nullable(),participants:z.array(ParticipantView)}).strict(),
 z.object({kind:z.literal('history'),history:z.array(History)}).strict(),
 z.object({kind:z.literal('failure'),code:z.enum(['invalid_input','not_found','conflict','invalid_transition','invalid_relation','storage_error']),current:Project.optional()}).strict(),
 z.object({kind:z.literal('not_recorded')}).strict(),
]);
export type Result=z.infer<typeof Result>;

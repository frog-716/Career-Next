import {z} from 'zod';
export const Target=z.object({scope:z.enum(['personal','cognition','project','employment','person','opportunity']),scopeId:z.uuid().optional()}).strict().refine(value=>['personal','cognition'].includes(value.scope)?value.scopeId===undefined:value.scopeId!==undefined,'object scope requires identity');
export type Target=z.infer<typeof Target>;
export const Budget=z.object({requests:z.number().int().min(1).max(10),inputBytes:z.number().int().min(1).max(1048576),outputBytes:z.number().int().min(1).max(262144)}).strict();
export type Budget=z.infer<typeof Budget>;
export const Content=z.object({title:z.string().trim().min(1).max(200),body:z.string().trim().min(1).max(64000),nature:z.enum(['fact_statement','observation','hypothesis'])}).strict();
export type Content=z.infer<typeof Content>;
const Explanation={reason:z.string().trim().min(1).max(1000),citations:z.array(z.uuid()).max(20),unknowns:z.array(z.string().max(500)).max(20)};
export const Change=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('create'),content:Content,...Explanation}).strict(),
 z.object({kind:z.literal('edit'),itemId:z.uuid(),content:Content,...Explanation}).strict(),
 z.object({kind:z.literal('retire'),itemId:z.uuid(),...Explanation}).strict(),
]);
export type Change=z.infer<typeof Change>;
export const ProviderOutput=z.object({proposals:z.array(Change).max(20)}).strict();
export type ProviderOutput=z.infer<typeof ProviderOutput>;
export const Recipient=z.object({service:z.string().min(1).max(100),endpoint:z.string().min(1).max(500),account:z.string().min(1).max(100),generation:z.string().min(1).max(100),model:z.string().min(1).max(100)}).strict();
export const OperationState=z.enum(['not_sent','dispatching','processing','success','failure','outcome_unknown']);
export const ProposalState=z.enum(['pending','accepted','rejected']);
export {Provenance} from '../common/provenance.ts';
import {Provenance} from '../common/provenance.ts';

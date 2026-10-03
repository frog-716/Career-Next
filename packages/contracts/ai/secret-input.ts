import {z} from 'zod';
// Desktop-only, write-only protocol. Never part of generic command DTOs or recorder.
export const SecretInput=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('save'),value:z.string().min(1).max(4096)}),
 z.strictObject({operation:z.literal('status')}),
 z.strictObject({operation:z.literal('disable')}),
 z.strictObject({operation:z.literal('delete')}),
]);
export const SecretStatus=z.strictObject({configured:z.boolean(),enabled:z.boolean(),generation:z.uuid().optional()});
export const SecretResult=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('status'),status:SecretStatus}),
 z.strictObject({kind:z.literal('failure'),code:z.enum(['secure_storage_unavailable','secret_save_failed','invalid_request'])}),
]);
export type SecretBridge={request(input:z.infer<typeof SecretInput>):Promise<z.infer<typeof SecretResult>>};
declare global{interface Window{careerSecrets:SecretBridge}}

import {z} from 'zod';
export const CredentialFailure=z.enum(['credential_cancelled','credential_denied','credential_timeout','credential_unavailable']);
export type CredentialFailure=z.infer<typeof CredentialFailure>;
export const CredentialAuthorization=z.enum(['idle','waiting_for_system_authorization','ready','cancelled','denied','timeout','unavailable']);
// Emergency protection for a stuck native operation, not a human interaction deadline.
export const credentialAuthorizationSafetyMs=15*60*1000;
// Desktop-only, write-only protocol. Never part of generic command DTOs or recorder.
export const SecretInput=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('save'),value:z.string().min(1).max(4096),provider:z.literal('deepseek-v4.1-flash').optional()}),
 z.strictObject({operation:z.literal('status')}),
 // Explicit local check in trusted Main; no credential value or network operation is returned.
 z.strictObject({operation:z.literal('check')}),
 // Cancels this local wait; does not type into or dismiss the OS-owned window.
 z.strictObject({operation:z.literal('cancel')}),
 z.strictObject({operation:z.literal('disable')}),
 z.strictObject({operation:z.literal('delete')}),
]);
export const SecretStatus=z.strictObject({configured:z.boolean(),enabled:z.boolean(),provider:z.literal('deepseek-v4.1-flash').optional(),generation:z.uuid().optional(),readiness:z.enum(['unchecked','available','unavailable']).optional(),readinessReason:z.enum(['storage_unavailable','record_unavailable','provider_mismatch','decrypt_failed','invalid_credential','generation_changed','credential_cancelled','credential_denied','credential_timeout']).optional(),authorization:CredentialAuthorization.optional()});
export const SecretResult=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('status'),status:SecretStatus}),
 z.strictObject({kind:z.literal('failure'),code:z.enum(['secure_storage_unavailable','secret_save_failed','invalid_request'])}),
]);
export type SecretBridge={request(input:z.infer<typeof SecretInput>):Promise<z.infer<typeof SecretResult>>};
declare global{interface Window{careerSecrets:SecretBridge;careerTavilySecrets:SecretBridge}}

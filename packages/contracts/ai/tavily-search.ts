import {z} from 'zod';
import {CredentialFailure} from './secret-input';
import {SearchOwner,SearchRun} from './search';
/** Exact J-07 public query approved by the human; no caller-supplied context is accepted. */
export const tavilyPreviewPayload={recipient:{provider:'Tavily',endpoint:'https://api.tavily.com/search',method:'POST'},body:{query:'OpenAI official website'},limits:{maxAttempts:1,automaticRetry:false,followRedirects:false,providerFallback:false},excludedData:['Resume','Raw','Profile','Career private data'],authentication:'Device Secret Vault credential in Authorization header; value excluded from preview'} as const;
export const tavilyPreviewDigest='b7e69204012bdce7dd3b0e66c14434873ac4788f4c2e223137b2ed27ad8059b7';
export const TavilyRequest=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('preview'),owner:SearchOwner}),
 z.strictObject({operation:z.literal('run'),owner:SearchOwner,commandId:z.uuid(),previewDigest:z.literal(tavilyPreviewDigest),confirmed:z.literal(true)}),
 z.strictObject({operation:z.literal('receipt')}),
 // Local-only formal private credential bridge check. Never reserves a slot or calls HTTP.
 z.strictObject({operation:z.literal('credential.check')})
]);export type TavilyRequest=z.infer<typeof TavilyRequest>;
export const TavilyFailureStage=z.enum(['credential_resolver','credential_format','persistence_gate','session_gate','credential_resolve','request_build','connect','TLS','HTTP auth','HTTP response','parse','transport_unknown']);
export const TavilyStageEvidence=z.strictObject({credential_resolve:z.enum(['PASS','FAIL','NOT RUN']),request_build:z.enum(['PASS','FAIL','NOT RUN']),connect:z.enum(['PASS','FAIL','UNKNOWN','NOT RUN']),TLS:z.enum(['PASS','FAIL','UNKNOWN','NOT RUN']),'HTTP auth':z.enum(['PASS','FAIL','UNKNOWN','NOT RUN']),'HTTP response':z.enum(['PASS','FAIL','NOT RUN']),parse:z.enum(['PASS','FAIL','NOT RUN'])});
export const TavilyResult=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('credential_readiness'),available:z.boolean(),elapsedMs:z.number().int().nonnegative(),failureReason:CredentialFailure.optional()}),
 z.strictObject({kind:z.literal('preview'),recipient:z.literal('Tavily'),endpoint:z.literal('https://api.tavily.com/search'),query:z.literal('OpenAI official website'),previewDigest:z.literal(tavilyPreviewDigest),configured:z.boolean(),enabled:z.boolean(),used:z.boolean()}),
 z.strictObject({kind:z.literal('candidate'),run:SearchRun}),
 z.strictObject({kind:z.literal('state'),state:z.enum(['not_run','reserved','not_sent','dispatching','outcome_unknown','response_received','captured','failed']),requestCount:z.number().int().min(0).max(1),runId:z.uuid().optional(),failureStage:TavilyFailureStage.optional(),httpStatus:z.number().int().min(100).max(599).optional(),credentialFailure:CredentialFailure.optional(),stages:TavilyStageEvidence.optional()}),
 z.strictObject({kind:z.literal('failure'),code:z.enum(['invalid_request','credential_unavailable','already_consumed','search_failed','outcome_unknown','capture_pending','disconnected','preflight_denied','credential_timeout','credential_cancelled','credential_denied']),failureStage:TavilyFailureStage.optional(),httpStatus:z.number().int().min(100).max(599).optional(),credentialFailure:CredentialFailure.optional(),stages:TavilyStageEvidence.optional()})
]);export type TavilyResult=z.infer<typeof TavilyResult>;
export type TavilyBridge={request(input:TavilyRequest):Promise<TavilyResult>};
declare global{interface Window{careerTavilySearch:TavilyBridge}}

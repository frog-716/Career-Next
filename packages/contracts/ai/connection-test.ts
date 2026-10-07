import {z} from 'zod';

export const deepSeekConnectionEndpoint='https://api.deepseek.com/chat/completions';
export const deepSeekConnectionBody={
 model:'deepseek-flash',
 thinking:{type:'disabled'},
 response_format:{type:'json_object'},
 stream:false,
 max_tokens:16,
 messages:[
  {role:'system',content:'This is a provider connectivity check only. Do not request or infer user data. Return JSON only: {"status":"ready"}.'},
  {role:'user',content:'Connectivity check. Return {"status":"ready"}.'},
 ],
} as const;

export const tavilyConnectionEndpoint='https://api.tavily.com/search';
export const tavilyConnectionBody={query:'OpenAI official website',search_depth:'basic',max_results:1,include_answer:false,include_raw_content:false,include_images:false,include_usage:false} as const;

const DeepSeekBody=z.strictObject({model:z.literal('deepseek-flash'),thinking:z.strictObject({type:z.literal('disabled')}),response_format:z.strictObject({type:z.literal('json_object')}),stream:z.literal(false),max_tokens:z.literal(16),messages:z.tuple([z.strictObject({role:z.literal('system'),content:z.string()}),z.strictObject({role:z.literal('user'),content:z.string()})])});
const TavilyBody=z.strictObject({query:z.literal('OpenAI official website'),search_depth:z.literal('basic'),max_results:z.literal(1),include_answer:z.literal(false),include_raw_content:z.literal(false),include_images:z.literal(false),include_usage:z.literal(false)});

export const ProviderConnectionTestRequest=z.discriminatedUnion('operation',[
 z.strictObject({operation:z.literal('preview'),provider:z.enum(['deepseek','tavily'])}),
 z.strictObject({operation:z.literal('run'),provider:z.enum(['deepseek','tavily']),confirmed:z.literal(true)}),
]);

const Preview=z.discriminatedUnion('provider',[
 z.strictObject({provider:z.literal('deepseek'),displayModel:z.literal('DeepSeek V4.1-Flash'),model:z.literal('deepseek-flash'),endpoint:z.literal(deepSeekConnectionEndpoint),method:z.literal('POST'),body:DeepSeekBody,thinking:z.literal('disabled'),fallback:z.literal(false),automaticRetry:z.literal(false),followRedirects:z.literal(false),businessDataSent:z.literal(false)}),
 z.strictObject({provider:z.literal('tavily'),endpoint:z.literal(tavilyConnectionEndpoint),method:z.literal('POST'),body:TavilyBody,fallback:z.literal(false),automaticRetry:z.literal(false),followRedirects:z.literal(false),businessDataSent:z.literal(false)}),
]);
const SafeFailureStage=z.enum(['credential_resolve','connect','TLS','HTTP auth','HTTP response','parse','already_used']);
export const ProviderConnectionTestResult=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('preview'),preview:Preview}),
 z.strictObject({kind:z.literal('result'),provider:z.enum(['deepseek','tavily']),status:z.enum(['connected','failed']),requestCount:z.union([z.literal(0),z.literal(1)]),httpStatus:z.number().int().min(100).max(599).optional(),responseValid:z.boolean(),resultCount:z.number().int().nonnegative().optional(),failureStage:SafeFailureStage.optional()}),
]);
export type ProviderConnectionTestInput=z.infer<typeof ProviderConnectionTestRequest>;
export type ProviderConnectionTestOutput=z.infer<typeof ProviderConnectionTestResult>;
export type ProviderConnectionTestBridge={request(input:ProviderConnectionTestInput):Promise<ProviderConnectionTestOutput>};

declare global{interface Window{careerConnectionTest:ProviderConnectionTestBridge}}

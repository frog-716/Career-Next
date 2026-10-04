import {createHash} from 'node:crypto';
import {mkdir,open,readFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {tavilyPreviewPayload,tavilyPreviewDigest,TavilyRequest,TavilyFailureStage,TavilyStageEvidence} from '../../../contracts/ai/tavily-search';
import {CredentialFailure} from '../../../contracts/ai/secret-input';
import {durableJson} from '../backup/managed-copies';
const HttpUrl=z.url().max(2000).refine(value=>['https:','http:'].includes(new URL(value).protocol));
export const TavilyResponse=z.object({query:z.literal('OpenAI official website'),request_id:z.string().max(200).optional(),results:z.array(z.object({title:z.string().min(1).max(200),url:HttpUrl,content:z.string().max(64000)})).max(20)});
export const CapturedSearch=z.strictObject({id:z.uuid(),recordedAt:z.iso.datetime(),response:TavilyResponse});export type CapturedSearch=z.infer<typeof CapturedSearch>;
const Marker=z.strictObject({id:z.uuid(),owner:TavilyRequest.options[1].shape.owner,workspaceInstance:z.uuid(),state:z.enum(['reserved','not_sent','dispatching','outcome_unknown','response_received','captured','failed']),requestCount:z.number().int().min(0).max(1),previewDigest:z.literal(tavilyPreviewDigest),requestBody:z.strictObject({query:z.literal('OpenAI official website')}),failureStage:TavilyFailureStage.optional(),httpStatus:z.number().int().min(100).max(599).optional(),credentialFailure:CredentialFailure.optional(),stages:TavilyStageEvidence.optional()});
/** One controlled acceptance slot, durable before dispatch. No SDK, redirect, retry or fallback. */
export function createTavilySearch(dataRoot:string,keyForDispatch:(generation:string)=>Promise<string>,transport:typeof fetch=fetch){
 const directory=path.join(dataRoot,'security-tavily'),filename=path.join(directory,'j07-search-operation.json');
 async function read(){try{return Marker.parse(JSON.parse(await readFile(filename,'utf8')));}catch(error){if((error as {code?:string}).code==='ENOENT')return undefined;throw Error('already_consumed');}}
 async function update(marker:z.infer<typeof Marker>){durableJson(filename,Marker.parse(marker));}
 return {read,async captured(id:string){const marker=await read();if(!marker||marker.id!==id)throw Error('already_consumed');await update({...marker,state:'captured'});},async send(input:Extract<TavilyRequest,{operation:'run'}>,generation:string,workspaceInstance:string,beforeHandoff:()=>Promise<void>,live:()=>void){
  const request=TavilyRequest.options[1].parse(input);
  if(createHash('sha256').update(JSON.stringify(tavilyPreviewPayload)).digest('hex')!==request.previewDigest)throw Error('invalid_request');
  await mkdir(directory,{recursive:true,mode:0o700});
  let marker:z.infer<typeof Marker>={id:request.commandId,owner:request.owner,workspaceInstance,state:'reserved',requestCount:0,previewDigest:tavilyPreviewDigest,requestBody:{...tavilyPreviewPayload.body},stages:{credential_resolve:'NOT RUN',request_build:'NOT RUN',connect:'NOT RUN',TLS:'NOT RUN','HTTP auth':'NOT RUN','HTTP response':'NOT RUN',parse:'NOT RUN'}};
  let handle;try{handle=await open(filename,'wx',0o600);}catch{throw Error('already_consumed');}
  try{await handle.writeFile(JSON.stringify(marker));await handle.sync();}finally{await handle.close();}
  const dir=await open(directory,'r');try{await dir.sync();}finally{await dir.close();}
  let key:string|undefined;const waiting=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   let failureStage:z.infer<typeof TavilyFailureStage>='credential_resolve';
   try{key=await keyForDispatch(generation);marker.stages!.credential_resolve='PASS';failureStage='request_build';if(!key||key.length>4096||/[\r\n]/.test(key))throw Error();new Headers({Authorization:'Bearer '+key});marker.stages!.request_build='PASS';failureStage='persistence_gate';await beforeHandoff();failureStage='session_gate';live();}catch(error){const credentialError=CredentialFailure.safeParse(error instanceof Error?error.message:undefined),credentialFailure=credentialError.success?credentialError.data:'credential_unavailable' as const;marker={...marker,state:'not_sent',failureStage,...failureStage==='credential_resolve'?{credentialFailure}:{},stages:{...marker.stages!,...failureStage==='credential_resolve'?{credential_resolve:'FAIL' as const}:failureStage==='request_build'?{request_build:'FAIL' as const}:{}}};await update(marker);throw Error(failureStage==='persistence_gate'?'preflight_denied':failureStage==='credential_resolve'?credentialFailure:'credential_unavailable');}
   live();marker={...marker,state:'dispatching',requestCount:1};await update(marker);
   timer=setTimeout(()=>waiting.abort(),60000);
   try{live();}catch{marker={...marker,state:'not_sent',requestCount:0,failureStage:'session_gate'};await update(marker);throw Error('credential_unavailable');}
   let response:Response;try{response=await transport(tavilyPreviewPayload.recipient.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(marker.requestBody),redirect:'error',signal:waiting.signal});}catch(error){
    const code=(error as {cause?:{code?:unknown};code?:unknown})?.cause?.code??(error as {code?:unknown})?.code;
    const connectFailure=['ENOTFOUND','EAI_AGAIN','ECONNREFUSED','ENETUNREACH','EHOSTUNREACH','UND_ERR_CONNECT_TIMEOUT'].includes(String(code));
    const tlsFailure=['CERT_HAS_EXPIRED','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID','CERT_NOT_YET_VALID','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION'].includes(String(code));
    marker={...marker,state:'outcome_unknown',failureStage:connectFailure?'connect':tlsFailure?'TLS':'transport_unknown',stages:{...marker.stages!,connect:connectFailure?'FAIL':tlsFailure?'PASS':'UNKNOWN',TLS:tlsFailure?'FAIL':'UNKNOWN'}};await update(marker);throw Error('outcome_unknown');}
   // A response from the fixed HTTPS endpoint proves connect/TLS succeeded. No redirect is followed.
   marker={...marker,httpStatus:response.status,stages:{...marker.stages!,connect:'PASS',TLS:'PASS','HTTP auth':response.ok?'PASS':[401,403].includes(response.status)?'FAIL':'UNKNOWN','HTTP response':'PASS'}};await update(marker);
   if(!response.ok){await response.body?.cancel().catch(()=>{});marker={...marker,state:'failed',failureStage:[401,403].includes(response.status)?'HTTP auth':'HTTP response'};await update(marker);throw Error('search_failed');}
   marker={...marker,failureStage:'HTTP response'};
   const reader=response.body?.getReader();if(!reader)throw Error('search_failed');let size=0;const chunks:Uint8Array[]=[];
   try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>262144)throw Error('search_failed');chunks.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
   marker={...marker,failureStage:'parse'};
   const text=Buffer.concat(chunks).toString('utf8');if(key&&(text.includes(key)||text.includes(JSON.stringify(key).slice(1,-1))))throw Error('search_failed');const parsed=TavilyResponse.parse(JSON.parse(text));if(key&&(JSON.stringify(parsed).includes(key)||JSON.stringify(parsed).includes(JSON.stringify(key).slice(1,-1))))throw Error('search_failed');
   const result=CapturedSearch.parse({id:request.commandId,recordedAt:new Date().toISOString(),response:parsed});
   delete marker.failureStage;marker={...marker,state:'response_received',stages:{...marker.stages!,parse:'PASS'}};await update(marker);return result;
  }catch(error){if(marker.httpStatus&&marker.state==='dispatching'){marker={...marker,state:'failed',stages:{...marker.stages!,...marker.failureStage==='parse'?{parse:'FAIL' as const}:{}}};await update(marker);}const reason=error instanceof Error?error.message:'';if(!['not_sent','failed','outcome_unknown','response_received'].includes(marker.state)){marker={...marker,state:marker.requestCount?'outcome_unknown':'not_sent'};await update(marker);}throw Error(['credential_unavailable','credential_timeout','credential_cancelled','credential_denied','preflight_denied','outcome_unknown','search_failed'].includes(reason)?reason:'search_failed');}
  finally{key=undefined;if(timer)clearTimeout(timer);waiting.abort();}
 }};
}

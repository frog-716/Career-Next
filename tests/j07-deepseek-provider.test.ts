import {it,expect} from 'vitest';
import {randomUUID,createHash} from 'node:crypto';
import {createDeepSeekProvider,prepareDeepSeekRequest,deepSeekRecipient} from '../packages/backend/platform/providers/deepseek';
import {Manifest} from '../packages/contracts/ai/schema';
function manifest(){return prepareDeepSeekRequest(Manifest.parse({taskId:randomUUID(),target:{scope:'personal'},recipient:deepSeekRecipient(randomUUID()),granularity:'fulltext',system:'TEST DATA research only',tools:[],materials:[],knowledge:[],budget:{requests:1,inputBytes:65536,outputBytes:65536},validity:{workspaceInstance:randomUUID(),backendGeneration:randomUUID(),expiresAt:new Date(Date.now()+60000).toISOString()},stopBoundary:'before-handoff',provenance:[],product:{target:{kind:'research-organize',owner:{kind:'company',id:randomUUID()}},body:'Target: Example Corp / Test Opportunity\nExample Corp is testing a fictional hiring workflow.\nRole: Test Analyst.\nHiring process: Two fictional interview rounds.',missing:[],dependencies:[],identityFields:[]}}));}
it('DeepSeek sends exactly the previewed V4.1-Flash non-thinking JSON request once and parses a bounded Research Proposal',async()=>{
 const m=manifest(),requests:{url:string;body:string}[]=[];
 const adapter=createDeepSeekProvider(m.recipient.generation,async()=> 'SYNTHETIC_TEST_KEY',async(url,init)=>{requests.push({url:String(url),body:String(init?.body)});return new Response(JSON.stringify({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify({proposals:[{kind:'create',content:{title:'Fictional hiring process',body:'Two fictional interview rounds.',nature:'hypothesis'},reason:'TEST DATA only; not independently verified.',citations:[],unknowns:['No independent verification.']}]})}}],usage:{prompt_tokens:140,completion_tokens:45,total_tokens:185}}),{status:200});});
 const out=await adapter.send({operationId:randomUUID(),manifest:m,manifestDigest:createHash('sha256').update(JSON.stringify(m)).digest('hex')},new AbortController().signal);
 expect(requests).toEqual([{url:'https://api.deepseek.com/chat/completions',body:JSON.stringify(m.providerRequest)}]);
 expect(m.providerRequest).toMatchObject({model:'deepseek-flash',thinking:{type:'disabled'},response_format:{type:'json_object'},stream:false});
 expect(out).toMatchObject({proposals:[{kind:'create',content:{nature:'hypothesis'}}],providerUsage:{model:'deepseek-flash',inputTokens:140,outputTokens:45,totalTokens:185,cost:'not_reported'}});
});
it('revocation while the private credential bridge is pending prevents the HTTP handoff',async()=>{
 const m=manifest(),stop=new AbortController();let release!:(key:string)=>void,calls=0;
 const adapter=createDeepSeekProvider(m.recipient.generation,()=>new Promise(resolve=>release=resolve),async()=>{calls++;throw Error('must not send');});
 const pending=adapter.send({operationId:randomUUID(),manifest:m,manifestDigest:createHash('sha256').update(JSON.stringify(m)).digest('hex')},stop.signal);
 stop.abort();release('SYNTHETIC_TEST_KEY');await expect(pending).rejects.toThrow('not_sent');expect(calls).toBe(0);
});
it('a changed preview fails before reading a credential',async()=>{
 const m=manifest(),digest=createHash('sha256').update(JSON.stringify(m)).digest('hex');let reads=0;
 m.providerRequest!.messages[1].content='unapproved replacement';
 const adapter=createDeepSeekProvider(m.recipient.generation,async()=>{reads++;return 'SYNTHETIC_TEST_KEY';});
 await expect(adapter.send({operationId:randomUUID(),manifest:m,manifestDigest:digest},new AbortController().signal)).rejects.toThrow('manifest_mismatch');expect(reads).toBe(0);
});
it('unknown transport outcomes do not retry or switch models',async()=>{
 const m=manifest();let calls=0;
 const adapter=createDeepSeekProvider(m.recipient.generation,async()=> 'SYNTHETIC_TEST_KEY',async()=>{calls++;throw Error('private transport detail must not escape');});
 await expect(adapter.send({operationId:randomUUID(),manifest:m,manifestDigest:createHash('sha256').update(JSON.stringify(m)).digest('hex')},new AbortController().signal)).rejects.toThrow('outcome_unknown');expect(calls).toBe(1);
});
it('an unexpected response model is rejected without fallback or another request',async()=>{
 const m=manifest();let calls=0;
 const adapter=createDeepSeekProvider(m.recipient.generation,async()=> 'SYNTHETIC_TEST_KEY',async()=>{calls++;return new Response(JSON.stringify({model:'deepseek-v4-pro',choices:[],usage:{}}));});
 await expect(adapter.send({operationId:randomUUID(),manifest:m,manifestDigest:createHash('sha256').update(JSON.stringify(m)).digest('hex')},new AbortController().signal)).rejects.toThrow('invalid_output');expect(calls).toBe(1);
});
it('authorization expiry during credential retrieval prevents HTTP',async()=>{
 const m=manifest();m.validity.expiresAt=new Date(Date.now()-1).toISOString();let calls=0;
 const adapter=createDeepSeekProvider(m.recipient.generation,async()=> 'SYNTHETIC_TEST_KEY',async()=>{calls++;throw Error('must not send');});
 await expect(adapter.send({operationId:randomUUID(),manifest:m,manifestDigest:createHash('sha256').update(JSON.stringify(m)).digest('hex')},new AbortController().signal)).rejects.toThrow('not_sent');expect(calls).toBe(0);
});
it.each(['literal','outer-escaped','inner-escaped','quoted-key'])('rejects a %s reflected synthetic credential without leaking or retrying',async encoding=>{
 const m=manifest(),key=encoding==='quoted-key'?'SYNTHETIC"QUOTED"\\CREDENTIAL':'SYNTHETIC_REFLECTED_CREDENTIAL';let calls=0;
 const proposals={proposals:[{kind:'create',content:{title:'Fictional',body:key,nature:'hypothesis'},reason:'TEST DATA',citations:[],unknowns:[]}]};
 const escaped=Array.from(key).map(char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0')).join('');
 let content=JSON.stringify(proposals);if(encoding==='inner-escaped')content=content.replace(key,escaped);
 let response=JSON.stringify({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{content}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}});
 if(encoding==='outer-escaped')response=response.replace(key,escaped);
 const adapter=createDeepSeekProvider(m.recipient.generation,async()=>key,async()=>{calls++;return new Response(response);});
 await expect(adapter.send({operationId:randomUUID(),manifest:m,manifestDigest:createHash('sha256').update(JSON.stringify(m)).digest('hex')},new AbortController().signal)).rejects.toThrow(/^invalid_output$/);
 expect(calls).toBe(1);
});

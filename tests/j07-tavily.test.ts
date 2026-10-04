import {it,expect} from 'vitest';
import {mkdtemp,rm,readFile} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';
import {createTavilySearch} from '../packages/backend/platform/providers/tavily';
import {tavilyPreviewDigest} from '../packages/contracts/ai/tavily-search';
const response={query:'OpenAI official website',request_id:'TEST-request',results:[{title:'OpenAI',url:'https://openai.com/',content:'A public result, not independently verified.'}]};
it('rejects a quoted synthetic credential reflected in decoded search content without storing or retrying it',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-tavily-quoted-')),key='SYNTHETIC"QUOTED"\\CREDENTIAL';let calls=0;
 try{
  const adapter=createTavilySearch(root,async()=>key,async()=>{calls++;return new Response(JSON.stringify({...response,results:[{...response.results[0],content:key}]}));});
  await expect(adapter.send({operation:'run',commandId:randomUUID(),owner:{kind:'company',id:randomUUID()},confirmed:true,previewDigest:tavilyPreviewDigest},randomUUID(),randomUUID(),async()=>{},()=>{})).rejects.toThrow('search_failed');
  expect(calls).toBe(1);const marker=JSON.stringify(await adapter.read());expect(marker).not.toContain(key);expect(marker).not.toContain(JSON.stringify(key).slice(1,-1));
 }finally{await rm(root,{recursive:true,force:true});}
});
it('sends the approved query alone, once, and persists a restart-safe slot without credential bytes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-tavily-'));let calls=0,reads=0;const key='J07_SYNTHETIC_TAVILY_KEY',owner={kind:'company' as const,id:randomUUID()},input={operation:'run' as const,commandId:randomUUID(),owner,confirmed:true as const,previewDigest:tavilyPreviewDigest as typeof tavilyPreviewDigest},workspace=randomUUID();
 const transport:typeof fetch=async(url,init)=>{calls++;expect(url).toBe('https://api.tavily.com/search');expect(init?.body).toBe('{"query":"OpenAI official website"}');expect(init?.redirect).toBe('error');expect((init?.headers as any).Authorization).toBe('Bearer '+key);return new Response(JSON.stringify(response));};
 try{const adapter=createTavilySearch(root,async()=>{reads++;return key;},transport);const results=await Promise.allSettled([adapter.send(input,randomUUID(),workspace,async()=>{},()=>{}),adapter.send({...input,commandId:randomUUID()},randomUUID(),workspace,async()=>{},()=>{})]);expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(calls).toBe(1);expect(reads).toBe(1);
 const persisted=await readFile(path.join(root,'security-tavily/j07-search-operation.json'),'utf8');expect(persisted).not.toContain(key);expect(JSON.parse(persisted)).toMatchObject({state:'response_received',requestCount:1,requestBody:{query:response.query}});expect(persisted).not.toContain(response.results[0]!.content);
 await expect(createTavilySearch(root,async()=>{throw Error('must not read');},transport).send({...input,commandId:randomUUID()},randomUUID(),workspace,async()=>{},()=>{})).rejects.toThrow('already_consumed');expect(calls).toBe(1);
 }finally{await rm(root,{recursive:true,force:true});}
});
it('outcome_unknown does not resend and a redirect is never followed',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-tavily-unknown-'));let calls=0;const input={operation:'run' as const,commandId:randomUUID(),owner:{kind:'company' as const,id:randomUUID()},confirmed:true as const,previewDigest:tavilyPreviewDigest as typeof tavilyPreviewDigest};
 try{const adapter=createTavilySearch(root,async()=> 'SYNTHETIC',async(_url,init)=>{calls++;expect(init?.redirect).toBe('error');throw Error('network may have accepted request');});await expect(adapter.send(input,randomUUID(),randomUUID(),async()=>{},()=>{})).rejects.toThrow('outcome_unknown');await expect(adapter.send(input,randomUUID(),randomUUID(),async()=>{},()=>{})).rejects.toThrow('already_consumed');expect(calls).toBe(1);expect(await adapter.read()).toMatchObject({state:'outcome_unknown',requestCount:1});}finally{await rm(root,{recursive:true,force:true});}
});
it('rejects malformed preview before Key retrieval and never persists a Key reflected by the service',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-tavily-reject-'));let calls=0,reads=0;const key='SYNTHETIC_ECHO_SECRET',input={operation:'run' as const,commandId:randomUUID(),owner:{kind:'company' as const,id:randomUUID()},confirmed:true as const,previewDigest:tavilyPreviewDigest as typeof tavilyPreviewDigest};
 try{const adapter=createTavilySearch(root,async()=>{reads++;return key;},async()=>{calls++;return new Response(JSON.stringify({...response,results:[{...response.results[0],content:key}]}).replace(key,[...key].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('')));});await expect(adapter.send({...input,query:'private data'} as any,randomUUID(),randomUUID(),async()=>{},()=>{})).rejects.toThrow();expect(reads).toBe(0);expect(calls).toBe(0);await expect(adapter.send(input,randomUUID(),randomUUID(),async()=>{},()=>{})).rejects.toThrow('search_failed');expect(await readFile(path.join(root,'security-tavily/j07-search-operation.json'),'utf8')).not.toContain(key);expect(calls).toBe(1);}finally{await rm(root,{recursive:true,force:true});}
});

it('revocation after credential retrieval but before HTTP handoff sends zero requests',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-tavily-revoke-'));let calls=0,enabled=true;
 try{const adapter=createTavilySearch(root,async()=> 'SYNTHETIC_KEY',async()=>{calls++;throw Error('must not send');});await expect(adapter.send({operation:'run',commandId:randomUUID(),owner:{kind:'company',id:randomUUID()},confirmed:true,previewDigest:tavilyPreviewDigest},randomUUID(),randomUUID(),async()=>{enabled=false;},()=>{if(!enabled)throw Error('credential_unavailable');})).rejects.toThrow('credential_unavailable');expect(calls).toBe(0);expect(await adapter.read()).toMatchObject({state:'not_sent',requestCount:0});}finally{await rm(root,{recursive:true,force:true});}
});
it('a persistence gate rejection is not misreported as an unavailable credential, and sends zero requests',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-tavily-preflight-'));let calls=0;
 try{const adapter=createTavilySearch(root,async()=> 'SYNTHETIC_KEY',async()=>{calls++;throw Error('must not send');});await expect(adapter.send({operation:'run',commandId:randomUUID(),owner:{kind:'company',id:randomUUID()},confirmed:true,previewDigest:tavilyPreviewDigest},randomUUID(),randomUUID(),async()=>{throw Error('persistence_denied');},()=>{})).rejects.toThrow('preflight_denied');expect(calls).toBe(0);expect(await adapter.read()).toMatchObject({state:'not_sent',requestCount:0,failureStage:'persistence_gate'});}finally{await rm(root,{recursive:true,force:true});}
});
it('invalid credential header values are rejected before transport rather than counted as outcome_unknown',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-tavily-header-'));let calls=0;
 try{const adapter=createTavilySearch(root,async()=> 'SYNTHETIC\u200BKEY',async()=>{calls++;throw Error('must not send');});await expect(adapter.send({operation:'run',commandId:randomUUID(),owner:{kind:'company',id:randomUUID()},confirmed:true,previewDigest:tavilyPreviewDigest},randomUUID(),randomUUID(),async()=>{},()=>{})).rejects.toThrow('credential_unavailable');expect(calls).toBe(0);expect(await adapter.read()).toMatchObject({state:'not_sent',requestCount:0,failureStage:'request_build'});}finally{await rm(root,{recursive:true,force:true});}
});
it.each([401,403,429])('records HTTP %i without retry or response-body credential leakage',async status=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-tavily-http-'));let calls=0;
 try{const adapter=createTavilySearch(root,async()=> 'SYNTHETIC_KEY',async()=>{calls++;return new Response('SYNTHETIC_KEY',{status});});await expect(adapter.send({operation:'run',commandId:randomUUID(),owner:{kind:'company',id:randomUUID()},confirmed:true,previewDigest:tavilyPreviewDigest},randomUUID(),randomUUID(),async()=>{},()=>{})).rejects.toThrow('search_failed');expect(calls).toBe(1);const marker=await adapter.read();expect(marker).toMatchObject({requestCount:1,httpStatus:status,failureStage:status===429?'HTTP response':'HTTP auth'});expect(JSON.stringify(marker)).not.toContain('SYNTHETIC_KEY');}finally{await rm(root,{recursive:true,force:true});}
});
it('records a parse failure after HTTP 200 instead of an unknown transport outcome',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-tavily-parse-'));
 try{const adapter=createTavilySearch(root,async()=> 'SYNTHETIC_KEY',async()=>new Response('not JSON'));await expect(adapter.send({operation:'run',commandId:randomUUID(),owner:{kind:'company',id:randomUUID()},confirmed:true,previewDigest:tavilyPreviewDigest},randomUUID(),randomUUID(),async()=>{},()=>{})).rejects.toThrow('search_failed');expect(await adapter.read()).toMatchObject({state:'failed',requestCount:1,httpStatus:200,failureStage:'parse'});}finally{await rm(root,{recursive:true,force:true});}
});

it.each([['ENOTFOUND','connect'],['ERR_TLS_CERT_ALTNAME_INVALID','TLS']])('records a known %s transport failure without leaking its error message or retrying',async(code,stage)=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-tavily-stage-'));let calls=0;
 try{const adapter=createTavilySearch(root,async()=> 'SYNTHETIC_KEY',async()=>{calls++;throw Object.assign(Error('SYNTHETIC_KEY must not be logged'),{cause:{code}});});await expect(adapter.send({operation:'run',commandId:randomUUID(),owner:{kind:'company',id:randomUUID()},confirmed:true,previewDigest:tavilyPreviewDigest},randomUUID(),randomUUID(),async()=>{},()=>{})).rejects.toThrow('outcome_unknown');expect(calls).toBe(1);const marker=await adapter.read();expect(marker).toMatchObject({requestCount:1,failureStage:stage});expect(JSON.stringify(marker)).not.toContain('SYNTHETIC_KEY');}finally{await rm(root,{recursive:true,force:true});}
});
it('rechecks live admission immediately after the dispatch marker wait and records zero HTTP on revocation',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-tavily-final-gate-'));let calls=0,checks=0;
 try{const adapter=createTavilySearch(root,async()=> 'SYNTHETIC_KEY',async()=>{calls++;return new Response(JSON.stringify(response));});await expect(adapter.send({operation:'run',commandId:randomUUID(),owner:{kind:'company',id:randomUUID()},confirmed:true,previewDigest:tavilyPreviewDigest},randomUUID(),randomUUID(),async()=>{},()=>{if(++checks===3)throw Error('credential_unavailable');})).rejects.toThrow('credential_unavailable');expect(calls).toBe(0);expect(await adapter.read()).toMatchObject({state:'not_sent',requestCount:0,failureStage:'session_gate'});}finally{await rm(root,{recursive:true,force:true});}
});
it('a credential RPC timeout stays distinct from unavailable and never reaches transport',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-tavily-credential-timeout-'));let calls=0;
 try{const adapter=createTavilySearch(root,async()=>{throw Error('credential_timeout');},async()=>{calls++;throw Error('must not send');});await expect(adapter.send({operation:'run',commandId:randomUUID(),owner:{kind:'company',id:randomUUID()},confirmed:true,previewDigest:tavilyPreviewDigest},randomUUID(),randomUUID(),async()=>{},()=>{})).rejects.toThrow('credential_timeout');expect(calls).toBe(0);expect(await adapter.read()).toMatchObject({state:'not_sent',requestCount:0,failureStage:'credential_resolve',credentialFailure:'credential_timeout'});}finally{await rm(root,{recursive:true,force:true});}
});
it.each(['credential_cancelled','credential_denied'])('credential resolution %s is never flattened or sent to transport',async reason=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-auth-outcome-'));let calls=0;
 try{const adapter=createTavilySearch(root,async()=>{throw Error(reason);},async()=>{calls++;throw Error('Network forbidden');});await expect(adapter.send({operation:'run',commandId:randomUUID(),owner:{kind:'company',id:randomUUID()},confirmed:true,previewDigest:tavilyPreviewDigest},randomUUID(),randomUUID(),async()=>{},()=>{})).rejects.toThrow(reason);expect(calls).toBe(0);expect(await adapter.read()).toMatchObject({state:'not_sent',requestCount:0,failureStage:'credential_resolve',credentialFailure:reason});}finally{await rm(root,{recursive:true,force:true});}
});

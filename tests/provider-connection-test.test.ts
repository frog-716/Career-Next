import {it,expect} from 'vitest';
import {createProviderConnectionTester} from '../packages/backend/platform/providers/connection-test';
import {deepSeekConnectionBody,deepSeekConnectionEndpoint,tavilyConnectionBody,tavilyConnectionEndpoint} from '../packages/contracts/ai/connection-test';

it('previews fixed DeepSeek and Tavily checks without resolving credentials',async()=>{
 let reads=0;
 const tester=createProviderConnectionTester({deepseekKey:async()=>{reads++;return 'TEST';},tavilyKey:async()=>{reads++;return 'TEST';}});
 await expect(tester.request({operation:'preview',provider:'deepseek'},async()=>{reads++;return 'TEST';})).resolves.toMatchObject({kind:'preview',preview:{provider:'deepseek',model:'deepseek-flash',endpoint:deepSeekConnectionEndpoint,method:'POST',body:deepSeekConnectionBody,thinking:'disabled',fallback:false,automaticRetry:false,followRedirects:false,businessDataSent:false}});
 await expect(tester.request({operation:'preview',provider:'tavily'},async()=>{reads++;return 'TEST';})).resolves.toMatchObject({kind:'preview',preview:{provider:'tavily',endpoint:tavilyConnectionEndpoint,method:'POST',body:tavilyConnectionBody,automaticRetry:false,followRedirects:false,businessDataSent:false}});
 expect(reads).toBe(0);
});

it('sends exactly one fixed DeepSeek request, validates the model response, and exposes no credential or response body',async()=>{
 const key='TEST_ONLY_DEEPSEEK_KEY',payloads:string[]=[],headers:string[]=[],resolutions:string[]=[];
 const tester=createProviderConnectionTester({deepseekKey:async generation=>{resolutions.push(generation);return key;},tavilyKey:async()=>{throw Error('unused');},deepseekTransport:async(url,init)=>{payloads.push(String(init?.body));headers.push(new Headers(init?.headers).get('authorization')??'');expect(url).toBe(deepSeekConnectionEndpoint);expect(init?.method).toBe('POST');expect(init?.redirect).toBe('error');return new Response(JSON.stringify({model:'deepseek-flash',choices:[{message:{content:'{"status":"ready"}'}}]}),{status:200});}});
 const call=()=>tester.request({operation:'run',provider:'deepseek',confirmed:true},async()=> 'test-generation');
 await expect(call()).resolves.toMatchObject({kind:'result',provider:'deepseek',status:'connected',requestCount:1,httpStatus:200,responseValid:true});
 await expect(call()).resolves.toMatchObject({kind:'result',requestCount:0,failureStage:'already_used'});
 expect(resolutions).toEqual(['test-generation']);expect(payloads).toEqual([JSON.stringify(deepSeekConnectionBody)]);expect(headers).toEqual(['Bearer '+key]);
 expect(JSON.stringify(await call())).not.toContain(key);
});

it('sends one minimal Tavily query and returns only a count, never result text',async()=>{
 const key='TEST_ONLY_TAVILY_KEY';let calls=0,body='';
 const tester=createProviderConnectionTester({deepseekKey:async()=>{throw Error('unused');},tavilyKey:async()=>key,tavilyTransport:async(url,init)=>{calls++;body=String(init?.body);expect(url).toBe(tavilyConnectionEndpoint);expect(init?.method).toBe('POST');expect(init?.redirect).toBe('error');expect(new Headers(init?.headers).get('authorization')).toBe('Bearer '+key);return new Response(JSON.stringify({query:tavilyConnectionBody.query,results:[{title:'TEST title',url:'https://example.test/',content:'TEST snippet'}]}),{status:200});}});
 const result=await tester.request({operation:'run',provider:'tavily',confirmed:true},async()=> 'test-generation');
 expect(result).toMatchObject({kind:'result',provider:'tavily',status:'connected',requestCount:1,httpStatus:200,responseValid:true,resultCount:1});
 expect(JSON.parse(body)).toEqual(tavilyConnectionBody);expect(JSON.stringify(result)).not.toContain('TEST snippet');expect(JSON.stringify(result)).not.toContain(key);expect(calls).toBe(1);
});

it('never retries transport failures and records a single attempted request',async()=>{
 let calls=0;
 const tester=createProviderConnectionTester({deepseekKey:async()=> 'TEST',tavilyKey:async()=> 'TEST',tavilyTransport:async()=>{calls++;throw Error('TEST network failure');}});
 const result=await tester.request({operation:'run',provider:'tavily',confirmed:true},async()=> 'test-generation');
 expect(result).toMatchObject({kind:'result',status:'failed',requestCount:1,responseValid:false,failureStage:'connect'});expect(calls).toBe(1);
 await expect(tester.request({operation:'run',provider:'tavily',confirmed:true},async()=> 'test-generation')).resolves.toMatchObject({requestCount:0,failureStage:'already_used'});expect(calls).toBe(1);
});

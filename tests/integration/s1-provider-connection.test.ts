import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {createNodeHost} from '../../apps/desktop/node/host';
import {createNativeKeychainStorage} from '../../apps/desktop/capabilities/native-keychain';
import {deepSeekConnectionBody,tavilyConnectionBody} from '../../packages/contracts/ai/connection-test';

const context={bind(){},replaceBinding(){},notify(){}};
async function activeDatabase(profile:string){const pointer=JSON.parse(await readFile(path.join(profile,'active-workspace-pointer.json'),'utf8'));return path.join(profile,pointer.relativePath,'career.sqlite');}
async function digest(filename:string){try{return createHash('sha256').update(await readFile(filename)).digest('hex');}catch{return 'missing';}}

it('runs one fixed connection check per provider through TEST Keychain without business writes or response persistence',async()=>{
 const profile=await mkdtemp(path.join(os.tmpdir(),'career-S1-TEST-connection-'));
 const deepseekKey='S1_TEST_DEEPSEEK_SECRET',tavilyKey='S1_TEST_TAVILY_SECRET';let deepseekCalls=0,tavilyCalls=0,deepseekBody='',tavilyBody='';
 const options={profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false,
  providerTransport:async(_url:any,input:any)=>{deepseekCalls++;deepseekBody=String(input.body);return new Response(JSON.stringify({model:'deepseek-flash',choices:[{message:{content:'{"status":"ready"}'}}]}),{status:200});},
  tavilyTransport:async(_url:any,input:any)=>{tavilyCalls++;tavilyBody=String(input.body);return new Response(JSON.stringify({query:'OpenAI official website',results:[{title:'TEST only',url:'https://example.test/',content:'TEST result body'}]}),{status:200});},
 };
 let host=await createNodeHost(options);
 try{
  expect(await host.handlers['secrets/deepseek']({operation:'save',value:deepseekKey},context)).toMatchObject({kind:'status',status:{configured:true,enabled:true,provider:'deepseek-v4.1-flash'}});
  expect(await host.handlers['secrets/tavily']({operation:'save',value:tavilyKey},context)).toMatchObject({kind:'status',status:{configured:true,enabled:true}});
  const previewDeepseek:any=await host.handlers['connection/test']({operation:'preview',provider:'deepseek'},context);
  const previewTavily:any=await host.handlers['connection/test']({operation:'preview',provider:'tavily'},context);
  expect(previewDeepseek).toMatchObject({kind:'preview',preview:{model:'deepseek-flash',thinking:'disabled',fallback:false,automaticRetry:false,followRedirects:false,businessDataSent:false,body:deepSeekConnectionBody}});
  expect(previewTavily).toMatchObject({kind:'preview',preview:{body:tavilyConnectionBody,automaticRetry:false,followRedirects:false,businessDataSent:false}});
  expect(deepseekCalls+tavilyCalls).toBe(0);
  const db=await activeDatabase(profile),before=await digest(db);
  const resultDeepseek:any=await host.handlers['connection/test']({operation:'run',provider:'deepseek',confirmed:true},context);
  const resultTavily:any=await host.handlers['connection/test']({operation:'run',provider:'tavily',confirmed:true},context);
  expect(resultDeepseek).toMatchObject({kind:'result',provider:'deepseek',status:'connected',requestCount:1,httpStatus:200,responseValid:true});
  expect(resultTavily).toMatchObject({kind:'result',provider:'tavily',status:'connected',requestCount:1,httpStatus:200,responseValid:true,resultCount:1});
  expect(deepseekCalls).toBe(1);expect(tavilyCalls).toBe(1);expect(JSON.parse(deepseekBody)).toEqual(deepSeekConnectionBody);expect(JSON.parse(tavilyBody)).toEqual(tavilyConnectionBody);
  expect(await digest(db)).toBe(before);
  expect(JSON.stringify([resultDeepseek,resultTavily])).not.toContain(deepseekKey);expect(JSON.stringify([resultDeepseek,resultTavily])).not.toContain(tavilyKey);expect(JSON.stringify([resultDeepseek,resultTavily])).not.toContain('TEST result body');
  const duplicate:any=await host.handlers['connection/test']({operation:'run',provider:'tavily',confirmed:true},context);expect(duplicate).toMatchObject({kind:'result',requestCount:0,failureStage:'already_used'});expect(tavilyCalls).toBe(1);
  await host.close();host=await createNodeHost(options);
  expect(await host.handlers['secrets/deepseek']({operation:'status'},context)).toMatchObject({kind:'status',status:{configured:true,enabled:true,provider:'deepseek-v4.1-flash'}});
  expect(await host.handlers['secrets/tavily']({operation:'status'},context)).toMatchObject({kind:'status',status:{configured:true,enabled:true}});
  expect(deepseekCalls).toBe(1);expect(tavilyCalls).toBe(1);
 }finally{
  await host.close();
  for(const slot of ['deepseek','tavily'] as const){const storage=createNativeKeychainStorage({profile,slot,helper:path.resolve('dist/application/career-keychain')});await storage.deleteTestRoot();storage.close();}
  await rm(profile,{recursive:true,force:true});
 }
},60000);

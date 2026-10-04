import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createRuntimeBackend} from '../../packages/backend/bootstrap/runtime';
it('the formal Research path freezes the exact request, waits for authorization, and leaves owner text untouched until human acceptance',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'career-j07-contract-test-'));const key='J07_SYNTHETIC_CREDENTIAL_NOT_REAL';let requests=0,reads=0,wire='';
 const runtime=await createRuntimeBackend(path.join(root,'workspaces/local'),path.resolve('dist/application/writer.cjs'),root,{automaticBackups:false,providerBinding:{enabled:true,generation:randomUUID(),provider:'deepseek-v4.1-flash'},providerKey:async()=>{reads++;return key;},providerTransport:async(_url,init)=>{requests++;wire=String(init?.body);return new Response(JSON.stringify({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify({proposals:[{kind:'create',content:{title:'TEST DATA hiring workflow',body:'Two fictional interview rounds.',nature:'hypothesis'},reason:'Fictional test content, not independently verified.',citations:[],unknowns:['Independent verification absent.']}]})}}],usage:{prompt_tokens:200,completion_tokens:40,total_tokens:240}}));}});
 try{
 const session=await runtime.connectHuman(),call=(module:Parameters<typeof runtime.business>[1],input:unknown)=>runtime.business(session,module,input) as Promise<any>;
 const company=(await call('opportunity',{operation:'company.create',commandId:randomUUID(),name:'Example Corp'})).company;
 const opportunity=(await call('opportunity',{operation:'create',commandId:randomUUID(),companyId:company.id,role:'Test Opportunity'})).opportunity;
 const owner={kind:'opportunity',id:opportunity.id},filename=path.join(root,'TEST-DATA.txt');
 await writeFile(filename,'Example Corp is testing a fictional hiring workflow.\nRole: Test Analyst.\nHiring process: Two fictional interview rounds.');
 const preview=await runtime.materials.selectFile(session,filename,{kind:'opportunity',id:opportunity.id});
 const receipt=await runtime.materials.confirm(session,{commandId:randomUUID(),importId:preview.importId,expectedRevision:preview.revision,digest:preview.digest});
 if(receipt.status!=='committed')throw Error('test import failed');const raw=await runtime.materials.read(session,receipt.materialId);
 const prepared=await call('ai',{operation:'product.prepare',commandId:randomUUID(),input:{target:{kind:'research-organize',owner},sources:[raw.source],egressSourceIds:[raw.id],wikiIds:[],egressWikiIds:[],objects:[]},budget:{requests:1,inputBytes:524288,outputBytes:65536}});
 expect(prepared.kind).toBe('product_task');const op=prepared.task.operations[0];
 expect(op.manifest.providerRequest.model).toBe('deepseek-flash');expect(JSON.stringify(op.manifest.providerRequest)).toContain('Example Corp');expect(JSON.stringify(op.manifest.providerRequest)).toContain('Test Opportunity');expect(JSON.stringify(op.manifest.providerRequest)).toContain('Two fictional interview rounds.');expect(JSON.stringify(op.manifest)).not.toContain(key);expect(reads).toBe(0);expect(requests).toBe(0);
 expect((await call('research',{operation:'read',owner})).items).toEqual([]);
 await call('ai',{operation:'product.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest});let task:any;
 await expect.poll(async()=>{task=(await call('ai',{operation:'product.read',taskId:prepared.task.id})).task;return task.operations[0].state;},{timeout:5000}).toBe('success');
 expect(wire).toBe(JSON.stringify(op.manifest.providerRequest));expect(reads).toBe(1);expect(requests).toBe(1);expect(task.operations[0].providerUsage).toMatchObject({inputTokens:200,outputTokens:40,cost:'not_reported'});
 expect((await call('research',{operation:'read',owner})).items).toEqual([]);expect(task.proposals[0].state).toBe('pending');
 const accepted=await call('ai',{operation:'product.decide',commandId:randomUUID(),proposalIds:task.proposals.map((p:any)=>p.id),action:'accept'});expect(accepted,JSON.stringify(accepted)).toMatchObject({kind:'product_decided',owner:'research'});
 const document=await call('research',{operation:'read',owner});expect(document.items[0].item).toMatchObject({body:'Two fictional interview rounds.',userConfirmed:true,independentlyVerified:false});
 expect(JSON.stringify(task)).not.toContain(key);
 }finally{await runtime.close();await rm(root,{recursive:true,force:true});}
},15000);
it('a reflected synthetic authentication value is rejected before Proposal, recorder, business DB or backup persistence',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'career-j07-echo-')),key='J07_SYNTHETIC_REFLECTION_NEVER_PERSIST';let requests=0;
 const runtime=await createRuntimeBackend(path.join(root,'workspaces/local'),path.resolve('dist/application/writer.cjs'),root,{automaticBackups:false,providerBinding:{enabled:true,generation:randomUUID(),provider:'deepseek-v4.1-flash'},providerKey:async()=>key,providerTransport:async()=>{requests++;return new Response(JSON.stringify({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify({proposals:[{kind:'create',content:{title:'TEST DATA',body:key,nature:'hypothesis'},reason:'Fictional',citations:[],unknowns:[]}]})}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));}});
 try{
  const session=await runtime.connectHuman(),call=(module:Parameters<typeof runtime.business>[1],input:unknown)=>runtime.business(session,module,input) as Promise<any>;
  const company=(await call('opportunity',{operation:'company.create',commandId:randomUUID(),name:'TEST DATA echo'})).company,owner={kind:'company',id:company.id};
  const prepared=await call('ai',{operation:'product.prepare',commandId:randomUUID(),input:{target:{kind:'research-organize',owner},sources:[],egressSourceIds:[],wikiIds:[],egressWikiIds:[],objects:[]},budget:{requests:1,inputBytes:65536,outputBytes:65536}}),op=prepared.task.operations[0];
  await call('ai',{operation:'product.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest});let task:any;
  await expect.poll(async()=>{task=(await call('ai',{operation:'product.read',taskId:prepared.task.id})).task;return task.operations[0].state;}).toBe('failure');
  expect(task.operations[0].reason).toBe('provider_failure');
  expect(task.proposals).toEqual([]);expect(requests).toBe(1);expect(JSON.stringify(task)).not.toContain(key);
  expect((await call('research',{operation:'read',owner})).items).toEqual([]);
  expect(await call('application',{operation:'data.backup'})).toMatchObject({kind:'backup'});
  await runtime.close();
  async function check(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await check(file);else if(entry.isFile())expect((await readFile(file)).includes(Buffer.from(key))).toBe(false);}}
  await check(root);
 }finally{await runtime.close();await rm(root,{recursive:true,force:true});}
},15000);
it('revoke during private credential retrieval records NOT SENT, refunds the request reservation, and preserves revoked state',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'career-j07-revoke-'));let release!:(key:string)=>void,reads=0,requests=0;
 const runtime=await createRuntimeBackend(path.join(root,'workspaces/local'),path.resolve('dist/application/writer.cjs'),root,{automaticBackups:false,providerBinding:{enabled:true,generation:randomUUID(),provider:'deepseek-v4.1-flash'},providerKey:()=>{reads++;return new Promise(resolve=>release=resolve);},providerTransport:async()=>{requests++;throw Error('must not send');}});
 try{const session=await runtime.connectHuman(),call=(module:Parameters<typeof runtime.business>[1],input:unknown)=>runtime.business(session,module,input) as Promise<any>;
 const company=(await call('opportunity',{operation:'company.create',commandId:randomUUID(),name:'TEST DATA revoke'})).company;
 const prepared=await call('ai',{operation:'product.prepare',commandId:randomUUID(),input:{target:{kind:'research-organize',owner:{kind:'company',id:company.id}},sources:[],egressSourceIds:[],wikiIds:[],egressWikiIds:[],objects:[]},budget:{requests:1,inputBytes:65536,outputBytes:65536}});
 const op=prepared.task.operations[0];await call('ai',{operation:'product.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest});await expect.poll(()=>reads).toBe(1);
 await call('ai',{operation:'product.stop',commandId:randomUUID(),taskId:prepared.task.id,mode:'revoke'});release('SYNTHETIC_TEST_KEY');let task:any;
 await expect.poll(async()=>{task=(await call('ai',{operation:'product.read',taskId:prepared.task.id})).task;return task.operations[0].state;}).toBe('not_sent');
 expect(requests).toBe(0);expect(task.usedRequests).toBe(0);expect(task.state).toBe('revoked');expect(task.proposals).toEqual([]);
 }finally{release?.('SYNTHETIC_TEST_KEY');await runtime.close();await rm(root,{recursive:true,force:true});}
},15000);

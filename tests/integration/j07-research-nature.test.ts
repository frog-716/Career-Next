import {expect,it} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRuntimeBackend} from '../../packages/backend/bootstrap/runtime';

type Runtime=Awaited<ReturnType<typeof createRuntimeBackend>>;
type Call=(module:Parameters<Runtime['business']>[1],input:unknown)=>Promise<any>;
async function withResearchProposal(nature:string,verify:(fixture:{call:Call;owner:{kind:'company';id:string};task:any})=>Promise<void>){
 const root=await mkdtemp(path.join(os.tmpdir(),'career-j07-nature-'));
 const runtime=await createRuntimeBackend(path.join(root,'workspaces/local'),path.resolve('dist/application/writer.cjs'),root,{
  automaticBackups:false,providerBinding:{enabled:true,generation:randomUUID(),provider:'deepseek-v4.1-flash'},
  providerKey:async()=>'SYNTHETIC_LOCAL_TEST_CREDENTIAL',
  // Local response only: this transport never delegates to fetch or a real service.
  providerTransport:async()=>new Response(JSON.stringify({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify({proposals:[{kind:'create',content:{title:'TEST DATA nature',body:'Fictional hiring workflow.',nature},reason:'Supplied test material only.',citations:[],unknowns:['Independent verification is absent.']}]})}}],usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120}}))
 });
 try{
  const session=await runtime.connectHuman();
  const call=async(module:Parameters<typeof runtime.business>[1],input:unknown)=>runtime.business(session,module,input) as Promise<any>;
  const company=(await call('opportunity',{operation:'company.create',commandId:randomUUID(),name:'TEST DATA nature company'})).company;
  const owner={kind:'company' as const,id:company.id};
  const prepared=await call('ai',{operation:'product.prepare',commandId:randomUUID(),input:{target:{kind:'research-organize',owner},sources:[],egressSourceIds:[],wikiIds:[],egressWikiIds:[],objects:[]},budget:{requests:1,inputBytes:65536,outputBytes:65536}});
  const operation=prepared.task.operations[0];
  await call('ai',{operation:'product.authorize',commandId:randomUUID(),operationId:operation.id,manifestDigest:operation.manifestDigest});
  let task:any;
  await expect.poll(async()=>{task=(await call('ai',{operation:'product.read',taskId:prepared.task.id})).task;return ['success','failure'].includes(task.operations[0].state);},{timeout:5000}).toBe(true);
  await verify({call,owner,task});
 }finally{await runtime.close();await rm(root,{recursive:true,force:true});}
}

it('Research acceptance preserves a fact statement without upgrading it to independent verification or duplicating receipt replay',async()=>{
 await withResearchProposal('fact_statement',async({call,owner,task})=>{
  expect(task.operations[0].state).toBe('success');
  const decision={operation:'product.decide',commandId:randomUUID(),proposalIds:[task.proposals[0].id],action:'accept'};
  const result=await call('ai',decision);expect(result).toMatchObject({kind:'product_decided',owner:'research',state:'accepted'});
  const document=await call('research',{operation:'read',owner});expect(document.items).toHaveLength(1);
  expect(document.items[0].item).toMatchObject({nature:'fact_statement',userConfirmed:true,independentlyVerified:false});
  expect(await call('ai',decision)).toEqual(result);
  expect((await call('research',{operation:'read',owner})).items).toHaveLength(1);
 });
},15000);

it('Research maps an accepted hypothesis to inference while retaining unverified status and the original proposal nature',async()=>{
 await withResearchProposal('hypothesis',async({call,owner,task})=>{
  const proposal=task.proposals[0];
  expect((await call('research',{operation:'read',owner})).items).toEqual([]);
  expect(proposal).toMatchObject({state:'pending',change:{content:{nature:'hypothesis'}}});
  expect(await call('ai',{operation:'product.decide',commandId:randomUUID(),proposalIds:[proposal.id],action:'accept'})).toMatchObject({kind:'product_decided',state:'accepted'});
  const document=await call('research',{operation:'read',owner});expect(document.items).toHaveLength(1);
  expect(document.items[0].item).toMatchObject({nature:'inference',userConfirmed:true,independentlyVerified:false});
  const accepted=(await call('ai',{operation:'product.read',taskId:task.id})).task.proposals[0];
  expect(accepted).toMatchObject({state:'accepted',change:{content:{nature:'hypothesis'}}});
 });
},15000);

it('editing a Research proposal to observation cannot bypass policy or partially accept it',async()=>{
 await withResearchProposal('hypothesis',async({call,owner,task})=>{
  const result=await call('ai',{operation:'product.decide',commandId:randomUUID(),proposalIds:[task.proposals[0].id],action:'edit-accept',edited:{title:'TEST DATA edited nature',body:'Fictional observation.',nature:'observation'}});
  expect(result).toMatchObject({kind:'product_conflict',code:'unsupported_research_nature'});
  expect((await call('research',{operation:'read',owner})).items).toEqual([]);
  expect((await call('ai',{operation:'product.read',taskId:task.id})).task.proposals[0].state).toBe('pending');
 });
},15000);

it('unknown remains available to the Research domain without being guessed from an unsupported AI nature',async()=>{
 await withResearchProposal('unknown',async({call,owner,task})=>{
  expect(task.operations[0].state).toBe('failure');
  expect(task.proposals).toEqual([]);
  expect((await call('research',{operation:'read',owner})).items).toEqual([]);
  expect(await call('research',{operation:'create',commandId:randomUUID(),owner,title:'TEST DATA missing requirement',body:'Role requirements are unknown.',nature:'unknown',sources:[],leads:[],userConfirmed:false,independentlyVerified:false})).toMatchObject({kind:'item',item:{nature:'unknown',userConfirmed:false,independentlyVerified:false}});
 });
},15000);

it('explicitly editing an accepted candidate to a fact statement uses that nature without claiming verification',async()=>{
 await withResearchProposal('hypothesis',async({call,owner,task})=>{
  const result=await call('ai',{operation:'product.decide',commandId:randomUUID(),proposalIds:[task.proposals[0].id],action:'edit-accept',edited:{title:'TEST DATA edited statement',body:'Fictional stated hiring process.',nature:'fact_statement'}});
  expect(result).toMatchObject({kind:'product_decided',state:'accepted'});
  const document=await call('research',{operation:'read',owner});expect(document.items).toHaveLength(1);
  expect(document.items[0].item).toMatchObject({nature:'fact_statement',body:'Fictional stated hiring process.',userConfirmed:true,independentlyVerified:false});
 });
},15000);

it('Research rejects an observation at TaskPolicy validation before exposing an applicable proposal',async()=>{
 await withResearchProposal('observation',async({call,owner,task})=>{
  expect(task.operations[0]).toMatchObject({state:'failure',reason:'unsupported_research_nature'});
  expect(task.proposals).toEqual([]);
  expect((await call('research',{operation:'read',owner})).items).toEqual([]);
 });
},15000);

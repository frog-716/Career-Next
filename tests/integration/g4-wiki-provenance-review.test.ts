import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {openWorkspace} from '../../packages/backend/platform/database/database';
import {materialsMigration} from '../../packages/backend/domains/materials/migration';
import {releases} from '../../packages/backend/bootstrap/releases';
import {createWriterCommands} from '../../packages/backend/bootstrap/writer-commands';
import {Result as OpportunityResult} from '../../packages/contracts/opportunity/schema';
import {Result as InterviewResult} from '../../packages/contracts/opportunity/interview/schema';
import {Result as AiResult,type ProviderOutput} from '../../packages/contracts/ai/schema';
import {Result as WikiResult} from '../../packages/contracts/wiki/schema';
import {Result as DataResult} from '../../packages/contracts/application/schema';
import type {SourceRef} from '../../packages/contracts/common/source-ref';

it('a Wiki item depends on all actual inherited context inputs after adoption even when the model cites only selected B',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g4-wiki-provenance-review-')),workspace=await openWorkspace(root,materialsMigration,releases);
 try{
  const store=createWriterCommands(workspace.database,workspace.workspaceInstance,randomUUID(),{dataRoot:root,control:{maintenance:async work=>work(),drain:async()=>{},beforeActivate:async()=>{},closeWorkspace:()=>{throw Error('not_requested');}}}),session=store.connect();
  const company=OpportunityResult.parse(await store.business(session,'opportunity',{operation:'company.create',commandId:randomUUID(),name:'真实来源公司'}));if(company.kind!=='company')throw Error();
  const opportunity=OpportunityResult.parse(await store.business(session,'opportunity',{operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'真实面试'}));if(opportunity.kind!=='opportunity')throw Error();
  const sources:SourceRef[]=[];
  for(const [index,text] of ['Sensitive A actual interview evidence','Public B evidence'].entries()){
   const confirmed=InterviewResult.parse(await store.business(session,'interview',{operation:'interview.confirm',commandId:randomUUID(),opportunityId:opportunity.opportunity.id,expectedOpportunityRevision:index+1,title:'面试'+index,confirmationTime:{kind:'unknown'}}));if(confirmed.kind!=='saved')throw Error();
   expect(await store.business(session,'interview',{operation:'interview.save-document',commandId:randomUUID(),id:confirmed.id,expectedRevision:1,document:'transcript',text})).toMatchObject({kind:'saved'});
   sources.push({owner:'interview',objectId:confirmed.id,revision:1,locator:'transcript',scope:'opportunity',opportunityId:opportunity.opportunity.id});
  }
  async function generateAccept(source:SourceRef,title:string){
   const prepared=AiResult.parse(await store.business(session,'ai',{operation:'ai.prepare',commandId:randomUUID(),sources:[source],target:{scope:'personal'},budget:{requests:1,inputBytes:100000,outputBytes:10000}}));if(prepared.kind!=='task')throw Error();
   const op=prepared.task.operations[0]!;
   expect(await store.business(session,'ai',{operation:'ai.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest})).toMatchObject({kind:'task'});
   store.aiPrepareDispatch(op.id);
   const output:ProviderOutput={proposals:[{kind:'create',content:{title,body:'An independently retained conclusion '+title,nature:'observation'},reason:'explicit task',citations:[source.objectId],unknowns:[]}]};store.aiSettle(op.id,output);
   const generated=AiResult.parse(await store.business(session,'ai',{operation:'ai.read',taskId:prepared.task.id}));if(generated.kind!=='task')throw Error();
   expect(await store.business(session,'ai',{operation:'ai.decide',commandId:randomUUID(),proposalId:generated.task.proposals[0]!.id,action:'accept'})).toMatchObject({kind:'decided',state:'accepted'});
   return prepared.task;
  }
  await generateAccept(sources[0]!,'A context knowledge');
  const second=await generateAccept(sources[1]!,'B-only citation result');
  expect(second.operations[0]!.provenance.map(input=>input.objectId)).toContain(sources[0]!.objectId);
  const list=WikiResult.parse(await store.business(session,'wiki',{operation:'list'}));if(list.kind!=='list')throw Error();
  const result=list.items.find(item=>item.title==='B-only citation result')!;
  expect(result.sources.map(input=>input.ref.objectId)).toEqual([sources[1]!.objectId]);
  expect(result.trustedProvenance?.map(input=>input.objectId)).toContain(sources[0]!.objectId);
  const planned=DataResult.parse(await store.business(session,'application',{operation:'data.purge.plan',references:[{owner:'interview',objectId:sources[0]!.objectId}]}));if(planned.kind!=='purge_plan')throw Error();
  expect(await store.business(session,'application',{operation:'data.purge.confirm',planId:planned.plan.id,selectedCopyIds:planned.plan.copies.map(copy=>copy.id),confirmed:true})).toMatchObject({kind:'purged',scope:'selected_scope'});
  const current=WikiResult.parse(await store.business(session,'wiki',{operation:'read',id:result.id}));
  expect(current).toMatchObject({kind:'knowledge',knowledge:{body:result.body,reviewRequired:true}});
 }finally{workspace.close();await rm(root,{recursive:true,force:true});}
});

it('clearing a manual Wiki context X marks adopted Y for review without invalidating Y for ordinary X revisions',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g4-wiki-context-purge-')),workspace=await openWorkspace(root,materialsMigration,releases);
 try{
  const store=createWriterCommands(workspace.database,workspace.workspaceInstance,randomUUID(),{dataRoot:root,control:{maintenance:async work=>work(),drain:async()=>{},beforeActivate:async()=>{},closeWorkspace:()=>{throw Error('not_requested');}}}),session=store.connect();
  const company=OpportunityResult.parse(await store.business(session,'opportunity',{operation:'company.create',commandId:randomUUID(),name:'上下文公司'}));if(company.kind!=='company')throw Error();
  const opportunity=OpportunityResult.parse(await store.business(session,'opportunity',{operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'独立证据'}));if(opportunity.kind!=='opportunity')throw Error();
  const round=InterviewResult.parse(await store.business(session,'interview',{operation:'interview.confirm',commandId:randomUUID(),opportunityId:opportunity.opportunity.id,expectedOpportunityRevision:1,title:'真实轮次',confirmationTime:{kind:'unknown'}}));if(round.kind!=='saved')throw Error();
  expect(await store.business(session,'interview',{operation:'interview.save-document',commandId:randomUUID(),id:round.id,expectedRevision:1,document:'transcript',text:'Independent selected B'})).toMatchObject({kind:'saved'});
  const source:SourceRef={owner:'interview',objectId:round.id,revision:1,locator:'transcript',scope:'opportunity',opportunityId:opportunity.opportunity.id};
  const x=WikiResult.parse(await store.business(session,'wiki',{operation:'create',commandId:randomUUID(),title:'Manual context X',body:'Only manual Wiki content; no Raw source',scope:'personal',nature:'observation',sources:[]}));if(x.kind!=='knowledge')throw Error();
  const task=AiResult.parse(await store.business(session,'ai',{operation:'ai.prepare',commandId:randomUUID(),sources:[source],target:{scope:'personal'},budget:{requests:1,inputBytes:100000,outputBytes:10000}}));if(task.kind!=='task')throw Error();
  const op=task.task.operations[0]!;expect(op.provenance.some(ref=>ref.owner==='wiki'&&ref.objectId===x.knowledge.id)).toBe(true);
  expect(await store.business(session,'ai',{operation:'ai.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest})).toMatchObject({kind:'task'});
  store.aiPrepareDispatch(op.id);store.aiSettle(op.id,{proposals:[{kind:'create',content:{title:'Adopted Y',body:'Independent Y retained after X purge',nature:'observation'},reason:'compare actual context',citations:[source.objectId],unknowns:[]}]});
  const generated=AiResult.parse(await store.business(session,'ai',{operation:'ai.read',taskId:task.task.id}));if(generated.kind!=='task')throw Error();
  expect(await store.business(session,'ai',{operation:'ai.decide',commandId:randomUUID(),proposalId:generated.task.proposals[0]!.id,action:'accept'})).toMatchObject({kind:'decided',state:'accepted'});
  const list=WikiResult.parse(await store.business(session,'wiki',{operation:'list'}));if(list.kind!=='list')throw Error();const y=list.items.find(item=>item.title==='Adopted Y')!;
  expect(y.trustedProvenance?.some(ref=>ref.owner==='wiki'&&ref.objectId===x.knowledge.id)).toBe(true);
  expect(y.reviewRequired).toBe(false);
  expect(await store.business(session,'wiki',{operation:'edit',commandId:randomUUID(),id:x.knowledge.id,expectedRevision:1,title:x.knowledge.title,body:'Ordinary context correction',scope:'personal',nature:'observation',sources:[],reason:'ordinary edit',change:'corrected',businessTime:{kind:'unknown'}})).toMatchObject({kind:'knowledge'});
  expect(await store.business(session,'wiki',{operation:'read',id:y.id})).toMatchObject({kind:'knowledge',knowledge:{reviewRequired:false}});
  const planned=DataResult.parse(await store.business(session,'application',{operation:'data.purge.plan',references:[{owner:'wiki',objectId:x.knowledge.id}]}));if(planned.kind!=='purge_plan')throw Error();
  expect(planned.plan.impact.independentReferences.some(ref=>ref.includes(y.id))).toBe(true);
  expect(await store.business(session,'application',{operation:'data.purge.confirm',planId:planned.plan.id,selectedCopyIds:planned.plan.copies.map(copy=>copy.id),confirmed:true})).toMatchObject({kind:'purged',scope:'selected_scope'});
  expect(await store.business(session,'wiki',{operation:'read',id:y.id})).toMatchObject({kind:'knowledge',knowledge:{body:y.body,reviewRequired:true}});
 }finally{workspace.close();await rm(root,{recursive:true,force:true});}
});

import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {openWorkspace} from '../../packages/backend/platform/database/database';
import {materialsMigration} from '../../packages/backend/domains/materials/migration';
import {releases} from '../../packages/backend/bootstrap/releases';
import {createWriterCommands} from '../../packages/backend/bootstrap/writer-commands';
import {Result as DataResult} from '../../packages/contracts/application/schema';
import {Result as WikiResult} from '../../packages/contracts/wiki/schema';
import {Result as ResearchResult} from '../../packages/contracts/opportunity/research/schema';
import {Result as InterviewResult} from '../../packages/contracts/opportunity/interview/schema';
import {Result as OpportunityResult} from '../../packages/contracts/opportunity/schema';

async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'career-g4-purge-plan-review-'));
 const workspace=await openWorkspace(root,materialsMigration,releases);
 const store=createWriterCommands(workspace.database,workspace.workspaceInstance,randomUUID());
 const session=store.connect();
 const company=OpportunityResult.parse(await store.business(session,'opportunity',{operation:'company.create',commandId:randomUUID(),name:'Review fixture company'}));
 if(company.kind!=='company')throw Error('company');
 const opportunity=OpportunityResult.parse(await store.business(session,'opportunity',{operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'Review fixture role'}));
 if(opportunity.kind!=='opportunity')throw Error('opportunity');
 const round=InterviewResult.parse(await store.business(session,'interview',{operation:'interview.confirm',commandId:randomUUID(),opportunityId:opportunity.opportunity.id,expectedOpportunityRevision:1,title:'Source A',confirmationTime:{kind:'unknown'}}));
 if(round.kind!=='saved')throw Error('round');
 const roundId=round.id;
 expect(await store.business(session,'interview',{operation:'interview.save-document',commandId:randomUUID(),id:round.id,expectedRevision:1,document:'transcript',text:'Sensitive source A'})).toMatchObject({kind:'saved'});
 const source={owner:'interview' as const,objectId:round.id,revision:1,locator:'transcript' as const,scope:'opportunity' as const,opportunityId:opportunity.opportunity.id};
 async function plan(){const result=DataResult.parse(await store.business(session,'application',{operation:'data.purge.plan',references:[{owner:'interview',objectId:roundId}]}));if(result.kind!=='purge_plan')throw Error(JSON.stringify(result));return result.plan;}
 const confirm=async(value:Awaited<ReturnType<typeof plan>>)=>DataResult.parse(await store.business(session,'application',{operation:'data.purge.confirm',planId:value.id,selectedCopyIds:value.copies.map(copy=>copy.id),confirmed:true}));
 const wiki=async(title:string,sources:unknown[])=>WikiResult.parse(await store.business(session,'wiki',{operation:'create',commandId:randomUUID(),title,body:'Independent human conclusion',scope:'personal',nature:'observation',sources}));
 return {store,session,source,roundId:round.id,owner:{kind:'opportunity' as const,id:opportunity.opportunity.id},plan,confirm,wiki,async close(){workspace.close();await rm(root,{recursive:true,force:true});}};
}

it.each(['wiki','research'] as const)('rejects the old real SQLite purge plan when a new independent %s source reference appears',async owner=>{
 const f=await fixture();try{
  const old=await f.plan();expect(old.impact.independentReferences).toEqual([]);
  let id:string;
  if(owner==='wiki'){const saved=await f.wiki('Retained Wiki',[{ref:f.source,purpose:'Original source A'}]);if(saved.kind!=='knowledge')throw Error(JSON.stringify(saved));id=saved.knowledge.id;}
  else{const saved=ResearchResult.parse(await f.store.business(f.session,'research',{operation:'create',commandId:randomUUID(),owner:f.owner,title:'Retained Research',body:'Independent human conclusion',nature:'inference',sources:[{ref:f.source,purpose:'Original source A',excerpt:'Sensitive source A',assessment:'supports'}],leads:[],userConfirmed:true,independentlyVerified:false}));if(saved.kind!=='item')throw Error(JSON.stringify(saved));id=saved.item.id;}
  expect(await f.confirm(old)).toEqual({kind:'failure',code:'purge_plan_changed'});
  expect(await f.store.business(f.session,'interview',{operation:'interview.read',id:f.roundId})).toMatchObject({kind:'session',session:{transcript:{text:'Sensitive source A'}}});
  const refreshed=await f.plan();expect(refreshed.impact.independentReferences).toEqual(expect.arrayContaining([expect.stringContaining(owner+'/'+id)]));
  expect(await f.confirm(refreshed)).toMatchObject({kind:'purged',scope:'selected_scope'});
  const retained=owner==='wiki'?await f.store.business(f.session,'wiki',{operation:'read',id}):await f.store.business(f.session,'research',{operation:'resolve',id,viewer:f.owner});
  expect(JSON.stringify(retained)).toContain('Independent human conclusion');
  if(owner==='research')expect(JSON.stringify(retained)).not.toContain('Sensitive source A');
 }finally{await f.close();}
});

it('rejects an old plan after an existing independent Wiki revision removes its source A relationship',async()=>{
 const f=await fixture();try{
  const saved=await f.wiki('Retained Wiki',[{ref:f.source,purpose:'Original source A'}]);if(saved.kind!=='knowledge')throw Error('wiki');
  const old=await f.plan();
  expect(await f.store.business(f.session,'wiki',{operation:'edit',commandId:randomUUID(),id:saved.knowledge.id,expectedRevision:1,title:saved.knowledge.title,body:saved.knowledge.body,scope:'personal',nature:'observation',sources:[],change:'corrected',reason:'Removed the source relationship',businessTime:{kind:'unknown'}})).toMatchObject({kind:'knowledge',knowledge:{revision:2}});
  expect(await f.confirm(old)).toEqual({kind:'failure',code:'purge_plan_changed'});
 }finally{await f.close();}
});

it('keeps an approved purge plan valid across an unrelated Wiki save instead of using a global content epoch',async()=>{
 const f=await fixture();try{
  const old=await f.plan();expect((await f.wiki('Unrelated manual Wiki',[])).kind).toBe('knowledge');
  expect(await f.confirm(old)).toMatchObject({kind:'purged',scope:'all_managed_copies'});
  const list=WikiResult.parse(await f.store.business(f.session,'wiki',{operation:'list'}));expect(list.kind==='list'&&list.items.some(item=>item.title==='Unrelated manual Wiki')).toBe(true);
 }finally{await f.close();}
});

it('does not invalidate a plan for a body-only revision that preserves the disclosed independent source relationship',async()=>{
 const f=await fixture();try{
  const saved=await f.wiki('Retained Wiki',[{ref:f.source,purpose:'Original source A'}]);if(saved.kind!=='knowledge')throw Error('wiki');
  const old=await f.plan();
  expect(await f.store.business(f.session,'wiki',{operation:'edit',commandId:randomUUID(),id:saved.knowledge.id,expectedRevision:1,title:saved.knowledge.title,body:'Revised independent human conclusion',scope:'personal',nature:'observation',sources:saved.knowledge.sources,change:'edited',reason:'Changed only my own conclusion',businessTime:{kind:'unknown'}})).toMatchObject({kind:'knowledge',knowledge:{revision:2}});
  expect(await f.confirm(old)).toMatchObject({kind:'purged',scope:'selected_scope'});
  expect(await f.store.business(f.session,'wiki',{operation:'read',id:saved.knowledge.id})).toMatchObject({kind:'knowledge',knowledge:{body:'Revised independent human conclusion',reviewRequired:true}});
 }finally{await f.close();}
});

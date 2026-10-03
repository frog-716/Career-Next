import {afterEach,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {openWorkspace} from '../../packages/backend/platform/database/database';
import {releases} from '../../packages/backend/bootstrap/releases';
import {materialsMigration} from '../../packages/backend/domains/materials/migration';
import {createMaterialsStore} from '../../packages/backend/domains/materials/store';
import {composeDomains} from '../../packages/backend/bootstrap/domain-registry';
import {composeAiPorts} from '../../packages/backend/bootstrap/ai-composition';
import {composeProductPorts} from '../../packages/backend/bootstrap/product-composition';
import {createPersistenceFence} from '../../packages/backend/platform/persistence/fence';
import {createAiRuntime} from '../../packages/backend/ai-runtime/public';
import {createDeterministicFakeProvider} from '../../packages/backend/platform/providers/deterministic-fake';
import {Result,type Manifest,type Task} from '../../packages/contracts/ai/schema';
import type {ProductTask} from '../../packages/contracts/ai/product';
import type {SourceRef} from '../../packages/contracts/common/source-ref';
const cleanups:(()=>void)[]=[];
afterEach(()=>{for(const close of cleanups.splice(0))close();});
async function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'career-g6-binding-')),workspace=await openWorkspace(root,materialsMigration,releases);
 cleanups.push(()=>{workspace.close();rmSync(root,{recursive:true,force:true});});
 const db=workspace.database,identity={workspaceInstance:workspace.workspaceInstance,backendGeneration:randomUUID()},materials=createMaterialsStore(db,identity.workspaceInstance,identity.backendGeneration);
 const domains=composeDomains(db,materials,{ai:{handle:()=>({kind:'failure',code:'not_registered'})},application:{handle:()=>({kind:'failure',code:'not_registered'})}});
 const fence=createPersistenceFence(db,identity),ports=composeAiPorts(domains,materials,root,identity,fence,()=>true);
 const company=domains.opportunity.handle({operation:'company.create',commandId:randomUUID(),name:'Isolated provider fixture'});if(company.kind!=='company')throw Error('company');
 const opportunity=domains.opportunity.handle({operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'Fixture role'});if(opportunity.kind!=='opportunity')throw Error('opportunity');
 const round=domains.interview.handle({operation:'interview.confirm',commandId:randomUUID(),opportunityId:opportunity.opportunity.id,expectedOpportunityRevision:1,title:'Fixture interview',confirmationTime:{kind:'unknown'}});if(round.kind!=='saved')throw Error(JSON.stringify(round));
 const saved=domains.interview.handle({operation:'interview.save-document',commandId:randomUUID(),id:round.id,expectedRevision:1,document:'transcript',text:'Isolated provenance source.'});expect(saved.kind).toBe('saved');
 const source:SourceRef={owner:'interview',objectId:round.id,revision:1,locator:'transcript',scope:'opportunity',opportunityId:opportunity.opportunity.id};
 let binding:Manifest['recipient']|undefined={...createDeterministicFakeProvider().recipient,generation:'trusted-generation-A'};
 // This is trusted owner configuration, never a generic UI/model request field.
 Object.assign(ports,{recipient:()=>{if(!binding)throw Error('provider_disabled');return binding;}});
 ports.product=composeProductPorts(domains,ports,root);const runtime=createAiRuntime(db,ports);
 const prepare=(kind:'wiki'|'product',extra:Record<string,unknown>={})=>runtime.handle(kind==='wiki'?{...{operation:'ai.prepare',commandId:randomUUID(),sources:[source],target:{scope:'personal'},budget:{requests:3,inputBytes:524288,outputBytes:196608}},...extra}:{...{operation:'product.prepare',commandId:randomUUID(),input:{target:{kind:'greeting',opportunityId:opportunity.opportunity.id,includeName:false},sources:[source],egressSourceIds:[source.objectId],wikiIds:[],egressWikiIds:[],objects:[]},budget:{requests:3,inputBytes:524288,outputBytes:196608}},...extra},'human');
 const task=(kind:'wiki'|'product'):Task|ProductTask=>{const result=Result.parse(prepare(kind));if(result.kind!=='task'&&result.kind!=='product_task')throw Error(JSON.stringify(result));return result.task;};
 const read=(kind:'wiki'|'product',id:string):Task|ProductTask=>{const result=runtime.handle({operation:kind==='wiki'?'ai.read':'product.read',taskId:id},'human');if(result.kind!=='task'&&result.kind!=='product_task')throw Error(JSON.stringify(result));return result.task;};
 const authorize=(kind:'wiki'|'product',value:Task|ProductTask)=>{const operation=value.operations[0]!;return runtime.handle({operation:kind==='wiki'?'ai.authorize':'product.authorize',commandId:randomUUID(),operationId:operation.id,manifestDigest:operation.manifestDigest},'human');};
 return {runtime,prepare,task,read,authorize,setBinding:(next:Manifest['recipient']|undefined)=>{binding=next;},binding:()=>binding};
}
describe.each(['wiki','product'] as const)('%s trusted provider binding',kind=>{
 it('freezes the current trusted generation into each fresh manifest',async()=>{
  const f=await fixture();expect(f.task(kind).operations[0]?.manifest?.recipient.generation).toBe('trusted-generation-A');
  f.setBinding({...f.binding()!,generation:'trusted-generation-B'});expect(f.task(kind).operations[0]?.manifest?.recipient.generation).toBe('trusted-generation-B');
 });
 it('refuses authorization of an old manifest after the trusted generation changes',async()=>{
  const f=await fixture(),task=f.task(kind);f.setBinding({...f.binding()!,generation:'trusted-generation-B'});
  expect(f.authorize(kind,task)).toEqual({kind:'failure',code:'provider_binding_changed'});
  expect(f.read(kind,task.id).operations[0]?.authorized).toBe(false);
 });
 it('checks the live binding again between authorization and handoff without consuming budget',async()=>{
  const f=await fixture(),task=f.task(kind);expect(f.authorize(kind,task).kind).toBe(kind==='wiki'?'task':'product_task');
  f.setBinding({...f.binding()!,generation:'trusted-generation-B'});
  expect(()=>f.runtime.prepareDispatch(task.operations[0]!.id)).toThrow('provider_binding_changed');
  expect(f.read(kind,task.id).usedRequests).toBe(0);expect(f.read(kind,task.id).operations[0]?.state).toBe('not_sent');
 });
 it('fails closed on disabled configuration for both fresh preparation and handoff',async()=>{
  const f=await fixture(),task=f.task(kind);expect(f.authorize(kind,task).kind).toBe(kind==='wiki'?'task':'product_task');
  f.setBinding(undefined);expect(f.prepare(kind)).toEqual({kind:'failure',code:'provider_disabled'});
  expect(()=>f.runtime.prepareDispatch(task.operations[0]!.id)).toThrow('provider_disabled');expect(f.read(kind,task.id).usedRequests).toBe(0);
 });

 it('can authorize and execute a fresh manifest with the trusted generation B fake adapter',async()=>{
  const f=await fixture();f.setBinding({...f.binding()!,generation:'trusted-generation-B'});const task=f.task(kind),op=task.operations[0]!;
  expect(f.authorize(kind,task).kind).toBe(kind==='wiki'?'task':'product_task');const intent=f.runtime.prepareDispatch(op.id);f.runtime.markProcessing(op.id);
  const adapter=createDeterministicFakeProvider('trusted-generation-B');expect(adapter.network).toBe('none');expect(adapter.recipient.generation).toBe('trusted-generation-B');
  const output=await adapter.send({operationId:op.id,manifest:intent.manifest,manifestDigest:intent.manifestDigest},new AbortController().signal);f.runtime.settle(op.id,output);
  expect(f.read(kind,task.id).operations[0]?.state).toBe('success');expect(f.read(kind,task.id).proposals.length).toBeGreaterThan(0);
 });
 it('rejects recipient changes carried by generic requests and leaves the trusted binding intact',async()=>{
  const f=await fixture();expect(f.prepare(kind,{recipient:{...f.binding()!,generation:'untrusted-model-generation'}})).toEqual({kind:'failure',code:'invalid_request'});
  expect(f.task(kind).operations[0]?.manifest?.recipient.generation).toBe('trusted-generation-A');
 });

});

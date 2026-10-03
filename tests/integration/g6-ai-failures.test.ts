import {afterEach,expect,it} from 'vitest';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';import {tmpdir} from 'node:os';
import {openWorkspace} from '../../packages/backend/platform/database/database';
import {releases} from '../../packages/backend/bootstrap/releases';
import {materialsMigration} from '../../packages/backend/domains/materials/migration';
import {createMaterialsStore} from '../../packages/backend/domains/materials/store';
import {composeDomains} from '../../packages/backend/bootstrap/domain-registry';
import {composeProductPorts} from '../../packages/backend/bootstrap/product-composition';
import {composeAiPorts} from '../../packages/backend/bootstrap/ai-composition';
import {createPersistenceFence} from '../../packages/backend/platform/persistence/fence';
import {createAiRuntime} from '../../packages/backend/ai-runtime/public';
import {createAiController,type AiWriterControllerPort} from '../../packages/backend/ai-runtime/controller';
import {createDeterministicFakeProvider} from '../../packages/backend/platform/providers/deterministic-fake';
import {Result as AiResult,type Task} from '../../packages/contracts/ai/schema';
import type {ProductTask} from '../../packages/contracts/ai/product';
import type {ProductTarget} from '../../packages/contracts/ai/product-context';
import type {SourceRef} from '../../packages/contracts/common/source-ref';
import type {BusinessModule} from '../../packages/contracts/common/bridge';
const cleanups:(()=>void)[]=[];
afterEach(()=>{for(const close of cleanups.splice(0))close();});
async function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'career-g6-ai-')),workspace=await openWorkspace(root,materialsMigration,releases);
 cleanups.push(()=>{workspace.close();rmSync(root,{recursive:true,force:true});});
 const db=workspace.database,identity={workspaceInstance:workspace.workspaceInstance,backendGeneration:randomUUID()},materials=createMaterialsStore(db,identity.workspaceInstance,identity.backendGeneration);
 const domains=composeDomains(db,materials,{ai:{handle:()=>({kind:'failure',code:'not_registered'})},application:{handle:()=>({kind:'failure',code:'not_registered'})}});
 const fence=createPersistenceFence(db,identity),ports=composeAiPorts(domains,materials,root,identity,fence,()=>true),fake=createDeterministicFakeProvider();ports.product=composeProductPorts(domains,ports,root);const runtime=createAiRuntime(db,ports);
 // Only registered public owner capabilities are used to create and observe fixtures.
 const call=(module:Exclude<BusinessModule,'ai'|'application'>,input:unknown)=>(domains[module] as {handle(input:unknown):unknown}).handle(input) as any;
 const company=call('opportunity',{operation:'company.create',commandId:randomUUID(),name:'G6 isolated fictional company'}).company;
 const opportunity=call('opportunity',{operation:'create',commandId:randomUUID(),companyId:company.id,role:'G6 role'}).opportunity;
 const round=call('interview',{operation:'interview.confirm',commandId:randomUUID(),opportunityId:opportunity.id,expectedOpportunityRevision:1,title:'G6 real-record fixture',confirmationTime:{kind:'unknown'}});
 expect(call('interview',{operation:'interview.save-document',commandId:randomUUID(),id:round.id,expectedRevision:1,document:'transcript',text:'Sensitive A: actual isolated fixture supplied to context.'}).kind).toBe('saved');
 const source:SourceRef={owner:'interview',objectId:round.id,revision:1,locator:'transcript',scope:'opportunity',opportunityId:opportunity.id};
 const read=(taskId:string)=>{const r=AiResult.parse(runtime.handle({operation:'ai.read',taskId},'human'));if(r.kind!=='task'&&r.kind!=='product_task')throw Error(JSON.stringify(r));return r.task;};
 const prepare=(target:ProductTarget,sources:SourceRef[]=[source],requests=3):ProductTask=>{const r=AiResult.parse(runtime.handle({operation:'product.prepare',commandId:randomUUID(),input:{target,sources,egressSourceIds:sources.map(s=>s.objectId),wikiIds:[],egressWikiIds:[],objects:[]},budget:{requests,inputBytes:524288,outputBytes:196608}},'human'));if(r.kind!=='product_task')throw Error(JSON.stringify(r));return r.task;};
 const authorize=(task:Task|ProductTask,index=task.operations.length-1)=>{const op=task.operations[index]!;expect(runtime.handle({operation:'product.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest},'human').kind).toBe('product_task');return op;};
 const generate=async(task:ProductTask)=>{const op=authorize(task),intent=runtime.prepareDispatch(op.id);runtime.markProcessing(op.id);runtime.settle(op.id,await fake.send({operationId:op.id,manifest:intent.manifest,manifestDigest:intent.manifestDigest},new AbortController().signal));return read(task.id) as ProductTask;};
 const writer:AiWriterControllerPort={prepareDispatch:async id=>runtime.prepareDispatch(id),markProcessing:async id=>runtime.markProcessing(id),settle:async(id,output)=>runtime.settle(id,output),markUnknown:async(id,why)=>runtime.markUnknown(id,why),failOperation:async(id,why)=>runtime.failOperation(id,why),cancelBeforeHandoff:async id=>runtime.cancelBeforeHandoff(id),stop:async(taskId,mode)=>{runtime.handle({operation:'ai.stop',commandId:randomUUID(),taskId,mode},'human');}};
 return {root,db,workspace,identity,domains,fence,ports,runtime,fake,company,opportunity,round,source,read,call,prepare,authorize,generate,writer};
}
it('F2 product unknown A permits exactly one explicitly prepared B awaiting its own authorization',async()=>{
 const f=await fixture(),task=f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false});const a=f.authorize(task);f.runtime.prepareDispatch(a.id);f.runtime.markProcessing(a.id);f.runtime.markUnknown(a.id);
 const retry=()=>f.runtime.handle({operation:'product.retry-explicit',commandId:randomUUID(),taskId:task.id,acknowledgeUnknown:true},'human');
 const b=retry();expect(b.kind).toBe('product_task');
 expect(retry()).toEqual({kind:'failure',code:'operation_pending'});
 expect(f.read(task.id).operations).toHaveLength(2);
});
it('F2 credential generation change after handoff rejects an ignoring-abort provider late body',async()=>{
 const f=await fixture(),task=f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false}),op=f.authorize(task);
 let respond!:(value:unknown)=>void;const adapter={...f.fake,recipient:{...f.fake.recipient},send:()=>new Promise<any>(resolve=>{respond=resolve;})};
 const controller=createAiController(f.writer,adapter);controller.openAfterAuthorization(task.id,op.id);const pending=controller.start(task.id,op.id);
 await expect.poll(()=>!!respond).toBe(true);adapter.recipient.generation='fake-v2';
 respond({proposals:[{kind:'create',content:{title:'old credential output',body:'G6-CREDENTIAL-LATE-BODY',nature:'hypothesis'},reason:'generation changed',citations:[],unknowns:[]}]});await pending;
 expect(f.read(task.id).proposals).toEqual([]);
 expect(f.read(task.id).operations[0]).toMatchObject({state:'outcome_unknown'});
});
it('F2 unknown A, explicit operation B and late A keep independent bodies and shared spent budget',async()=>{
 const f=await fixture(),task=f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false},[f.source],2),a=f.authorize(task),intentA=f.runtime.prepareDispatch(a.id);f.runtime.markProcessing(a.id);f.runtime.markUnknown(a.id);
 const retry=f.runtime.handle({operation:'product.retry-explicit',commandId:randomUUID(),taskId:task.id,acknowledgeUnknown:true},'human');if(retry.kind!=='product_task')throw Error(JSON.stringify(retry));const b=f.authorize(retry.task),intentB=f.runtime.prepareDispatch(b.id);f.runtime.markProcessing(b.id);
 const output=(body:string)=>({proposals:[{kind:'create',content:{title:body,body,nature:'hypothesis'},reason:'isolated controlled result',citations:[],unknowns:[]}]});
 f.runtime.settle(b.id,output('B current operation body'));f.runtime.settle(a.id,output('A late operation body'));
 const read=f.read(task.id) as ProductTask;expect(read.usedRequests).toBe(2);expect(read.proposals.map(p=>[p.operationId,p.change.kind==='create'&&p.change.content.body])).toEqual([[b.id,'B current operation body'],[a.id,'A late operation body']]);
 expect(f.call('communication',{operation:'communication.draft.read',opportunityId:f.opportunity.id}).draft.text).toBe('');
 expect(f.runtime.handle({operation:'product.retry-explicit',commandId:randomUUID(),taskId:task.id,acknowledgeUnknown:true},'human')).toMatchObject({kind:'failure'});
 expect(intentA.operationId).not.toBe(intentB.operationId);expect(read.proposals.every(p=>p.state==='pending')).toBe(true);
});
it.each(['stop','revoke','source-purge','source-pause','provider-disable','backend-shutdown'] as const)('F2 ignoring-abort late output after %s never starts another call or adopts content',async(cut)=>{
 const f=await fixture(),task=f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false}),op=f.authorize(task);
 let respond!:(value:unknown)=>void,sends=0;const controller=createAiController(f.writer,{...f.fake,send:()=>{sends++;return new Promise<any>(resolve=>{respond=resolve;});}});
 controller.openAfterAuthorization(task.id,op.id);const pending=controller.start(task.id,op.id);await expect.poll(()=>!!respond).toBe(true);
 if(cut==='stop'||cut==='revoke')await controller.stop(task.id,cut);
 if(cut==='source-pause')controller.pauseReferences([{owner:'interview',objectId:f.source.objectId}]);
 if(cut==='source-purge'){controller.revokeReferences([{owner:'interview',objectId:f.source.objectId}]);f.db.transaction(()=>{f.fence.markPurge([{owner:'interview',objectId:f.source.objectId}]);f.domains.interview.purge(f.source.objectId);f.runtime.purgeByReferences([f.source.objectId]);})();}
 if(cut==='provider-disable')controller.setProviderBinding(undefined);if(cut==='backend-shutdown')controller.shutdown();
 respond({proposals:[{kind:'create',content:{title:'late',body:'G6-LATE-ISOLATED-CONTENT',nature:'hypothesis'},reason:'held response',citations:[],unknowns:[]}]});await pending;
 const result=f.read(task.id);expect(sends).toBe(1);expect(f.call('communication',{operation:'communication.draft.read',opportunityId:f.opportunity.id}).draft.text).toBe('');
 if(cut==='stop'){expect(result.state).toBe('stopped');expect(result.proposals).toHaveLength(1);expect(result.proposals[0]?.state).toBe('pending');}
 else {expect(result.proposals).toEqual([]);expect(JSON.stringify(result)).not.toContain('G6-LATE-ISOLATED-CONTENT');}
});
it('F2 provider disable while SQLite intent is awaiting cannot hand off, and new generation cannot reuse the original grant',async()=>{
 const f=await fixture(),task=f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false}),op=f.authorize(task);let release!:()=>void;const sent:string[]=[];
 const writer={...f.writer,prepareDispatch:async(id:string)=>{const intent=await f.writer.prepareDispatch(id);await new Promise<void>(resolve=>{release=resolve;});return intent;}};
 const controller=createAiController(writer,{...f.fake,send:async request=>{sent.push(request.operationId);return {proposals:[]};}}),pending=controller.start(task.id,op.id);await expect.poll(()=>!!release).toBe(true);
 controller.setProviderBinding(undefined);release();await pending;expect(sent).toEqual([]);expect(f.read(task.id).usedRequests).toBe(0);
 controller.setProviderBinding({...f.fake.recipient,generation:'fake-v2'});controller.openAfterAuthorization(task.id,op.id);
 await expect(controller.start(task.id,op.id)).rejects.toThrow();expect(sent).toEqual([]);
});
const targetKinds=['resume','greeting','preparation','review','research','offer','promotion'] as const;
function targetFor(f:Awaited<ReturnType<typeof fixture>>,kind:typeof targetKinds[number]):ProductTarget{
 if(kind==='resume'){const opened=f.call('resume',{operation:'resume.open',commandId:randomUUID(),opportunityId:f.opportunity.id});return {kind:'resume-optimize',resumeId:opened.document.id,blockIds:[opened.document.content.sections[0].blocks[0].id],changeKinds:['rewrite']};}
 if(kind==='greeting')return {kind:'greeting',opportunityId:f.opportunity.id,includeName:false};
 if(kind==='preparation')return {kind:'interview-preparation',interviewId:f.round.id};
 if(kind==='review')return {kind:'interview-review',interviewId:f.round.id};
 if(kind==='research')return {kind:'research-organize',owner:{kind:'opportunity',id:f.opportunity.id}};
 if(kind==='promotion'){const created=f.call('research',{operation:'create',commandId:randomUUID(),owner:{kind:'opportunity',id:f.opportunity.id},title:'Promotion isolated item',body:'Approved content',nature:'unknown',sources:[],leads:[],userConfirmed:false,independentlyVerified:false});return {kind:'research-promotion',itemId:created.item.id,opportunityId:f.opportunity.id,companyId:f.company.id};}
 const unknown={kind:'unknown'},current=f.call('opportunity',{operation:'read',id:f.opportunity.id}).opportunity;
 f.call('offer',{operation:'offer.receive',commandId:randomUUID(),opportunityId:f.opportunity.id,expectedOpportunityRevision:current.revision,businessTime:{kind:'unknown'},reason:'isolated verbal fixture',conditions:{role:unknown,location:unknown,guaranteedCash:unknown,variableIncome:unknown,equity:unknown,oneTime:unknown,paymentCycle:unknown,other:unknown},original:{kind:'never_existed',explanation:'verbal fixture'}});
 return {kind:'offer-assist',opportunityId:f.opportunity.id};
}
it.each(targetKinds)('RV-P0-01 %s output rejects source R1→R2 in final Apply without target/state/receipt partial commit',async(kind)=>{
 const f=await fixture(),target=targetFor(f,kind),task=await f.generate(f.prepare(target));expect(task.proposals.length).toBeGreaterThan(0);
 const before={resume:f.call('resume',{operation:'resume.list'}),wiki:f.call('wiki',{operation:'list'}),research:f.call('research',{operation:'read',owner:{kind:'opportunity',id:f.opportunity.id}}),companyResearch:f.call('research',{operation:'read',owner:{kind:'company',id:f.company.id}}),communication:f.call('communication',{operation:'communication.draft.read',opportunityId:f.opportunity.id}),offer:f.call('offer',{operation:'offer.read',opportunityId:f.opportunity.id})};
 expect(f.call('interview',{operation:'interview.save-document',commandId:randomUUID(),id:f.round.id,expectedRevision:2,document:'transcript',text:'R2 corrects the actual supporting evidence.'}).kind).toBe('saved');
 const commandId=randomUUID(),ids=kind==='research'?task.proposals.map(p=>p.id):[task.proposals[0]!.id],result=f.runtime.handle({operation:'product.decide',commandId,proposalIds:ids,action:'accept'},'human');
 expect(result).toMatchObject({kind:'product_conflict',code:'stale'});expect(f.runtime.handle({operation:'product.receipt',commandId},'human')).toEqual({kind:'receipt_missing'});expect(f.read(task.id).proposals.every(p=>p.state==='pending')).toBe(true);
 expect({resume:f.call('resume',{operation:'resume.list'}),wiki:f.call('wiki',{operation:'list'}),research:f.call('research',{operation:'read',owner:{kind:'opportunity',id:f.opportunity.id}}),companyResearch:f.call('research',{operation:'read',owner:{kind:'company',id:f.company.id}}),communication:f.call('communication',{operation:'communication.draft.read',opportunityId:f.opportunity.id}),offer:f.call('offer',{operation:'offer.read',opportunityId:f.opportunity.id})}).toEqual(before);
});
it('F2 AI/Proposal storage reaches actual SQLITE_FULL quota and never reports success or partially stores proposals',async()=>{
 const f=await fixture(),task=f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false}),op=f.authorize(task);f.runtime.prepareDispatch(op.id);f.runtime.markProcessing(op.id);
 const pages=f.db.pragma('page_count',{simple:true}) as number;f.db.pragma('max_page_count='+pages);
 let storageError:unknown;try{f.runtime.settle(op.id,{proposals:[{kind:'create',content:{title:'quota',body:'G6-QUOTA-CONTENT '.repeat(3500),nature:'hypothesis'},reason:'controlled SQLite page cap',citations:[],unknowns:[]}]});}catch(error){storageError=error;}
 f.db.pragma('max_page_count=1073741823');const result=f.read(task.id);expect(result.proposals).toEqual([]);expect(result.operations[0]?.state).not.toBe('success');
 expect(storageError).toBeUndefined();expect(result.operations[0]?.reason).toBe('storage_full');expect(f.call('communication',{operation:'communication.draft.read',opportunityId:f.opportunity.id}).draft.text).toBe('');
});
it('F2 derived summary/cache provenance rechecks current egress of omitted sensitive A at dispatch',async()=>{
 const f=await fixture(),knowledge=f.call('wiki',{operation:'create',commandId:randomUUID(),title:'Derived context summary',body:'Summary that actually consumed A',scope:'personal',nature:'hypothesis',sources:[{ref:f.source,purpose:'actual A input'}]}).knowledge;
 const response=f.runtime.handle({operation:'product.prepare',commandId:randomUUID(),input:{target:{kind:'greeting',opportunityId:f.opportunity.id,includeName:false},sources:[],egressSourceIds:[],wikiIds:[knowledge.id],egressWikiIds:[knowledge.id],objects:[]},budget:{requests:1,inputBytes:524288,outputBytes:196608}},'human');if(response.kind!=='product_task')throw Error(JSON.stringify(response));
 const op=f.authorize(response.task);expect(op.provenance.some(p=>p.objectId===f.source.objectId)).toBe(true);
 // The source owner still returns actual SQLite metadata; its permission policy now withdraws A egress.
 const current=f.ports.sources.provenanceCurrent;f.ports.sources.provenanceCurrent=p=>{const value=current(p);return value&&p.objectId===f.source.objectId?{...value,egress:false}:value;};
 expect(()=>f.runtime.prepareDispatch(op.id)).toThrow('egress_forbidden');expect(f.read(response.task.id).usedRequests).toBe(0);
});
it('RV-P0-01 one Research conflict rolls selected group back while another owner group remains applicable',async()=>{
 const f=await fixture(),owner={kind:'opportunity',id:f.opportunity.id} as const,task=await f.generate(f.prepare({kind:'research-organize',owner})),companyTask=await f.generate(f.prepare({kind:'research-organize',owner:{kind:'company',id:f.company.id}},[]));
 const conflict=task.proposals[1]!;if(conflict.change.kind!=='create')throw Error('create required');
 expect(f.call('research',{operation:'create',commandId:randomUUID(),owner,title:conflict.change.content.title,body:'Manual competing item',nature:'unknown',sources:[],leads:[],userConfirmed:false,independentlyVerified:false}).kind).toBe('item');
 const commandId=randomUUID();expect(f.runtime.handle({operation:'product.decide',commandId,proposalIds:task.proposals.map(p=>p.id),action:'accept'},'human')).toMatchObject({kind:'product_conflict',code:'conflict',proposalIds:[conflict.id]});
 expect(f.call('research',{operation:'read',owner}).items).toHaveLength(1);expect(f.read(task.id).proposals.every(p=>p.state==='pending')).toBe(true);expect(f.runtime.handle({operation:'product.receipt',commandId},'human')).toEqual({kind:'receipt_missing'});
 expect(f.runtime.handle({operation:'product.decide',commandId:randomUUID(),proposalIds:companyTask.proposals.map(p=>p.id),action:'accept'},'human')).toMatchObject({kind:'product_decided',state:'accepted'});expect(f.call('research',{operation:'read',owner:{kind:'company',id:f.company.id}}).items).toHaveLength(2);
});
it.each(['same-block','unrelated-block'] as const)('RV-P1-03 second-window %s changes are resolved by actual fine-grained Apply and stale full-document autosave cannot overwrite',async(mode)=>{
 const f=await fixture(),target=targetFor(f,'resume');if(target.kind!=='resume-optimize')throw Error();const initial=f.call('resume',{operation:'resume.read',resumeId:target.resumeId}),old=structuredClone(initial.document.content);
 const generated=await f.generate(f.prepare(target)),proposal=generated.proposals[0]!,second=structuredClone(old),block=second.sections[mode==='same-block'?0:1].blocks[0];block.spans=[{text:'Window B independent actual edit',marks:[{type:'bold'}]}];
 const saved=f.call('resume',{operation:'resume.save',commandId:randomUUID(),resumeId:target.resumeId,expectedRevision:initial.document.revision,expectedProfileRevision:0,content:second});expect(saved.status).toBe('document');
 const result=f.runtime.handle({operation:'product.decide',commandId:randomUUID(),proposalIds:[proposal.id],action:'accept'},'human');
 if(mode==='same-block'){expect(result).toMatchObject({kind:'product_conflict',code:'conflict'});expect(f.read(generated.id).proposals[0]?.state).toBe('pending');}
 else {expect(result).toMatchObject({kind:'product_decided',state:'accepted'});if(result.kind!=='product_decided'||!result.resumeApplication)throw Error('missing authorized application pair');expect(result.resumeApplication.before.content.sections[1].blocks[0]).toEqual(block);expect(result.resumeApplication.after.content.sections[1].blocks[0]).toEqual(block);}
 const current=f.call('resume',{operation:'resume.read',resumeId:target.resumeId});expect(current.document.content.sections[mode==='same-block'?0:1].blocks[0]).toEqual(block);
 expect(f.call('resume',{operation:'resume.save',commandId:randomUUID(),resumeId:target.resumeId,expectedRevision:initial.document.revision,expectedProfileRevision:0,content:old})).toMatchObject({status:'conflict'});
 expect(f.call('resume',{operation:'resume.read',resumeId:target.resumeId})).toEqual(current);
});
it('F2 unregistered model subtask/manual/authorization/self-accept requests cannot mint another budget or factual action',async()=>{
 const f=await fixture(),task=await f.generate(f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false})),proposal=task.proposals[0]!;
 for(const input of [{operation:'product.decide',commandId:randomUUID(),proposalIds:[proposal.id],action:'accept'}, {operation:'product.prepare',commandId:randomUUID(),input:task.input,budget:task.budget},{operation:'product.authorize',commandId:randomUUID(),operationId:task.operations[0]!.id,manifestDigest:task.operations[0]!.manifestDigest},{operation:'ai.subtask',parentTaskId:task.id,userApproved:true,actor:'human'}]){
  expect(f.runtime.handle(input,'ai')).toMatchObject({kind:'failure'});expect(f.runtime.handle({...input,actor:'human',userApproved:true},'ai')).toMatchObject({kind:'failure'});
 }
 expect(f.read(task.id).usedRequests).toBe(1);expect(f.read(task.id).proposals[0]?.state).toBe('pending');expect(f.call('communication',{operation:'communication.draft.read',opportunityId:f.opportunity.id}).draft.text).toBe('');
});
it('RV-P1-04 actual A+B with citation only B survives two adopted summaries and cached read/receipt revocation',async()=>{
 const f=await fixture(),bRound=f.call('interview',{operation:'interview.confirm',commandId:randomUUID(),opportunityId:f.opportunity.id,expectedOpportunityRevision:2,title:'Public B round',confirmationTime:{kind:'unknown'}});f.call('interview',{operation:'interview.save-document',commandId:randomUUID(),id:bRound.id,expectedRevision:1,document:'transcript',text:'Public B statement'});
 const b:SourceRef={owner:'interview',objectId:bRound.id,revision:1,locator:'transcript',scope:'opportunity',opportunityId:f.opportunity.id};
 const original=f.call('wiki',{operation:'create',commandId:randomUUID(),title:'Original actual A summary',body:'Actual A context',scope:'personal',nature:'observation',sources:[{ref:f.source,purpose:'actual protected A'}]}).knowledge;
 const run=(title:string)=>{const commandId=randomUUID(),prepared=f.runtime.handle({operation:'ai.prepare',commandId,sources:[b],target:{scope:'personal'},budget:{requests:1,inputBytes:524288,outputBytes:196608}},'human');if(prepared.kind!=='task')throw Error(JSON.stringify(prepared));const op=prepared.task.operations[0]!;expect(op.provenance.some(p=>p.objectId===f.source.objectId)).toBe(true);expect(f.runtime.handle({operation:'ai.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest},'human').kind).toBe('task');f.runtime.prepareDispatch(op.id);f.runtime.settle(op.id,{proposals:[{kind:'create',content:{title,body:title+' isolated derived text',nature:'observation'},reason:'only evidence citation B, trusted context contains A',citations:[b.objectId],unknowns:[]}]});const task=f.read(prepared.task.id) as Task,proposal=task.proposals[0]!;expect(proposal.provenance.some(p=>p.objectId===f.source.objectId)).toBe(true);expect(proposal.change.citations).toEqual([b.objectId]);expect(f.runtime.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:proposal.id,action:'accept'},'human')).toMatchObject({kind:'decided',state:'accepted'});return {taskId:task.id,commandId};};
 run('First adopted summary');f.call('wiki',{operation:'edit',commandId:randomUUID(),id:original.id,expectedRevision:1,title:original.title,body:'Independent corrected record without source links',scope:'personal',nature:'observation',sources:[],reason:'test removes redundant direct citation A path',businessTime:{kind:'unknown'},change:'edited'});
 const last=run('Summary of summary');const items=f.call('wiki',{operation:'list'}).items;expect(items.find((item:any)=>item.title==='Summary of summary').trustedProvenance.some((p:any)=>p.objectId===f.source.objectId)).toBe(true);expect(f.domains.wiki.referencing({owner:'interview',objectId:f.source.objectId}).length).toBeGreaterThanOrEqual(2);
 const prior=f.ports.sources.provenanceCurrent;f.ports.sources.provenanceCurrent=p=>{const current=prior(p);return current&&p.objectId===f.source.objectId?{...current,read:false,egress:false}:current;};
 expect(JSON.stringify(f.runtime.handle({operation:'ai.read',taskId:last.taskId},'human'))).not.toContain('Summary of summary isolated derived text');expect(JSON.stringify(f.runtime.handle({operation:'ai.receipt',commandId:last.commandId},'human'))).not.toContain('Sensitive A:');
 expect(f.runtime.handle({operation:'ai.prepare',commandId:randomUUID(),sources:[b],target:{scope:'personal'},budget:{requests:1,inputBytes:524288,outputBytes:196608}},'human')).toMatchObject({kind:'failure'});
});
it('F2 source read revocation after handoff discards actual returned output, including prepared cache and receipts',async()=>{
 const f=await fixture(),task=f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false}),op=f.authorize(task);f.runtime.prepareDispatch(op.id);f.runtime.markProcessing(op.id);
 const previous=f.ports.sources.provenanceCurrent;f.ports.sources.provenanceCurrent=p=>{const value=previous(p);return value&&p.objectId===f.source.objectId?{...value,read:false,egress:false}:value;};
 f.runtime.settle(op.id,{proposals:[{kind:'create',content:{title:'revoked source late output',body:'G6-READ-REVOKED-DERIVED-BODY',nature:'hypothesis'},reason:'late controlled response',citations:[],unknowns:[]}]});
 const result=f.read(task.id);expect(result.proposals).toEqual([]);expect(result.operations[0]).toMatchObject({state:'failure',reason:'source_unavailable'});expect(JSON.stringify(result)).not.toContain('G6-READ-REVOKED-DERIVED-BODY');expect(result.operations[0]?.manifest).toBeUndefined();
});
it('F2 actual SQLite close/reopen changes backend generation, keeps unknown budget and never resurrects grants or late old producer bodies',async()=>{
 const f=await fixture(),task=f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false}),op=f.authorize(task);f.runtime.prepareDispatch(op.id);f.runtime.markProcessing(op.id);f.workspace.close();cleanups.pop();
 const reopened=await openWorkspace(f.root,materialsMigration,releases);cleanups.push(()=>{reopened.close();rmSync(f.root,{recursive:true,force:true});});
 expect(reopened.workspaceInstance).toBe(f.identity.workspaceInstance);const identity={workspaceInstance:reopened.workspaceInstance,backendGeneration:randomUUID()},materials=createMaterialsStore(reopened.database,identity.workspaceInstance,identity.backendGeneration),domains=composeDomains(reopened.database,materials,{ai:{handle:()=>undefined},application:{handle:()=>undefined}}),fence=createPersistenceFence(reopened.database,identity),ports=composeAiPorts(domains,materials,f.root,identity,fence,()=>true);ports.product=composeProductPorts(domains,ports,f.root);const runtime=createAiRuntime(reopened.database,ports);
 expect(identity.backendGeneration).not.toBe(f.identity.backendGeneration);expect(runtime.handle({operation:'product.read',taskId:task.id},'human')).toMatchObject({kind:'product_task',task:{usedRequests:1,proposals:[],operations:[{id:op.id,state:'outcome_unknown',authorized:false,reason:'restart_handoff_unconfirmed'}]}});
 expect(()=>runtime.prepareDispatch(op.id)).toThrow('authorization_required');
 runtime.settle(op.id,{proposals:[{kind:'create',content:{title:'old backend producer',body:'G6-OLD-BACKEND-OUTPUT',nature:'hypothesis'},reason:'late after restart',citations:[],unknowns:[]}]});
 const result=runtime.handle({operation:'product.read',taskId:task.id},'human');expect(result).toMatchObject({kind:'product_task',task:{usedRequests:1,proposals:[],operations:[{state:'failure'}]}});expect(JSON.stringify(result)).not.toContain('G6-OLD-BACKEND-OUTPUT');
});
it('F2 unknown operation spends the last root request; explicit retry and resume cannot reset exhausted budget',async()=>{
 const f=await fixture(),task=f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false},[f.source],1),op=f.authorize(task);f.runtime.prepareDispatch(op.id);f.runtime.markProcessing(op.id);f.runtime.markUnknown(op.id);
 expect(f.runtime.handle({operation:'product.retry-explicit',commandId:randomUUID(),taskId:task.id,acknowledgeUnknown:true},'human')).toEqual({kind:'failure',code:'budget_exhausted'});expect(f.read(task.id)).toMatchObject({usedRequests:1,operations:[{id:op.id,state:'outcome_unknown'}]});
 f.runtime.handle({operation:'product.stop',commandId:randomUUID(),taskId:task.id,mode:'stop'},'human');expect(f.runtime.handle({operation:'product.resume',commandId:randomUUID(),taskId:task.id,acknowledgeStopped:true},'human')).toEqual({kind:'failure',code:'budget_exhausted'});expect(f.read(task.id).operations).toHaveLength(1);
});
it('RV-P0-01 Wiki output rejects actual Transcript R1→R2 at final Apply without owner, state or receipt partial commit',async()=>{
 const f=await fixture(),prepared=f.runtime.handle({operation:'ai.prepare',commandId:randomUUID(),sources:[f.source],target:{scope:'personal'},budget:{requests:1,inputBytes:524288,outputBytes:196608}},'human');if(prepared.kind!=='task')throw Error(JSON.stringify(prepared));const op=prepared.task.operations[0]!;f.runtime.handle({operation:'ai.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest},'human');const intent=f.runtime.prepareDispatch(op.id);f.runtime.settle(op.id,await f.fake.send({operationId:op.id,manifest:intent.manifest,manifestDigest:intent.manifestDigest},new AbortController().signal));const generated=f.read(prepared.task.id) as Task,proposal=generated.proposals[0]!,before=f.call('wiki',{operation:'list'});
 f.call('interview',{operation:'interview.save-document',commandId:randomUUID(),id:f.round.id,expectedRevision:2,document:'transcript',text:'R2 explicitly corrects evidence after proposal preview'});const commandId=randomUUID();expect(f.runtime.handle({operation:'ai.decide',commandId,proposalId:proposal.id,action:'accept'},'human')).toMatchObject({kind:'failure',code:'stale'});expect(f.call('wiki',{operation:'list'})).toEqual(before);expect(f.read(prepared.task.id).proposals[0]?.state).toBe('pending');expect(f.runtime.handle({operation:'ai.receipt',commandId},'human')).toEqual({kind:'receipt_missing'});
});
it('RV-P0-01 Simulation return rejects corrected selected Transcript R1→R2 without manufacturing personal fact',async()=>{
 const f=await fixture(),simulation=f.call('interview',{operation:'interview.create-simulation',commandId:randomUUID(),opportunityId:f.opportunity.id,realRoundId:f.round.id,title:'Controlled practice'});const text='I built an actual parser project.';f.call('interview',{operation:'interview.save-document',commandId:randomUUID(),id:simulation.id,expectedRevision:1,document:'transcript',text});
 const task=await f.generate(f.prepare({kind:'simulation-return',simulationId:simulation.id,transcriptVersion:1,wikiTarget:{scope:'personal'},selectionStart:0,selectionEnd:text.length,confirmedRealMeaning:true,meaning:'This chosen first-person project is my actual experience.'},[])),before=f.call('wiki',{operation:'list'});expect(task.proposals).toHaveLength(1);f.call('interview',{operation:'interview.save-document',commandId:randomUUID(),id:simulation.id,expectedRevision:2,document:'transcript',text:'I correct the selected statement; it described roleplay only.'});const commandId=randomUUID();expect(f.runtime.handle({operation:'product.decide',commandId,proposalIds:[task.proposals[0]!.id],action:'accept'},'human')).toMatchObject({kind:'product_conflict',code:'stale'});expect(f.call('wiki',{operation:'list'})).toEqual(before);expect(f.read(task.id).proposals[0]?.state).toBe('pending');expect(f.runtime.handle({operation:'product.receipt',commandId},'human')).toEqual({kind:'receipt_missing'});
});
it('F2 egress revocation after handoff closes actual-input followup and discards an ignoring-abort provider late body',async()=>{
 const f=await fixture(),task=f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false}),op=f.authorize(task);let respond!:(value:unknown)=>void,sends=0;const controller=createAiController(f.writer,{...f.fake,send:()=>{sends++;return new Promise<any>(resolve=>{respond=resolve;});}});controller.openAfterAuthorization(task.id,op.id);const pending=controller.start(task.id,op.id);await expect.poll(()=>!!respond).toBe(true);
 const previous=f.ports.sources.provenanceCurrent;f.ports.sources.provenanceCurrent=p=>{const value=previous(p);return value&&p.objectId===f.source.objectId?{...value,egress:false}:value;};controller.pauseReferences([{owner:'interview',objectId:f.source.objectId}]);respond({proposals:[{kind:'create',content:{title:'late revoked egress',body:'G6-EGRESS-REVOKED-LATE-BODY',nature:'hypothesis'},reason:'controlled egress revocation',citations:[],unknowns:[]}]});await pending;expect(sends).toBe(1);expect(f.read(task.id).proposals).toEqual([]);expect(JSON.stringify(f.read(task.id))).not.toContain('G6-EGRESS-REVOKED-LATE-BODY');expect(f.read(task.id).usedRequests).toBe(1);
});
for(const failure of ['actual-SQLITE_BUSY','writer-SQLITE_FULL'] as const)for(const mode of ['stop','revoke'] as const)it(`F2 ${mode} live gate survives ${failure} stop persistence failure before ignoring-abort late output`,async()=>{
 const f=await fixture(),task=f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false}),op=f.authorize(task),commandId=randomUUID();let respond!:(value:unknown)=>void,persistenceResult:unknown;const locker=new Database(path.join(f.root,'career.sqlite'));f.db.pragma('busy_timeout=0');
 const writer:AiWriterControllerPort={...f.writer,stop:async(taskId,requestedMode,originalId)=>{if(failure==='writer-SQLITE_FULL')throw Object.assign(Error('storage_full'),{code:'SQLITE_FULL'});persistenceResult=f.runtime.handle({operation:'ai.stop',commandId:originalId!,taskId,mode:requestedMode},'human');if((persistenceResult as {kind:string}).kind==='failure')throw Error('stop_persistence_failed');}};
 const controller=createAiController(writer,{...f.fake,send:()=>new Promise<any>(resolve=>{respond=resolve;})});controller.openAfterAuthorization(task.id,op.id);const pending=controller.start(task.id,op.id);await expect.poll(()=>!!respond).toBe(true);await expect.poll(()=>f.read(task.id).operations[0]?.state).toBe('processing');
 try{if(failure==='actual-SQLITE_BUSY')locker.exec('BEGIN IMMEDIATE');await expect(controller.stop(task.id,mode,commandId)).rejects.toThrow(failure==='writer-SQLITE_FULL'?'storage_full':'stop_persistence_failed');expect(controller.isClosed(task.id)).toBe(true);if(failure==='actual-SQLITE_BUSY'){expect(persistenceResult).toMatchObject({kind:'failure'});locker.exec('ROLLBACK');}expect(f.read(task.id).state).toBe('running');expect(f.runtime.handle({operation:'product.receipt',commandId},'human')).toEqual({kind:'receipt_missing'});
  respond({proposals:[{kind:'create',content:{title:'late failed control record',body:'G6-REVOKE-PERSISTENCE-FAILED-LATE-BODY',nature:'hypothesis'},reason:'provider intentionally ignores AbortSignal',citations:[],unknowns:[]}]});await pending;const current=f.read(task.id);expect(current.usedRequests).toBe(1);expect(f.call('communication',{operation:'communication.draft.read',opportunityId:f.opportunity.id}).draft.text).toBe('');
  if(mode==='stop'){expect(current.proposals).toHaveLength(1);expect(current.proposals[0]?.state).toBe('pending');}
  else {expect(current.proposals).toEqual([]);expect(JSON.stringify(current)).not.toContain('G6-REVOKE-PERSISTENCE-FAILED-LATE-BODY');controller.openAfterAuthorization(task.id,'new-after-failed-revoke');expect(controller.isClosed(task.id)).toBe(true);await expect(controller.start(task.id,'new-after-failed-revoke')).rejects.toThrow('task_closed');}
 }finally{if(locker.inTransaction)locker.exec('ROLLBACK');locker.close();}
});
it.each(['source','egress'] as const)('F2 %s reference live revoke remains closed with no persistent permission change, even after another authorization',async(restriction)=>{
 const f=await fixture(),task=f.prepare({kind:'greeting',opportunityId:f.opportunity.id,includeName:false}),op=f.authorize(task);let respond!:(value:unknown)=>void;const controller=createAiController(f.writer,{...f.fake,send:()=>new Promise<any>(resolve=>{respond=resolve;})});controller.openAfterAuthorization(task.id,op.id);const pending=controller.start(task.id,op.id);await expect.poll(()=>!!respond).toBe(true);
 // Control-side source/egress revocation must work before a failed or queued writer changes authority metadata.
 controller.revokeReferences([{owner:'interview',objectId:f.source.objectId}]);expect(f.ports.sources.provenanceCurrent(op.provenance.find(p=>p.objectId===f.source.objectId)!)).toMatchObject({read:true,egress:true});controller.openAfterAuthorization(task.id,'other-operation');respond({proposals:[{kind:'create',content:{title:restriction+' revoked',body:'G6-REFERENCE-LIVE-REVOKED-LATE-BODY',nature:'hypothesis'},reason:'unchanged persistent permissions',citations:[],unknowns:[]}]});await pending;expect(f.read(task.id).proposals).toEqual([]);expect(JSON.stringify(f.read(task.id))).not.toContain('G6-REFERENCE-LIVE-REVOKED-LATE-BODY');expect(f.read(task.id).usedRequests).toBe(1);
});

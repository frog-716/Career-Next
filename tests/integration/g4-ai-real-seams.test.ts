import {validateCandidateRelations} from '../../packages/backend/bootstrap/candidate-validation';
import {afterEach,expect,it} from 'vitest';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {openWorkspace} from '../../packages/backend/platform/database/database';
import {releases} from '../../packages/backend/bootstrap/releases';
import {materialsMigration} from '../../packages/backend/domains/materials/migration';
import {createMaterialsStore} from '../../packages/backend/domains/materials/store';
import {composeDomains} from '../../packages/backend/bootstrap/domain-registry';
import {composeAiPorts} from '../../packages/backend/bootstrap/ai-composition';
import {createPersistenceFence} from '../../packages/backend/platform/persistence/fence';
import {createAiRuntime,validateAiCandidate,sanitizeAiCandidate,candidateRelations} from '../../packages/backend/ai-runtime/public';
import {createAiController,type AiWriterControllerPort} from '../../packages/backend/ai-runtime/controller';
import type {DispatchIntent} from '../../packages/backend/ai-runtime/ports';
import type {SourceRef} from '../../packages/contracts/common/source-ref';
import type {Task,ProviderOutput} from '../../packages/contracts/ai/schema';
const resources:{close():void;root:string}[]=[];
afterEach(()=>{for(const item of resources.splice(0)){item.close();rmSync(item.root,{recursive:true,force:true});}});
async function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'career-g4-ai-real-')),workspace=await openWorkspace(root,materialsMigration,releases);resources.push({root,close:workspace.close});
 const db=workspace.database,identity={workspaceInstance:workspace.workspaceInstance,backendGeneration:randomUUID()},materials=createMaterialsStore(db,identity.workspaceInstance,identity.backendGeneration);
 const domains=composeDomains(db,materials,{ai:{handle:()=>({kind:'failure',code:'not_registered'})},application:{handle:()=>({kind:'failure',code:'not_registered'})}});
 const fence=createPersistenceFence(db,identity),ports=composeAiPorts(domains,materials,root,identity,fence,()=>true),runtime=createAiRuntime(db,ports);
 const company=domains.opportunity.handle({operation:'company.create',commandId:randomUUID(),name:'G4真实接口公司'});if(company.kind!=='company')throw Error();
 const opportunity=domains.opportunity.handle({operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'完整接缝'});if(opportunity.kind!=='opportunity')throw Error();
 const opportunityId=opportunity.opportunity.id;
 function transcript(body:string,expectedOpportunityRevision:number){const saved=domains.interview.handle({operation:'interview.confirm',commandId:randomUUID(),opportunityId,expectedOpportunityRevision,title:'真实轮次',confirmationTime:{kind:'unknown'}});if(saved.kind!=='saved')throw Error(JSON.stringify(saved));expect(domains.interview.handle({operation:'interview.save-document',commandId:randomUUID(),id:saved.id,expectedRevision:1,document:'transcript',text:body}).kind).toBe('saved');return {owner:'interview' as const,objectId:saved.id,revision:1,locator:'transcript' as const,scope:'opportunity' as const,opportunityId};}
 const source=transcript('独立负责整个项目。',1);
 function add(title:string,body:string,sources:SourceRef[]=[]){const saved=domains.wiki.handle({operation:'create',commandId:randomUUID(),title,body,scope:'personal',nature:'observation',sources:sources.map(ref=>({ref,purpose:'原始支持来源'}))});if(saved.kind!=='knowledge')throw Error(JSON.stringify(saved));return saved.knowledge;}
 function prepare(sources:SourceRef[]=[source]){const saved=runtime.handle({operation:'ai.prepare',commandId:randomUUID(),sources,target:{scope:'personal'},budget:{requests:2,inputBytes:100000,outputBytes:10000}},'human');if(saved.kind!=='task')throw Error(JSON.stringify(saved));return saved.task;}
 function generate(task:Task,output:ProviderOutput){const operation=task.operations[0]!;expect(runtime.handle({operation:'ai.authorize',commandId:randomUUID(),operationId:operation.id,manifestDigest:operation.manifestDigest},'human').kind).toBe('task');runtime.prepareDispatch(operation.id);runtime.settle(operation.id,output);const saved=runtime.handle({operation:'ai.read',taskId:task.id},'human');if(saved.kind!=='task')throw Error(JSON.stringify(saved));return saved.task;}
 return {root,db,identity,materials,domains,fence,ports,runtime,source,opportunity,transcript,add,prepare,generate};
}
it('actual Transcript owner R1 -> R2 causes final Apply to reject all Wiki / AI writes and receipts',async()=>{
 const f=await fixture(),a=f.add('知识A','旧认识'),task=f.prepare();
 const generated=f.generate(task,{proposals:[{kind:'edit',itemId:a.id,content:{title:'知识A',body:'根据R1生成的待审内容',nature:'observation'},reason:'明确依赖实际文字稿R1',citations:[f.source.objectId],unknowns:[]}]});const proposal=generated.proposals[0]!;
 expect(f.domains.interview.handle({operation:'interview.save-document',commandId:randomUUID(),id:f.source.objectId,expectedRevision:2,document:'transcript',text:'更正：仅参与部分工作。'}).kind).toBe('saved');
 const commandId=randomUUID();expect(f.runtime.handle({operation:'ai.decide',commandId,proposalId:proposal.id,action:'accept'},'human')).toEqual({kind:'failure',code:'stale'});
 expect(f.domains.wiki.read(a.id)).toMatchObject({body:'旧认识',revision:1});expect(f.domains.wiki.handle({operation:'receipt',commandId})).toEqual({kind:'receipt_missing'});expect(f.runtime.handle({operation:'ai.receipt',commandId},'human')).toEqual({kind:'receipt_missing'});
 const remaining=f.runtime.handle({operation:'ai.read',taskId:task.id},'human');expect(remaining.kind==='task'&&remaining.task.proposals[0]).toMatchObject({state:'pending',validity:'stale'});
});
it('a synchronous purge pause closes a held real writer response before the marker and drain while unrelated B still completes',async()=>{
 const f=await fixture(),b=f.transcript('独立B正文',2),taskA=f.prepare(),taskB=f.prepare([b]),operationA=taskA.operations[0]!,operationB=taskB.operations[0]!;const sent:string[]=[];let release!:(value:DispatchIntent)=>void,held!:DispatchIntent;
 for(const op of [operationA,operationB])expect(f.runtime.handle({operation:'ai.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest},'human').kind).toBe('task');
 const writer:AiWriterControllerPort={prepareDispatch:async id=>{const intent=f.runtime.prepareDispatch(id);if(id!==operationA.id)return intent;held=intent;return new Promise(resolve=>{release=resolve;});},markProcessing:async id=>{f.runtime.markProcessing(id);},settle:async(id,output)=>{f.runtime.settle(id,output);},markUnknown:async(id,reason)=>{f.runtime.markUnknown(id,reason);},failOperation:async(id,reason)=>{f.runtime.failOperation(id,reason);},cancelBeforeHandoff:async id=>{f.runtime.cancelBeforeHandoff(id);},stop:async()=>{}};
 const controller=createAiController(writer,{recipient:operationA.recipient,network:'none',send:async request=>{sent.push(request.operationId);return {proposals:[]};}});controller.openAfterAuthorization(taskA.id,operationA.id);controller.openAfterAuthorization(taskB.id,operationB.id);
 const pending=controller.start(taskA.id,operationA.id);controller.pauseReferences([{owner:'interview',objectId:f.source.objectId}]);
 // The real SQLite marker can now race the already-computed writer response without opening transport admission.
 f.db.transaction(()=>f.fence.markPurge([{owner:'interview',objectId:f.source.objectId}]))();await controller.start(taskB.id,operationB.id);release(held);await pending;expect(sent).toEqual([operationB.id]);
 expect(f.runtime.handle({operation:'ai.read',taskId:taskA.id},'human')).toMatchObject({kind:'task',task:{state:'stopped',usedRequests:0,operations:[{id:operationA.id,state:'not_sent',reason:'closed_before_handoff'}],proposals:[]}});expect(f.runtime.handle({operation:'ai.read',taskId:taskB.id},'human')).toMatchObject({kind:'task',task:{state:'completed',usedRequests:1,operations:[{id:operationB.id,state:'success'}]}});
 controller.revokeReferences([{owner:'interview',objectId:f.source.objectId}]);f.db.transaction(()=>{f.domains.interview.purge(f.source.objectId);f.runtime.purgeByReferences([f.source.objectId]);})();expect(f.runtime.handle({operation:'ai.read',taskId:taskA.id},'human')).toMatchObject({kind:'task',task:{state:'purged',proposals:[]}});expect(f.runtime.handle({operation:'ai.read',taskId:taskB.id},'human')).toMatchObject({kind:'task',task:{state:'completed'}});
});
it('candidate validation accepts valid pending/accepted/stale/purged history and rejects bad JSON, row links and lost actual provenance',async()=>{
 const f=await fixture(),a=f.add('候选检查','旧内容'),task=f.prepare();const generated=f.generate(task,{proposals:[{kind:'edit',itemId:a.id,content:{title:'候选检查',body:'合法待审正文',nature:'observation'},reason:'候选恢复必须能复核闭合历史',citations:[f.source.objectId],unknowns:[]}]});
 expect(candidateRelations(f.db)).toEqual(expect.arrayContaining([expect.objectContaining({role:'before',owner:'wiki',objectId:a.id,revision:1}),expect.objectContaining({role:'change_target',owner:'wiki',objectId:a.id}),expect.objectContaining({role:'dependency',source:f.source}),expect.objectContaining({role:'actual_provenance',operationId:task.operations[0]!.id,proposalId:generated.proposals[0]!.id})]));expect(JSON.stringify(candidateRelations(f.db))).not.toContain('合法待审正文');
 expect(()=>validateAiCandidate(f.db)).not.toThrow();const good=f.db.serialize();
 const openCandidate=()=>{const file=path.join(f.root,`candidate-${randomUUID()}.sqlite`);writeFileSync(file,good);return new Database(file);};
 const invalid=(mutate:(candidate:Database.Database)=>void)=>{const candidate=openCandidate();try{candidate.pragma('foreign_keys=OFF');mutate(candidate);expect(()=>validateAiCandidate(candidate)).toThrow('backup_ai_invalid');}finally{candidate.close();}};
 invalid(candidate=>candidate.prepare('UPDATE ai_tasks SET data_json=? WHERE id=?').run('{',task.id));
 invalid(candidate=>candidate.prepare('UPDATE ai_operations SET task_id=? WHERE id=?').run(randomUUID(),task.operations[0]!.id));
 invalid(candidate=>{const proposal=structuredClone(generated.proposals[0]!);proposal.provenance=[];candidate.prepare('UPDATE ai_proposals SET data_json=? WHERE id=?').run(JSON.stringify(proposal),proposal.id);});
 invalid(candidate=>{const proposal=structuredClone(generated.proposals[0]!);proposal.dependencies=[];candidate.prepare('UPDATE ai_proposals SET data_json=? WHERE id=?').run(JSON.stringify(proposal),proposal.id);});
 const candidate=openCandidate();try{sanitizeAiCandidate(candidate);expect(()=>validateAiCandidate(candidate)).not.toThrow();}finally{candidate.close();}
 const proposal=generated.proposals[0]!;expect(f.runtime.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:proposal.id,action:'accept'},'human').kind).toBe('decided');expect(()=>validateAiCandidate(f.db)).not.toThrow();
 const stale=f.prepare();f.generate(stale,{proposals:[{kind:'create',content:{title:'后来陈述','body':'R1旧建议',nature:'hypothesis'},reason:'当前来源变了但历史记录合法',citations:[f.source.objectId],unknowns:[]}]});
 f.domains.interview.handle({operation:'interview.save-document',commandId:randomUUID(),id:f.source.objectId,expectedRevision:2,document:'transcript',text:'参与部分工作'});expect(()=>validateAiCandidate(f.db)).not.toThrow();
 f.db.transaction(()=>{f.fence.markPurge([{owner:'interview',objectId:f.source.objectId}]);f.domains.interview.purge(f.source.objectId);f.runtime.purgeByReferences([f.source.objectId]);})();expect(()=>validateAiCandidate(f.db)).not.toThrow();
});
it('AI restore relation metadata exposes nonexistent closed sources and Project targets without bodies, and accepts legitimate source purge history',async()=>{
 const f=await fixture(),task=f.prepare();const snapshot=f.db.serialize(),openCandidate=()=>{const file=path.join(f.root,`ai-relations-${randomUUID()}.sqlite`);writeFileSync(file,snapshot);return new Database(file);};
 // Cross-owner checks consume the public projection against real full-migration owner capabilities.
 const validateRelations=validateCandidateRelations;
 expect(()=>validateRelations(f.db)).not.toThrow();expect(JSON.stringify(candidateRelations(f.db))).not.toContain('独立负责整个项目');expect(candidateRelations(f.db)).toEqual(expect.arrayContaining([expect.objectContaining({role:'task_source',source:f.source}),expect.objectContaining({role:'actual_provenance',source:f.source,provenance:expect.objectContaining({scopeId:f.opportunity.opportunity.id})})]));
 const noOperation=openCandidate();try{noOperation.prepare('DELETE FROM ai_operations').run();expect(()=>validateAiCandidate(noOperation)).toThrow('backup_ai_invalid');}finally{noOperation.close();}
 const missingSource=openCandidate();try{const id=randomUUID(),row=missingSource.prepare('SELECT data_json FROM ai_tasks WHERE id=?').get(task.id) as {data_json:string},badTask=JSON.parse(row.data_json),badOp=structuredClone(task.operations[0]!);badTask.sources[0].objectId=id;badOp.provenance[0]!.objectId=id;delete badOp.manifest;missingSource.prepare('UPDATE ai_tasks SET data_json=? WHERE id=?').run(JSON.stringify(badTask),task.id);missingSource.prepare('UPDATE ai_operations SET data_json=? WHERE id=?').run(JSON.stringify(badOp),badOp.id);expect(()=>validateAiCandidate(missingSource)).not.toThrow();expect(()=>validateRelations(missingSource)).toThrow('backup_relation_invalid');}finally{missingSource.close();}
 const missingProject=openCandidate();try{const row=missingProject.prepare('SELECT data_json FROM ai_tasks WHERE id=?').get(task.id) as {data_json:string},badTask=JSON.parse(row.data_json),badOp=structuredClone(task.operations[0]!);badTask.target={scope:'project',scopeId:randomUUID()};delete badOp.manifest;missingProject.prepare('UPDATE ai_tasks SET data_json=? WHERE id=?').run(JSON.stringify(badTask),task.id);missingProject.prepare('UPDATE ai_operations SET data_json=? WHERE id=?').run(JSON.stringify(badOp),badOp.id);expect(()=>validateAiCandidate(missingProject)).not.toThrow();expect(()=>validateRelations(missingProject)).toThrow('backup_relation_invalid');}finally{missingProject.close();}
 f.db.transaction(()=>{f.fence.markPurge([{owner:'interview',objectId:f.source.objectId}]);f.domains.interview.purge(f.source.objectId);f.runtime.purgeByReferences([f.source.objectId]);})();expect(()=>validateRelations(f.db)).not.toThrow();expect(candidateRelations(f.db)).toEqual([]);
});
it('explicit retry does not create another unbounded preview while the previous new request is awaiting authorization',async()=>{
 const f=await fixture(),task=f.prepare(),op=task.operations[0]!;f.runtime.handle({operation:'ai.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest},'human');f.runtime.prepareDispatch(op.id);f.runtime.markUnknown(op.id);
 const retry=()=>f.runtime.handle({operation:'ai.retry-explicit',commandId:randomUUID(),taskId:task.id,acknowledgeUnknown:true},'human');expect(retry().kind).toBe('task');expect(retry()).toEqual({kind:'failure',code:'operation_pending'});
});
it('actual independent Task B keeps its identity and pending result when unknown Task A returns late without human Apply',async()=>{
 const f=await fixture(),a=f.prepare(),opA=a.operations[0]!;f.runtime.handle({operation:'ai.authorize',commandId:randomUUID(),operationId:opA.id,manifestDigest:opA.manifestDigest},'human');f.runtime.prepareDispatch(opA.id);f.runtime.markProcessing(opA.id);f.runtime.markUnknown(opA.id);
 const b=f.prepare(),resultB=f.generate(b,{proposals:[{kind:'create',content:{title:'独立TaskB','body':'B的独立待审结果',nature:'observation'},reason:'新任务有独立授权和预算',citations:[f.source.objectId],unknowns:[]}]});
 f.runtime.settle(opA.id,{proposals:[{kind:'create',content:{title:'迟到TaskA',body:'A的旧请求迟到结果',nature:'hypothesis'},reason:'A仍属于旧任务',citations:[f.source.objectId],unknowns:[]}]});
 const lateA=f.runtime.handle({operation:'ai.read',taskId:a.id},'human'),unchangedB=f.runtime.handle({operation:'ai.read',taskId:b.id},'human');expect(lateA).toMatchObject({kind:'task',task:{id:a.id,usedRequests:1,proposals:[{taskId:a.id,operationId:opA.id,state:'pending'}]}});expect(unchangedB).toMatchObject({kind:'task',task:{id:b.id,usedRequests:1,proposals:[{id:resultB.proposals[0]!.id,taskId:b.id,operationId:b.operations[0]!.id,state:'pending'}]}});
 expect(f.domains.wiki.handle({operation:'list'})).toMatchObject({kind:'list',items:[]});expect(f.runtime.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:resultB.proposals[0]!.id,action:'accept'},'ai')).toEqual({kind:'failure',code:'human_required'});expect(()=>validateAiCandidate(f.db)).not.toThrow();
});
it('real SQLite reopening preserves pending proposals for new human Apply but does not restore old execution permission',async()=>{
 const f=await fixture(),a=f.add('持久当前认识','保存前正文'),task=f.prepare();
 const generated=f.generate(task,{proposals:[{kind:'edit',itemId:a.id,content:{title:'持久当前认识',body:'用户重新进入后明确采用',nature:'observation'},reason:'从持久R1读取提案',citations:[f.source.objectId],unknowns:[]}]});
 const waiting=f.prepare();const authorize={operation:'ai.authorize' as const,commandId:randomUUID(),operationId:waiting.operations[0]!.id,manifestDigest:waiting.operations[0]!.manifestDigest};expect(f.runtime.handle(authorize,'human').kind).toBe('task');
 const entry=resources.find(item=>item.root===f.root)!;entry.close();const workspace=await openWorkspace(f.root,materialsMigration,releases);entry.close=workspace.close;
 const identity={workspaceInstance:workspace.workspaceInstance,backendGeneration:randomUUID()},materials=createMaterialsStore(workspace.database,identity.workspaceInstance,identity.backendGeneration),domains=composeDomains(workspace.database,materials,{ai:{handle:()=>undefined},application:{handle:()=>undefined}}),fence=createPersistenceFence(workspace.database,identity),ports=composeAiPorts(domains,materials,f.root,identity,fence,()=>true),recovered=createAiRuntime(workspace.database,ports);
 expect(()=>recovered.prepareDispatch(waiting.operations[0]!.id)).toThrow('authorization_required');expect(recovered.handle(authorize,'human').kind).toBe('task');expect(()=>recovered.prepareDispatch(waiting.operations[0]!.id)).toThrow('authorization_required');
 const pending=recovered.handle({operation:'ai.read',taskId:task.id},'human');expect(pending).toMatchObject({kind:'task',task:{contentAvailability:'available',proposals:[{id:generated.proposals[0]!.id,state:'pending',validity:'current'}]}});
 expect(recovered.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:generated.proposals[0]!.id,action:'accept'},'human')).toMatchObject({kind:'decided',state:'accepted'});expect(domains.wiki.read(a.id)).toMatchObject({body:'用户重新进入后明确采用',revision:2,verification:'not_verified'});
});
it('actual Context A survives missing citation and flows into adopted Wiki authority and the purge impact projection',async()=>{
 const f=await fixture(),a=f.source,b=f.transcript('公开B的有限过程记录',2);f.add('上下文Y','从真实A产生的认识',[a]);
 const task=f.prepare([b]);expect(task.operations[0]!.provenance.some(ref=>ref.objectId===a.objectId)).toBe(true);
 const generated=f.generate(task,{proposals:[{kind:'create',content:{title:'混合输入的整理Z',body:'已阅读A和B后的整理',nature:'observation'},reason:'模型解释只引用B，权限来源仍包含实际A',citations:[b.objectId],unknowns:[]}]});const proposal=generated.proposals[0]!;
 expect(proposal.change.citations).toEqual([b.objectId]);expect(proposal.provenance.some(ref=>ref.objectId===a.objectId)).toBe(true);
 expect(f.runtime.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:proposal.id,action:'accept'},'human')).toMatchObject({kind:'decided',state:'accepted'});
 const list=f.domains.wiki.handle({operation:'list'});if(list.kind!=='list')throw Error();const adopted=list.items.find(item=>item.title==='混合输入的整理Z');expect(adopted?.trustedProvenance?.some(ref=>ref.owner==='interview'&&ref.objectId===a.objectId)).toBe(true);expect(adopted?.verification).toBe('not_verified');
 expect(f.domains.wiki.referencing({owner:'interview',objectId:a.objectId}).map(item=>item.id)).toContain(adopted!.id);
});
it('adopted actual A authority reconstructs its public Transcript locator after restart even when only B remains in citation links',async()=>{
 const f=await fixture(),a=f.source,b=f.transcript('实际B的补充文字稿',2),y=f.add('最初上下文Y','来自A的用户认识',[a]);
 const initial=f.generate(f.prepare([b]),{proposals:[{kind:'create',content:{title:'持久来源链Z',body:'实际消费了A与B',nature:'observation'},reason:'解释引用只写B',citations:[b.objectId],unknowns:[]}]});
 expect(f.runtime.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:initial.proposals[0]!.id,action:'accept'},'human').kind).toBe('decided');
 expect(f.domains.wiki.handle({operation:'edit',commandId:randomUUID(),id:y.id,expectedRevision:1,title:y.title,body:'用户改为无来源的新独立认识',scope:'personal',nature:'observation',sources:[],reason:'移除最初直接A支持链接',businessTime:{kind:'unknown'},change:'edited'}).kind).toBe('knowledge');
 const entry=resources.find(item=>item.root===f.root)!;entry.close();const workspace=await openWorkspace(f.root,materialsMigration,releases);entry.close=workspace.close;
 const identity={workspaceInstance:workspace.workspaceInstance,backendGeneration:randomUUID()},materials=createMaterialsStore(workspace.database,identity.workspaceInstance,identity.backendGeneration),domains=composeDomains(workspace.database,materials,{ai:{handle:()=>undefined},application:{handle:()=>undefined}}),fence=createPersistenceFence(workspace.database,identity),ports=composeAiPorts(domains,materials,f.root,identity,fence,()=>true),runtime=createAiRuntime(workspace.database,ports);
 const listed=domains.wiki.handle({operation:'list'});if(listed.kind!=='list')throw Error();const z=listed.items.find(item=>item.title==='持久来源链Z')!;
 expect(z.sources.map(link=>link.ref.objectId)).toEqual([b.objectId]);const inherited=z.trustedProvenance!.find(ref=>ref.objectId===a.objectId)!;expect(inherited).toMatchObject({owner:'interview',revision:1,scopeId:f.opportunity.opportunity.id});
 // No source/task/Wiki snapshot has primed this new composition's in-memory locator cache for A.
 expect(ports.sources.provenanceCurrent(inherited)).toMatchObject({revision:1,read:true,egress:true});
 const prepared=runtime.handle({operation:'ai.prepare',commandId:randomUUID(),sources:[b],target:{scope:'personal'},budget:{requests:1,inputBytes:100000,outputBytes:10000}},'human');if(prepared.kind!=='task')throw Error(JSON.stringify(prepared));const op=prepared.task.operations[0]!;
 expect(op.provenance.some(ref=>ref.objectId===a.objectId&&ref.scopeId===inherited.scopeId)).toBe(true);expect(runtime.handle({operation:'ai.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest},'human').kind).toBe('task');runtime.prepareDispatch(op.id);
 runtime.settle(op.id,{proposals:[{kind:'create',content:{title:'再次整理Z2',body:'继承实际A来源的二次建议',nature:'hypothesis'},reason:'模型仍只说明B',citations:[b.objectId],unknowns:[]}]});const generated=runtime.handle({operation:'ai.read',taskId:prepared.task.id},'human');if(generated.kind!=='task')throw Error();expect(generated.task.proposals).toHaveLength(1);
 expect(domains.interview.handle({operation:'interview.save-document',commandId:randomUUID(),id:a.objectId,expectedRevision:2,document:'transcript',text:'更正A原始事实'}).kind).toBe('saved');
 expect(runtime.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:generated.task.proposals[0]!.id,action:'accept'},'human')).toEqual({kind:'failure',code:'stale'});expect(domains.wiki.handle({operation:'list'})).toMatchObject({kind:'list',items:expect.not.arrayContaining([expect.objectContaining({title:'再次整理Z2'})])});
});
it('a real persistence marker rejects late output, and owner purge plus runtime purge leaves only body-free state',async()=>{
 const f=await fixture(),task=f.prepare(),operation=task.operations[0]!;expect(f.runtime.handle({operation:'ai.authorize',commandId:randomUUID(),operationId:operation.id,manifestDigest:operation.manifestDigest},'human').kind).toBe('task');f.runtime.prepareDispatch(operation.id);f.runtime.markProcessing(operation.id);
 f.db.transaction(()=>f.fence.markPurge([{owner:'interview',objectId:f.source.objectId}]))();
 f.runtime.settle(operation.id,{proposals:[{kind:'create',content:{title:'迟到正文',body:'不得恢复已经清除的独立负责陈述',nature:'fact_statement'},reason:'迟到结果',citations:[f.source.objectId],unknowns:[]}]});
 const failed=f.runtime.handle({operation:'ai.read',taskId:task.id},'human');expect(failed).toMatchObject({kind:'task',task:{proposals:[],operations:[{state:'failure',reason:'body_discarded'}]}});expect(f.domains.wiki.handle({operation:'list'})).toMatchObject({kind:'list',items:[]});
 f.db.transaction(()=>{f.domains.interview.purge(f.source.objectId);f.runtime.purgeByReferences([f.source.objectId]);})();
 expect(JSON.stringify(f.runtime.handle({operation:'ai.read',taskId:task.id},'human'))).not.toContain('独立负责');expect(f.runtime.handle({operation:'ai.read',taskId:task.id},'human')).toMatchObject({kind:'task',task:{state:'purged',proposals:[]}});
});
it('an unrelated real Wiki Y edit leaves A valid through actual public owner ports and the same SQLite transaction',async()=>{
 const f=await fixture(),a=f.add('知识A','原始A'),y=f.add('知识Y','原始Y'),task=f.prepare();const generated=f.generate(task,{proposals:[{kind:'edit',itemId:a.id,content:{title:'知识A',body:'A的合理改写',nature:'observation'},reason:'此修改依赖A与选中文字稿，不依赖Y正文',citations:[f.source.objectId],unknowns:[]}]});
 expect(f.domains.wiki.handle({operation:'edit',commandId:randomUUID(),id:y.id,expectedRevision:1,title:'知识Y',body:'用户另改了Y',scope:'personal',nature:'observation',sources:[],reason:'无关条目人工修改',businessTime:{kind:'unknown'},change:'edited'}).kind).toBe('knowledge');
 const proposal=generated.proposals[0]!,commandId=randomUUID();expect(f.runtime.handle({operation:'ai.decide',commandId,proposalId:proposal.id,action:'accept'},'human')).toMatchObject({kind:'decided',state:'accepted'});expect(f.domains.wiki.read(a.id)).toMatchObject({revision:2,body:'A的合理改写',origin:'ai_accepted',verification:'not_verified'});expect(f.domains.wiki.read(y.id)).toMatchObject({revision:2,body:'用户另改了Y'});expect(f.runtime.handle({operation:'ai.receipt',commandId},'human')).toMatchObject({kind:'receipt',receipt:{kind:'decided',state:'accepted'}});
});

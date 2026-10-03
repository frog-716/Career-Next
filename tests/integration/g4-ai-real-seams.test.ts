import {afterEach,expect,it} from 'vitest';
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
import {createPersistenceFence} from '../../packages/backend/platform/persistence/fence';
import {createAiRuntime} from '../../packages/backend/ai-runtime/public';
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

import {afterEach,expect,it} from 'vitest';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {createAiRuntime} from '../../packages/backend/ai-runtime/public';
import {aiMigration} from '../../packages/backend/ai-runtime/migration';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';
import {createWikiDomain} from '../../packages/backend/domains/wiki/public';
import {wikiMigration} from '../../packages/backend/domains/wiki/migration';
import type {AiPorts,SourceSnapshot,WikiSnapshot} from '../../packages/backend/ai-runtime/ports';
import type {Manifest,Task} from '../../packages/contracts/ai/schema';
import {createOpportunityDomain} from '../../packages/backend/domains/opportunity/public';
import {opportunityMigration} from '../../packages/backend/domains/opportunity/migration';
import {createInterviewDomain} from '../../packages/backend/domains/opportunity/interview/public';
import {interviewMigration} from '../../packages/backend/domains/opportunity/interview/migration';
import {createAiController} from '../../packages/backend/ai-runtime/controller';
import {createDeterministicFakeProvider} from '../../packages/backend/platform/providers/deterministic-fake';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
const databases:Database.Database[]=[];
afterEach(()=>{for(const db of databases.splice(0))db.close();});
function setup(){
 const db=new Database(':memory:');databases.push(db);db.pragma('foreign_keys=ON');db.exec(commandMigration+wikiMigration+aiMigration);
 const snapshots=new Map<string,SourceSnapshot>();
 for(const [name,body] of [['敏感A','我的私密薪资是100'],['公开B','我完成了稳定的交付流程']]){const ref={owner:'materials' as const,objectId:randomUUID(),revision:1 as const,locator:'whole' as const,scope:'personal' as const};snapshots.set(ref.objectId,{ref,body,nature:name,restrictions:{read:true,egress:true},provenance:[{owner:ref.owner,objectId:ref.objectId,revision:1,scope:ref.scope,kind:'user_record',restrictions:{read:true,egress:true}}]});}
 const wiki=createWikiDomain(db,{resolveSource:ref=>{const found=snapshots.get(ref.objectId);return found?{id:ref.objectId,scope:ref.scope,revision:ref.revision,source:ref}:undefined;}});
 let allowed=true,purged=false,failWrite=false;
 const ports:AiPorts={identity:{workspaceInstance:randomUUID(),backendGeneration:randomUUID()},humanAllowed:()=>allowed,
 sources:{read:ref=>snapshots.get(ref.objectId),current:ref=>snapshots.get(ref.objectId),provenanceCurrent:input=>{if(input.owner==='wiki'){const result=wiki.handle({operation:'read',id:input.objectId});return result.kind==='knowledge'?{revision:result.knowledge.revision,read:true,egress:true}:undefined;}const source=snapshots.get(input.objectId);return source?{revision:source.provenance[0]!.revision,...source.restrictions}:undefined;}},
 fence:{capture:input=>({id:randomUUID(),producerId:input.producerId,workspaceInstance:'fixture',backendGeneration:'fixture',inputs:input.inputs.map(ref=>({...ref,generation:0})),targets:input.targets.map(ref=>({...ref,generation:0}))}),assert:()=>{if(purged)throw Error('purged');},revoke:()=>{}},
 wiki:{validateTarget:()=>true,list:()=>{const result=wiki.handle({operation:'list'});return result.kind==='list'?result.items:[];},read:id=>{const result=wiki.handle({operation:'read',id});return result.kind==='knowledge'?result.knowledge:undefined;},apply:input=>{if(failWrite)throw Error('storage_failed');const common={commandId:input.commandId,...input.target,sources:input.sources.map(ref=>({ref,purpose:input.change.reason}))};const result=input.change.kind==='create'?wiki.handle({...common,operation:'create',...(input.edited??input.change.content)}):input.change.kind==='edit'?wiki.handle({...common,operation:'edit',id:input.change.itemId,expectedRevision:input.before?.revision,...(input.edited??input.change.content),reason:input.change.reason,businessTime:{kind:'unknown'},change:'edited'}):wiki.handle({operation:'lifecycle',commandId:input.commandId,id:input.change.itemId,expectedRevision:input.before?.revision,action:'retire',reason:input.change.reason,businessTime:{kind:'unknown'},correction:false});if(result.kind==='failure')throw Error(result.code);}},
 };
 const runtime=createAiRuntime(db,ports);
 const prepare=()=>{const result=runtime.handle({operation:'ai.prepare',commandId:randomUUID(),sources:[...snapshots.values()].map(item=>item.ref),target:{scope:'personal'},budget:{requests:2,inputBytes:20000,outputBytes:10000}},'human');if(result.kind!=='task')throw Error(JSON.stringify(result));return result.task;};
 const authorize=(task:Task)=>{const op=task.operations.at(-1)!;return runtime.handle({operation:'ai.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest},'human');};
 const read=(id:string)=>{const result=runtime.handle({operation:'ai.read',taskId:id},'human');if(result.kind!=='task')throw Error(JSON.stringify(result));return result.task;};
 const response=(manifest:Manifest)=>({proposals:[{kind:'create',content:{title:'稳定交付',body:'独立完成交付流程。',nature:'observation'},reason:'根据明确选定的资料',citations:[manifest.materials[1]!.ref.objectId],unknowns:['尚未独立核验']}]});
 return {db,ports,runtime,prepare,authorize,read,response,wiki,snapshots,setAllowed:(value:boolean)=>{allowed=value;},setPurged:()=>{purged=true;},setFailWrite:()=>{failWrite=true;}};
}
it('Wiki first task previews exact context then requires human authorization and one atomic human acceptance',()=>{
 const f=setup(),task=f.prepare(),operation=task.operations[0]!;
 expect(operation.state).toBe('not_sent');expect(operation.manifest?.materials.map(item=>item.body)).toEqual(['我的私密薪资是100','我完成了稳定的交付流程']);
 expect(()=>f.runtime.prepareDispatch(operation.id)).toThrow('authorization_required');
 expect(f.runtime.handle({operation:'ai.authorize',commandId:randomUUID(),operationId:operation.id,manifestDigest:operation.manifestDigest},'ai')).toEqual({kind:'failure',code:'human_required'});
 expect(f.authorize(task).kind).toBe('task');const intent=f.runtime.prepareDispatch(operation.id);f.runtime.markProcessing(operation.id);f.runtime.settle(operation.id,f.response(intent.manifest));
 const proposal=f.read(task.id).proposals[0]!;
 expect(proposal.provenance.map(item=>item.objectId)).toEqual([...f.snapshots.keys()]);expect(proposal.change.citations).toEqual([intent.manifest.materials[1]!.ref.objectId]);
 expect(f.wiki.handle({operation:'list'})).toEqual({kind:'list',items:[]});
 const accept={operation:'ai.decide',commandId:randomUUID(),proposalId:proposal.id,action:'accept'};
 expect(f.runtime.handle(accept,'ai')).toEqual({kind:'failure',code:'human_required'});
 expect(f.runtime.handle(accept,'human').kind).toBe('decided');expect(f.runtime.handle(accept,'human').kind).toBe('decided');
 const list=f.wiki.handle({operation:'list'});expect(list.kind==='list'?list.items.length:0).toBe(1);expect(f.read(task.id).proposals[0]?.state).toBe('accepted');
});
it('source permission revocation also closes cached preview/proposal/receipt bodies, not just next send',()=>{
 const f=setup(),prepareCommand=randomUUID();const result=f.runtime.handle({operation:'ai.prepare',commandId:prepareCommand,sources:[...f.snapshots.values()].map(item=>item.ref),target:{scope:'personal'},budget:{requests:1,inputBytes:20000,outputBytes:10000}},'human');if(result.kind!=='task')throw Error();const task=result.task;f.authorize(task);const intent=f.runtime.prepareDispatch(task.operations[0]!.id);f.runtime.settle(intent.operationId,f.response(intent.manifest));
 const source=[...f.snapshots.values()][0]!;source.restrictions.read=false;source.provenance[0]!.restrictions.read=false;
 expect(JSON.stringify(f.runtime.handle({operation:'ai.read',taskId:task.id},'human'))).not.toContain('独立完成交付流程');expect(JSON.stringify(f.runtime.handle({operation:'ai.receipt',commandId:prepareCommand},'human'))).not.toContain('我的私密薪资');
});
it('real browser/Contract/Runtime/SQLite/fake Provider shows exact preview and preserves edited proposal on failed Apply',async()=>{
 const f=setup(),root=mkdtempSync(path.resolve('tests/.g4-ai-ui-'));
 const controller=createAiController({prepareDispatch:async id=>f.runtime.prepareDispatch(id),markProcessing:async id=>f.runtime.markProcessing(id),settle:async(id,output)=>f.runtime.settle(id,output),markUnknown:async(id,reason)=>f.runtime.markUnknown(id,reason),failOperation:async(id,reason)=>f.runtime.failOperation(id,reason),cancelBeforeHandoff:async id=>f.runtime.cancelBeforeHandoff(id),stop:async(taskId,mode)=>{f.runtime.handle({operation:'ai.stop',commandId:randomUUID(),taskId,mode},'human');}},createDeterministicFakeProvider());
 const component=path.resolve('packages/frontend/support/ai/index.tsx');
 const choices=[...f.snapshots.values()].map(item=>({ref:item.ref,name:item.nature}));
 writeFileSync(path.join(root,'index.html'),'<div id="root"></div><script type="module" src="/main.tsx"></script>');
 writeFileSync(path.join(root,'main.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import {WikiAiPage} from ${JSON.stringify(component)};const request=async input=>{const response=await fetch('/ai',{method:'POST',body:JSON.stringify(input)});if(!response.ok)throw Error('connection_lost');return response.json();};createRoot(document.getElementById('root')).render(<WikiAiPage request={request} sources={async()=>${JSON.stringify(choices)}} workspaceInstance="real-fixture"/>);`);
 const server=await createServer({configFile:false,root,cacheDir:path.join(root,'.vite'),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','zod']},plugins:[{name:'real-runtime',configureServer(server){server.middlewares.use('/ai',(req,res)=>{let body='';req.on('data',chunk=>body+=String(chunk));req.on('end',()=>{try{const input=JSON.parse(body) as {operation:string;operationId:string};const result=f.runtime.handle(input,'human');if(input.operation==='ai.authorize'&&result.kind==='task')void controller.start(result.task.id,input.operationId).catch(()=>{});res.setHeader('content-type','application/json');res.end(JSON.stringify(result));}catch{res.statusCode=500;res.end();}});});}}],server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd(),root]}}});let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try{await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error();browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.setDefaultTimeout(8000);await page.goto(`http://127.0.0.1:${address.port}`);
  await page.getByRole('checkbox',{name:'敏感A',exact:false}).check();await page.getByRole('checkbox',{name:'公开B',exact:false}).check();await page.getByRole('button',{name:'准备本地 Context / 最终发送预览',exact:true}).click();await page.getByText('最终实际发送内容',{exact:true}).waitFor();expect(await page.getByLabel('单次外发操作').textContent()).toContain('我的私密薪资是100');expect(f.wiki.handle({operation:'list'})).toEqual({kind:'list',items:[]});
  await page.getByRole('button',{name:'授权这份最终请求（本地 fake，无真实外发）',exact:true}).click();await page.getByLabel('Wiki 待审建议').waitFor();await page.getByRole('button',{name:'编辑后接受',exact:true}).click();await page.getByLabel('建议正文',{exact:true}).fill('这是用户明确修改后的建议正文。');f.setFailWrite();await page.getByRole('button',{name:'明确采用编辑后的本条',exact:true}).click();await page.getByText('未生效：storage_failed。编辑输入保留。',{exact:true}).waitFor();expect(await page.getByLabel('建议正文',{exact:true}).inputValue()).toBe('这是用户明确修改后的建议正文。');expect(f.wiki.handle({operation:'list'})).toEqual({kind:'list',items:[]});
 }finally{await browser?.close();await server.close();rmSync(root,{recursive:true,force:true});}
},30000);
it('ignore stays pending, rejection ends only that proposal, and edit-accept writes the explicit new content',()=>{
 const f=setup(),task=f.prepare();f.authorize(task);const intent=f.runtime.prepareDispatch(task.operations[0]!.id);f.runtime.settle(intent.operationId,{proposals:[f.response(intent.manifest).proposals[0],{...f.response(intent.manifest).proposals[0],content:{title:'另一条',body:'建议正文',nature:'hypothesis'}}]});const [a,b]=f.read(task.id).proposals;if(!a||!b)throw Error();
 expect(f.runtime.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:a.id,action:'ignore'},'human')).toMatchObject({kind:'decided',state:'pending'});expect(f.read(task.id).proposals[0]).toMatchObject({state:'pending',ignored:true});
 expect(f.runtime.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:b.id,action:'reject'},'human')).toMatchObject({kind:'decided',state:'rejected'});
 expect(f.runtime.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:a.id,action:'edit-accept',edited:{title:'用户更正后采用',body:'实际只是参与交付。',nature:'observation'}},'human').kind).toBe('decided');expect(f.wiki.handle({operation:'list'})).toMatchObject({kind:'list',items:[{title:'用户更正后采用',body:'实际只是参与交付。',verification:'not_verified'}]});
});
it('zero changes is successful completion; malformed citation fails with no repaired proposal or extra request',()=>{
 const f=setup(),empty=f.prepare();f.authorize(empty);const first=f.runtime.prepareDispatch(empty.operations[0]!.id);f.runtime.settle(first.operationId,{proposals:[]});expect(f.read(empty.id)).toMatchObject({state:'completed',proposals:[],usedRequests:1});
 const invalid=f.prepare();f.authorize(invalid);const second=f.runtime.prepareDispatch(invalid.operations[0]!.id);f.runtime.settle(second.operationId,{proposals:[{...f.response(second.manifest).proposals[0],citations:[randomUUID()]}]});expect(f.read(invalid.id)).toMatchObject({usedRequests:1,proposals:[],operations:[{state:'failure',reason:'invalid_citation'}]});expect(f.wiki.handle({operation:'list'})).toEqual({kind:'list',items:[]});
});
it('RV-P0-03 purge removes all task bodies and receipts, and late output cannot resurrect sensitive A',()=>{
 const f=setup(),task=f.prepare();f.authorize(task);const intent=f.runtime.prepareDispatch(task.operations[0]!.id);f.runtime.markUnknown(intent.operationId);const sensitiveId=intent.manifest.materials[0]!.ref.objectId;
 f.setPurged();f.runtime.purgeByReferences([sensitiveId]);f.runtime.settle(intent.operationId,f.response(intent.manifest));
 const saved=f.read(task.id);expect(saved.state).toBe('purged');expect(saved.proposals).toEqual([]);expect(JSON.stringify(saved)).not.toContain('我的私密薪资');expect(saved.operations[0]?.manifest).toBeUndefined();expect(saved.operations[0]?.reason).toBe('body_purged');
});
it('read permission is separate from egress, and current human permission is rechecked inside acceptance',()=>{
 const f=setup();const sensitive=[...f.snapshots.values()][0]!;sensitive.restrictions.egress=false;sensitive.provenance[0]!.restrictions.egress=false;
 const task=f.prepare();expect(f.authorize(task)).toEqual({kind:'failure',code:'egress_forbidden'});expect(()=>f.runtime.prepareDispatch(task.operations[0]!.id)).toThrow('authorization_required');
 sensitive.restrictions.egress=true;sensitive.provenance[0]!.restrictions.egress=true;const fresh=f.prepare();f.authorize(fresh);const intent=f.runtime.prepareDispatch(fresh.operations[0]!.id);f.runtime.settle(intent.operationId,f.response(intent.manifest));const proposal=f.read(fresh.id).proposals[0]!;
 f.setAllowed(false);expect(f.runtime.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:proposal.id,action:'accept'},'human')).toEqual({kind:'failure',code:'permission_revoked'});f.setAllowed(true);
 const actual=f.ports.wiki.apply;f.ports.wiki.apply=input=>{actual(input);f.setAllowed(false);};expect(f.runtime.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:proposal.id,action:'accept'},'human')).toEqual({kind:'failure',code:'permission_revoked'});f.setAllowed(true);expect(f.wiki.handle({operation:'list'})).toEqual({kind:'list',items:[]});
});
it('local dependency sets keep A applicable after unrelated Y edit, while another change to A conflicts',()=>{
 const f=setup();const add=(title:string)=>{const result=f.wiki.handle({operation:'create',commandId:randomUUID(),title,body:'原文',nature:'observation',scope:'personal',sources:[]});if(result.kind!=='knowledge')throw Error();return result.knowledge;};const a=add('知识A'),y=add('知识Y'),task=f.prepare();f.authorize(task);const intent=f.runtime.prepareDispatch(task.operations[0]!.id);
 f.runtime.settle(intent.operationId,{proposals:[{kind:'edit',itemId:a.id,content:{title:'知识A',body:'A的建议',nature:'observation'},reason:'明确本条依赖',citations:[],unknowns:[]},{kind:'edit',itemId:y.id,content:{title:'知识Y',body:'Y的建议',nature:'observation'},reason:'另一个独立条目',citations:[],unknowns:[]},{kind:'retire',itemId:a.id,reason:'同A冲突提案',citations:[],unknowns:[]}]});
 const proposals=f.read(task.id).proposals;const accept=(index:number)=>f.runtime.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:proposals[index]!.id,action:'accept'},'human');
 expect(accept(1).kind).toBe('decided');expect(f.read(task.id).proposals[0]?.validity).toBe('current');expect(accept(0).kind).toBe('decided');expect(accept(2)).toEqual({kind:'failure',code:'conflict'});expect(f.read(task.id).proposals[2]).toMatchObject({state:'pending',validity:'conflict'});
});
it('pending recovery preserves proposals but no old authorization capability or automatic provider request',()=>{
 const f=setup(),first=f.prepare();const originalAuthorize={operation:'ai.authorize',commandId:randomUUID(),operationId:first.operations[0]!.id,manifestDigest:first.operations[0]!.manifestDigest};
 expect(f.runtime.handle(originalAuthorize,'human').kind).toBe('task');const reopened=createAiRuntime(f.db,{...f.ports,identity:{...f.ports.identity,backendGeneration:randomUUID()}});
 expect(()=>reopened.prepareDispatch(first.operations[0]!.id)).toThrow('authorization_required');expect(reopened.handle(originalAuthorize,'human').kind).toBe('task');expect(()=>reopened.prepareDispatch(first.operations[0]!.id)).toThrow('authorization_required');
 const second=f.prepare();f.authorize(second);const intent=f.runtime.prepareDispatch(second.operations[0]!.id);f.runtime.settle(intent.operationId,f.response(intent.manifest));const again=createAiRuntime(f.db,f.ports);const result=again.handle({operation:'ai.read',taskId:second.id},'human');expect(result.kind==='task'?result.task.proposals.length:0).toBe(1);
 const proposal=result.kind==='task'?result.task.proposals[0]!:undefined;if(!proposal)throw Error();expect(again.handle({operation:'ai.decide',commandId:randomUUID(),proposalId:proposal.id,action:'accept'},'human').kind).toBe('decided');
});
it('outcome_unknown A retains budget; explicit B has new identity and late A never overwrites B or applies',()=>{
 const f=setup(),task=f.prepare();f.authorize(task);const a=f.runtime.prepareDispatch(task.operations[0]!.id);f.runtime.markProcessing(a.operationId);f.runtime.markUnknown(a.operationId);
 expect(f.read(task.id).operations[0]?.state).toBe('outcome_unknown');expect(f.read(task.id).usedRequests).toBe(1);
 const retry=f.runtime.handle({operation:'ai.retry-explicit',commandId:randomUUID(),taskId:task.id,acknowledgeUnknown:true},'human');if(retry.kind!=='task')throw Error(JSON.stringify(retry));const bId=retry.task.operations.at(-1)!.id;expect(bId).not.toBe(a.operationId);f.authorize(retry.task);const b=f.runtime.prepareDispatch(bId);
 f.runtime.settle(bId,{proposals:[{...f.response(b.manifest).proposals[0],content:{title:'请求B',body:'B的独立结果',nature:'observation'}}]});
 f.runtime.settle(a.operationId,{proposals:[{...f.response(a.manifest).proposals[0],content:{title:'请求A',body:'A的迟到结果',nature:'observation'}}]});
 const recovered=f.read(task.id);expect(recovered.usedRequests).toBe(2);expect(recovered.proposals.map(item=>[item.operationId,item.change.kind==='create'?item.change.content.title:''])).toEqual([[bId,'请求B'],[a.operationId,'请求A']]);expect(f.wiki.handle({operation:'list'})).toEqual({kind:'list',items:[]});
 const more=f.runtime.handle({operation:'ai.retry-explicit',commandId:randomUUID(),taskId:task.id,acknowledgeUnknown:true},'human');expect(more.kind).toBe('failure');
});
it('a Wiki mutation followed by a storage failure rolls back Wiki, proposal state and both receipts',()=>{
 const f=setup(),task=f.prepare();f.authorize(task);const intent=f.runtime.prepareDispatch(task.operations[0]!.id);f.runtime.settle(intent.operationId,f.response(intent.manifest));const proposal=f.read(task.id).proposals[0]!;
 const actual=f.ports.wiki.apply;f.ports.wiki.apply=input=>{actual(input);throw Error('storage_failed');};
 const commandId=randomUUID();expect(f.runtime.handle({operation:'ai.decide',commandId,proposalId:proposal.id,action:'accept'},'human')).toEqual({kind:'failure',code:'storage_failed'});
 expect(f.wiki.handle({operation:'list'})).toEqual({kind:'list',items:[]});expect(f.wiki.handle({operation:'receipt',commandId})).toEqual({kind:'receipt_missing'});expect(f.runtime.handle({operation:'ai.receipt',commandId},'human')).toEqual({kind:'receipt_missing'});expect(f.read(task.id).proposals[0]?.state).toBe('pending');
});
it('RV-P0-01 real Transcript R1 -> R2 rejects the whole final Apply without a receipt or Wiki write',()=>{
 const f=setup();f.db.exec(opportunityMigration+interviewMigration);const core=createOpportunityDomain(f.db);
 const company=core.handle({operation:'company.create',commandId:randomUUID(),name:'真实面试范围'});if(company.kind!=='company')throw Error();const opportunity=core.handle({operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'岗位'});if(opportunity.kind!=='opportunity')throw Error();
 const interview=createInterviewDomain(f.db,{core:core.capabilities});const round=interview.handle({operation:'interview.confirm',commandId:randomUUID(),opportunityId:opportunity.opportunity.id,expectedOpportunityRevision:1,title:'第一轮',confirmationTime:{kind:'unknown'}});if(round.kind!=='saved')throw Error();
 expect(interview.handle({operation:'interview.save-document',commandId:randomUUID(),id:round.id,expectedRevision:1,document:'transcript',text:'独立负责全部工作'}).kind).toBe('saved');
 const ref={owner:'interview' as const,objectId:round.id,revision:1,locator:'transcript' as const,scope:'opportunity' as const,opportunityId:opportunity.opportunity.id};
 const selected:SourceSnapshot={ref,body:'独立负责全部工作',nature:'user_record',restrictions:{read:true,egress:true},provenance:[{owner:'interview',objectId:round.id,revision:1,scope:opportunity.opportunity.id,kind:'user_record',restrictions:{read:true,egress:true}}]};
 f.snapshots.set(round.id,selected);
 f.ports.sources.current=source=>{if(source.owner!=='interview')return f.snapshots.get(source.objectId);const current=interview.resolveTranscript(source);return current?.text!==undefined?{...selected,body:current.text}:selected;};
 const prior=f.ports.sources.provenanceCurrent;f.ports.sources.provenanceCurrent=p=>{if(p.owner!=='interview')return prior(p);const result=interview.handle({operation:'interview.read',id:p.objectId});return result.kind==='session'&&result.session.transcript?{revision:result.session.transcript.version,read:true,egress:true}:undefined;};
 const task=f.prepare();f.authorize(task);const intent=f.runtime.prepareDispatch(task.operations[0]!.id);f.runtime.settle(intent.operationId,f.response(intent.manifest));const proposal=f.read(task.id).proposals[0]!;
 expect(interview.handle({operation:'interview.save-document',commandId:randomUUID(),id:round.id,expectedRevision:2,document:'transcript',text:'实际只是参与部分工作'}).kind).toBe('saved');
 const commandId=randomUUID();expect(f.runtime.handle({operation:'ai.decide',commandId,proposalId:proposal.id,action:'accept'},'human')).toEqual({kind:'failure',code:'stale'});
 expect(f.runtime.handle({operation:'ai.receipt',commandId},'human')).toEqual({kind:'receipt_missing'});expect(f.read(task.id).proposals[0]?.state).toBe('pending');expect(f.wiki.handle({operation:'list'})).toEqual({kind:'list',items:[]});
});

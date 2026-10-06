import {it,expect} from 'vitest';
import type {Page} from 'playwright';
import {launchBrowserFixture,skipTutorial} from '../fixtures/browser-host';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const executable=process.env.CAREER_PACKAGED_EXECUTABLE;
const evidenceDirectory=process.env.CAREER_G6_TWO_WINDOWS_EVIDENCE??'/tmp/career-g6-two-windows';
async function record(name:string,value:unknown){await mkdir(evidenceDirectory,{recursive:true});await writeFile(path.join(evidenceDirectory,name+'.json'),JSON.stringify({executable,verifiedProcessArchitecture:'arm64',realMacOSIME:'NOT RUN by automation',...value as object},null,2));}
async function fixture(){
 const browserHost=await launchBrowserFixture({fake:true}),a=browserHost.page;await skipTutorial(a);
 const data=await a.evaluate(async()=>{const call=(m:any,i:any)=>window.career.request(m,i) as Promise<any>;const c=await call('opportunity',{operation:'company.create',commandId:crypto.randomUUID(),name:'E2 TEST two tabs'}),o=await call('opportunity',{operation:'create',commandId:crypto.randomUUID(),companyId:c.company.id,role:'Resume concurrency'}),r=await call('resume',{operation:'resume.open',commandId:crypto.randomUUID(),opportunityId:o.opportunity.id});const content=structuredClone(r.document.content);content.sections[0].blocks[0].spans=[{text:'Controlled shared baseline.',marks:[]}];await call('resume',{operation:'resume.save',commandId:crypto.randomUUID(),resumeId:r.document.id,expectedRevision:r.document.revision,expectedProfileRevision:r.profile.revision,content});return {resumeId:r.document.id,opportunityId:o.opportunity.id};});
 const route='#/opportunity/'+data.opportunityId+'/resume';await a.goto(browserHost.host.url+'/'+route);await a.getByRole('textbox',{name:'简历正文'}).waitFor();const b=await browserHost.open(route);await b.getByRole('textbox',{name:'简历正文'}).waitFor();return {browserHost,a,b,resumeId:data.resumeId};
}

const editor=(page:Page)=>page.getByRole('textbox',{name:'简历正文'});
async function saved(page:Page){await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');}
async function append(page:Page,text:string,block:'first'|'last'='last'){await editor(page).locator('p')[block]().click();await page.keyboard.press('End');await page.keyboard.type(text);}
async function formal(page:Page,resumeId:string){return await page.evaluate(id=>window.career.request('resume',{operation:'resume.read',resumeId:id}),resumeId) as any;}
const body=(document:any)=>document.content.sections.flatMap((section:any)=>section.blocks.flatMap((block:any)=>block.type==='paragraph'?block.spans.map((span:any)=>span.text):block.items.flatMap((item:any)=>item.spans.map((span:any)=>span.text)))).join('\n');
async function finish(f:Awaited<ReturnType<typeof fixture>>){await f.browserHost.close();}
async function failed(f:Awaited<ReturnType<typeof fixture>>,name:string){await mkdir(evidenceDirectory,{recursive:true});for(const [index,page] of f.browserHost.context.pages().entries())await writeFile(path.join(evidenceDirectory,name+'-'+index+'.txt'),await page.locator('body').innerText().catch(()=>''));}

it('two Node/Browser Resume tabs save the same revision: one commits and the other keeps its draft with an explicit formal comparison',async()=>{
 const f=await fixture();try{
  const baseline=await formal(f.a,f.resumeId);expect((await formal(f.b,f.resumeId)).document.revision).toBe(baseline.document.revision);expect(await editor(f.a).textContent()).toBe(await editor(f.b).textContent());
  const textA=' Window A actual draft.',textB=' Window B actual draft.';
  await Promise.all([append(f.a,textA),append(f.b,textB)]);
  await expect.poll(async()=>[await f.a.getByTestId('resume-save-state').textContent(),await f.b.getByTestId('resume-save-state').textContent()].sort()).toEqual(['保存冲突，保留了你的输入','已保存'].sort());
  const aConflicted=(await f.a.getByTestId('resume-save-state').textContent())!=='已保存',loser=aConflicted?f.a:f.b,winner=aConflicted?f.b:f.a,local=aConflicted?textA:textB,remote=aConflicted?textB:textA;
  expect(await editor(loser).textContent()).toContain(local);expect(await editor(winner).textContent()).toContain(remote);expect(await loser.locator('aside pre').textContent()).toContain(remote);
  await loser.getByRole('button',{name:'确认以正式版本为基线保存我的输入'}).waitFor();const adopt=loser.getByRole('button',{name:'放弃本地正文，采用正式正文'});await adopt.waitFor();
  const committed=await formal(winner,f.resumeId);expect(committed.document.revision).toBe(baseline.document.revision+1);expect(body(committed.document)).toContain(remote);expect(body(committed.document)).not.toContain(local);
  await record('same-revision',{status:'PASS',baselineRevision:baseline.document.revision,committedRevision:committed.document.revision,winner:aConflicted?'B':'A',loserLocalDraft:await editor(loser).textContent(),formalComparison:await loser.locator('aside pre').textContent(),explicitChoices:2});
  // Only this deliberate user choice discards the losing draft; no automatic replacement preceded it.
  await adopt.click();expect(await editor(loser).textContent()).toContain(remote);expect(await editor(loser).textContent()).not.toContain(local);await saved(loser);await loser.reload();await editor(loser).waitFor();expect(await editor(loser).textContent()).toContain(remote);
 }catch(error){await failed(f,'same-revision-failure');throw error;}finally{await finish(f);}
},120000);

it('Node/Browser Proposal Apply and Undo keep the other Resume window edits; changed selected blocks cannot be silently overwritten',async()=>{
 const f=await fixture();try{
  await f.a.getByRole('button',{name:'简历优化提案',exact:true}).click();const selection=f.a.getByLabel('简历优化选择');await selection.getByLabel(/个人简介 · Controlled shared/).check();const ai=selection.getByRole('region',{name:'产品任务辅助'});
  await ai.getByRole('button',{name:'准备外发预览'}).click();await ai.getByRole('button',{name:'授权这份最终请求'}).click();const rewrite=ai.getByRole('article',{name:'产品待审提案'}).filter({has:f.a.getByRole('heading',{name:/^修改简历内容/})});await rewrite.waitFor();
  const unrelated=' Remote window separately committed contribution.';await append(f.b,unrelated);await saved(f.b);await rewrite.getByRole('button',{name:'接受本条并立即生效'}).click();await expect.poll(()=>rewrite.getByRole('heading').textContent()).toContain('已采纳');await expect.poll(()=>editor(f.a).textContent()).toContain('受控优化建议');expect(await editor(f.a).textContent()).toContain(unrelated);await saved(f.a);
  await f.a.getByRole('button',{name:'撤销',exact:true}).click();await saved(f.a);expect(await editor(f.a).textContent()).not.toContain('受控优化建议');expect(await editor(f.a).textContent()).toContain(unrelated);expect(body((await formal(f.a,f.resumeId)).document)).toContain(unrelated);expect(await rewrite.getByRole('heading').textContent()).toContain('已采纳');
  await f.b.reload();await editor(f.b).waitFor();await ai.getByRole('button',{name:'准备外发预览'}).click();await ai.getByRole('button',{name:'授权这份最终请求'}).click();await rewrite.getByRole('button',{name:'接受本条并立即生效'}).waitFor();
  const pending=await f.a.evaluate(()=>window.career.request('ai',{operation:'product.list'})) as any,newTask=pending.tasks.find((task:any)=>task.proposals.some((proposal:any)=>proposal.change.kind==='resume-block'&&proposal.state==='pending')),proposal=newTask.proposals.find((proposal:any)=>proposal.change.kind==='resume-block');
  const changed=' Remote selected block now changed.';await append(f.b,changed,'first');await saved(f.b);await expect.poll(()=>rewrite.getByRole('button',{name:'接受本条并立即生效'}).isDisabled()).toBe(true);const before=await formal(f.b,f.resumeId);
  // Also check the actual public owner command rejects the stale proposal even if a caller bypasses its disabled button.
  const rejected=await f.a.evaluate(proposalId=>window.career.request('ai',{operation:'product.decide',commandId:crypto.randomUUID(),proposalIds:[proposalId],action:'accept'}),proposal.id) as any;expect(rejected).toMatchObject({kind:'product_conflict'});const after=await formal(f.b,f.resumeId);expect(after.document).toEqual(before.document);expect(body(after.document)).toContain(changed);expect(body(after.document)).toContain(unrelated);
  const latest=await f.a.evaluate(taskId=>window.career.request('ai',{operation:'product.read',taskId}),newTask.id) as any;expect(latest.task.proposals.find((item:any)=>item.id===proposal.id).state).toBe('pending');await record('proposal-concurrency',{status:'PASS',remoteUnrelatedRetainedThroughApplyUndo:true,acceptedAfterUndo:true,staleProposalDisabled:true,rejected,formalRevisionUnchanged:after.document.revision,remoteSelectedAndUnrelatedBody:body(after.document),pendingProposalState:'pending'});
 }catch(error){await failed(f,'proposal-failure');throw error;}finally{await finish(f);}
},120000);

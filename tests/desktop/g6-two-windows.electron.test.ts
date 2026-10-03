import {it,expect} from 'vitest';
import {_electron,type ElectronApplication,type Page} from 'playwright';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const executable=process.env.CAREER_PACKAGED_EXECUTABLE;
const evidenceDirectory=process.env.CAREER_G6_TWO_WINDOWS_EVIDENCE??'/tmp/career-g6-two-windows';
async function record(name:string,value:unknown){await mkdir(evidenceDirectory,{recursive:true});await writeFile(path.join(evidenceDirectory,name+'.json'),JSON.stringify({executable,verifiedProcessArchitecture:'arm64',realMacOSIME:'NOT RUN by automation',...value as object},null,2));}
async function fixture(){
 if(!executable)throw Error('normal packaged arm64 executable required');
 const root=await mkdtemp(path.join(tmpdir(),'career-g6-two-windows-'));
 const app=await _electron.launch({executablePath:executable,args:[`--user-data-dir=${root}/profile`],timeout:30000});
 try{expect(await app.evaluate(()=>process.arch)).toBe('arm64');const a=await app.firstWindow();a.setDefaultTimeout(15000);await a.getByRole('navigation',{name:'一级导航'}).waitFor();
 await a.getByRole('navigation').getByRole('link',{name:'机会',exact:true}).click();const opportunity=a.getByRole('region',{name:'机会',exact:true});
 await opportunity.getByLabel('公司名称',{exact:true}).click();await a.keyboard.type('G6 fictional two windows');await opportunity.getByRole('button',{name:'建立新公司'}).click();await opportunity.getByRole('button',{name:'保存公司改名'}).waitFor();await opportunity.getByLabel('明确选择公司').selectOption({index:1});await opportunity.getByLabel('岗位名称').click();await a.keyboard.type('Resume concurrency');await opportunity.getByRole('button',{name:'创建机会',exact:true}).click();await opportunity.getByRole('button',{name:'编辑本机会简历'}).click();
 const editorA=a.getByRole('textbox',{name:'简历正文'});await editorA.waitFor();await editorA.locator('p').first().click();await a.keyboard.type('Controlled shared baseline.');await saved(a);
 const next=app.waitForEvent('window');await app.evaluate(({Menu,BrowserWindow})=>{const file=Menu.getApplicationMenu()?.items.find(item=>item.label==='文件'),item=file?.submenu?.items.find(item=>item.label==='新建窗口');if(!item)throw Error('production new-window menu missing');item.click(undefined as never,BrowserWindow.getAllWindows()[0],undefined as never);});
 const b=await next;b.setDefaultTimeout(15000);await b.getByRole('navigation',{name:'一级导航'}).waitFor();await b.getByRole('navigation').getByRole('link',{name:'机会',exact:true}).click();await b.getByRole('button',{name:'G6 fictional two windows · Resume concurrency',exact:true}).click();await b.getByRole('button',{name:'编辑本机会简历'}).click();await b.getByRole('textbox',{name:'简历正文'}).waitFor();
 expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length)).toBe(2);
 const resumeId=await a.evaluate(async()=>{const result=await window.career.request('application',{operation:'data.targets'}) as any;return result.targets.find((item:any)=>item.owner==='resume').objectId as string;});return {root,app,a,b,resumeId};
 }catch(error){await failed(app,'fixture-failure');await finish(app,root);throw error;}
}
const editor=(page:Page)=>page.getByRole('textbox',{name:'简历正文'});
async function saved(page:Page){await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');}
async function append(page:Page,text:string,block:'first'|'last'='last'){await editor(page).locator('p')[block]().click();await page.keyboard.press('End');await page.keyboard.type(text);}
async function formal(page:Page,resumeId:string){return await page.evaluate(id=>window.career.request('resume',{operation:'resume.read',resumeId:id}),resumeId) as any;}
const body=(document:any)=>document.content.sections.flatMap((section:any)=>section.blocks.flatMap((block:any)=>block.type==='paragraph'?block.spans.map((span:any)=>span.text):block.items.flatMap((item:any)=>item.spans.map((span:any)=>span.text)))).join('\n');
async function finish(app:ElectronApplication,root:string){await app.evaluate(({dialog})=>{dialog.showMessageBoxSync=(()=>1) as typeof dialog.showMessageBoxSync;}).catch(()=>{});await app.close().catch(()=>{});await rm(root,{recursive:true,force:true});}
async function failed(app:ElectronApplication,name:string){await mkdir(evidenceDirectory,{recursive:true});for(const [index,page] of app.windows().entries())await writeFile(path.join(evidenceDirectory,name+'-'+index+'.txt'),await page.locator('body').innerText().catch(()=>''));}

it('normal packaged two Resume editors save the same revision: one commits and the other keeps its draft with an explicit formal comparison',async()=>{
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
 }catch(error){await failed(f.app,'same-revision-failure');throw error;}finally{await finish(f.app,f.root);}
},120000);

it('normal packaged Proposal Apply and Undo keep the other Resume window edits; changed selected blocks cannot be silently overwritten',async()=>{
 const f=await fixture();try{
  await f.a.getByRole('button',{name:'简历优化提案',exact:true}).click();const selection=f.a.getByLabel('简历优化选择');await selection.getByLabel(/个人简介 · Controlled shared/).check();const ai=selection.getByRole('region',{name:'产品任务辅助'});
  await ai.getByRole('button',{name:'准备当前任务与最终预览'}).click();await ai.getByRole('button',{name:'授权这份最终请求'}).click();const rewrite=ai.getByRole('article',{name:'产品待审提案'}).filter({has:f.a.getByRole('heading',{name:/^选定简历区块/})});await rewrite.waitFor();
  const unrelated=' Remote window separately committed contribution.';await append(f.b,unrelated);await saved(f.b);await rewrite.getByRole('button',{name:'接受本条并立即生效'}).click();await expect.poll(()=>rewrite.getByRole('heading').textContent()).toContain('accepted');await expect.poll(()=>editor(f.a).textContent()).toContain('受控优化建议');expect(await editor(f.a).textContent()).toContain(unrelated);await saved(f.a);
  await f.a.getByRole('button',{name:'撤销',exact:true}).click();await saved(f.a);expect(await editor(f.a).textContent()).not.toContain('受控优化建议');expect(await editor(f.a).textContent()).toContain(unrelated);expect(body((await formal(f.a,f.resumeId)).document)).toContain(unrelated);expect(await rewrite.getByRole('heading').textContent()).toContain('accepted');
  await f.b.reload();await editor(f.b).waitFor();await ai.getByRole('button',{name:'准备当前任务与最终预览'}).click();await ai.getByRole('button',{name:'授权这份最终请求'}).click();await rewrite.getByRole('button',{name:'接受本条并立即生效'}).waitFor();
  const pending=await f.a.evaluate(()=>window.career.request('ai',{operation:'product.list'})) as any,newTask=pending.tasks.find((task:any)=>task.proposals.some((proposal:any)=>proposal.change.kind==='resume-block'&&proposal.state==='pending')),proposal=newTask.proposals.find((proposal:any)=>proposal.change.kind==='resume-block');
  const changed=' Remote selected block now changed.';await append(f.b,changed,'first');await saved(f.b);await expect.poll(()=>rewrite.getByRole('button',{name:'接受本条并立即生效'}).isDisabled()).toBe(true);const before=await formal(f.b,f.resumeId);
  // Also check the actual public owner command rejects the stale proposal even if a caller bypasses its disabled button.
  const rejected=await f.a.evaluate(proposalId=>window.career.request('ai',{operation:'product.decide',commandId:crypto.randomUUID(),proposalIds:[proposalId],action:'accept'}),proposal.id) as any;expect(rejected).toMatchObject({kind:'product_conflict'});const after=await formal(f.b,f.resumeId);expect(after.document).toEqual(before.document);expect(body(after.document)).toContain(changed);expect(body(after.document)).toContain(unrelated);
  const latest=await f.a.evaluate(taskId=>window.career.request('ai',{operation:'product.read',taskId}),newTask.id) as any;expect(latest.task.proposals.find((item:any)=>item.id===proposal.id).state).toBe('pending');await record('proposal-concurrency',{status:'PASS',remoteUnrelatedRetainedThroughApplyUndo:true,acceptedAfterUndo:true,staleProposalDisabled:true,rejected,formalRevisionUnchanged:after.document.revision,remoteSelectedAndUnrelatedBody:body(after.document),pendingProposalState:'pending'});
 }catch(error){await failed(f.app,'proposal-failure');throw error;}finally{await finish(f.app,f.root);}
},120000);

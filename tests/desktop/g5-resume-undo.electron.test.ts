import {it,expect} from 'vitest';
import {_electron} from 'playwright';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

it.each(['new','existing'] as const)('AI resume-add from %s task: undo preserves preceding manual text and bold, saves without conflict, and remains accepted',async(taskSource)=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-g5-resume-undo-'));
 const packaged=process.env.CAREER_PACKAGED==='1';
 const app=await _electron.launch({executablePath:packaged?path.resolve(process.env.CAREER_PACKAGED_EXECUTABLE??'out/CareerNext-darwin-arm64/CareerNext.app/Contents/MacOS/CareerNext'):undefined,args:packaged?['--career-development-diagnostics',`--user-data-dir=${root}/profile`]:['.','--career-development-diagnostics',`--user-data-dir=${root}/profile`],timeout:30000});
 try{
  const page=await app.firstWindow();page.setDefaultTimeout(10000);
  await page.getByRole('navigation',{name:'一级导航'}).waitFor();
  const fixture=await page.evaluate(async(existingTask)=>{
   const call=(module:any,input:any)=>window.career.request(module,input) as Promise<any>;
   const company=(await call('opportunity',{operation:'company.create',commandId:crypto.randomUUID(),name:'G5 Undo regression'})).company;
   const opportunity=(await call('opportunity',{operation:'create',commandId:crypto.randomUUID(),companyId:company.id,role:'Resume add'})).opportunity;
   const opened=await call('resume',{operation:'resume.open',commandId:crypto.randomUUID(),opportunityId:opportunity.id});
   const content=structuredClone(opened.document.content);content.sections[0].blocks[0].spans=[{text:'Controlled delivery experience.',marks:[]}];
   await call('resume',{operation:'resume.save',commandId:crypto.randomUUID(),resumeId:opened.document.id,expectedRevision:opened.document.revision,expectedProfileRevision:opened.profile.revision,content});
   let taskId:string|undefined;
   if(existingTask){const prepared=await call('ai',{operation:'product.prepare',commandId:crypto.randomUUID(),input:{target:{kind:'resume-optimize',resumeId:opened.document.id,blockIds:[content.sections[0].blocks[0].id],changeKinds:['rewrite','add','delete']},sources:[],egressSourceIds:[],wikiIds:[],egressWikiIds:[],objects:[]},budget:{requests:2,inputBytes:524288,outputBytes:196608}});const op=prepared.task.operations[0];await call('ai',{operation:'product.authorize',commandId:crypto.randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest});taskId=prepared.task.id;}
   location.hash='#/opportunity/'+opportunity.id+'/resume';return {resumeId:opened.document.id,taskId};
  },taskSource==='existing');
  const editor=page.getByRole('textbox',{name:'简历正文'});await editor.waitFor();
  await page.getByText('更多工具',{exact:true}).click();await page.getByRole('button',{name:'简历优化提案',exact:true}).click();
  const selection=page.getByLabel('简历优化选择');await selection.getByLabel(/个人简介 · Controlled delivery/).check();
  const ai=selection.getByRole('region',{name:'产品任务辅助'});
  if(fixture.taskId)await ai.getByRole('button',{name:/查看此前建议/}).click();
  else{await ai.getByRole('button',{name:'准备外发预览'}).click();await ai.getByRole('button',{name:'授权这份最终请求'}).click();}
  const proposal=ai.getByRole('article',{name:'产品待审提案'}).filter({has:page.getByRole('heading',{name:/^增加简历内容/})});await proposal.waitFor();
  // Match the reused manual task: an earlier rewrite has already been accepted and undone.
  const rewrite=ai.getByRole('article',{name:'产品待审提案'}).first();
  await rewrite.getByRole('button',{name:'接受本条并立即生效'}).click();await expect.poll(()=>rewrite.getByRole('heading').textContent()).toContain('已采纳');
  await page.getByRole('button',{name:'撤销',exact:true}).click();await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');
  // Deterministic document input, not a claim of real macOS IME acceptance.
  await editor.locator('p').last().click();await page.keyboard.insertText('蒸牛蛙，这是中文输入测试 abc123');
  await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');
  await page.getByRole('button',{name:'查找替换',exact:true}).click();await page.getByLabel('查找',{exact:true}).fill('这是中文输入测试');await page.getByRole('button',{name:'定位',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.getSelection()?.toString())).toBe('这是中文输入测试');
  await page.getByRole('button',{name:'加粗',exact:true}).click();expect(await editor.locator('strong').textContent()).toBe('这是中文输入测试');
  // Do not wait for the formatting debounce: Apply must first stabilize it itself.
  const beforeHtml=await editor.innerHTML();
  await proposal.getByRole('button',{name:'接受本条并立即生效'}).click();await expect.poll(()=>proposal.getByRole('heading').textContent()).toContain('已采纳');
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  expect(await editor.locator('strong').textContent()).toBe('这是中文输入测试');
  expect(await editor.textContent()).toContain('蒸牛蛙，这是中文输入测试 abc123');
  await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');
  expect(await page.getByRole('button',{name:'确认以正式版本为基线保存我的输入'}).count()).toBe(0);
  const after=await page.evaluate(id=>window.career.request('resume',{operation:'resume.read',resumeId:id}),fixture.resumeId) as any;
  expect(await editor.innerHTML()).toBe(beforeHtml);expect(after.document.content.sections.at(-1).blocks[0].spans).toEqual([{text:'蒸牛蛙，',marks:[]},{text:'这是中文输入测试',marks:[{type:'bold'}]},{text:' abc123',marks:[]}]);
  expect(await proposal.getByRole('heading').textContent()).toContain('已采纳');
  const tasks=await page.evaluate(()=>window.career.request('ai',{operation:'product.list'})) as any;expect(tasks.tasks[0].proposals.find((p:any)=>p.change.kind==='resume-add').state).toBe('accepted');
  // The user's full chain continues from Undo to freezing and viewing a named version.
  await page.getByRole('button',{name:'命名版本（⌘S）',exact:true}).click();await page.getByLabel('版本名称').fill('G5 manual baseline');await page.getByRole('button',{name:'保存版本及 PDF',exact:true}).click();await page.getByText('命名版本及 PDF 已冻结保存',{exact:true}).waitFor({timeout:45000});
  const versions=await page.evaluate(id=>window.career.request('resume',{operation:'resume.versions',resumeId:id}),fixture.resumeId) as any;expect(versions.versions[0].snapshot.content).toEqual(after.document.content);
  await page.getByRole('button',{name:'版本历史',exact:true}).click();await page.getByRole('button',{name:'G5 manual baseline',exact:true}).click();expect(await page.locator('.resume-frozen-body strong').textContent()).toBe('这是中文输入测试');expect(await page.locator('.resume-frozen-body').textContent()).toContain('蒸牛蛙，这是中文输入测试 abc123');
  await writeFile(path.join(tmpdir(),`career-g5-resume-undo-${packaged?'packaged':'dev'}.json`),JSON.stringify({manualTextAndBoldRetained:true,onlyAiAdditionUndone:true,autosavedWithoutConflict:true,proposalAccepted:true,realIME:'NOT TESTED by this automated regression'},null,2));
 }catch(error){const page=await app.firstWindow();await writeFile('/tmp/career-g5-resume-undo-red.txt',await page.locator('body').innerText());await page.screenshot({path:'/tmp/career-g5-resume-undo-red.png'});throw error;}
 finally{await app.evaluate(({dialog})=>{dialog.showMessageBoxSync=(()=>1) as typeof dialog.showMessageBoxSync;}).catch(()=>{});await app.close();await rm(root,{recursive:true,force:true});}
},90000);

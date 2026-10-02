import {beforeAll,afterAll,it,expect} from 'vitest';
import {build} from 'vite';
import {chromium,type Browser} from 'playwright';
import Database from 'better-sqlite3';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createResumeDomain,resumeMigration} from '../packages/backend/domains/resume/public';
import {createProfileDomain,profileMigration} from '../packages/backend/domains/profile/public';
import {commandMigration} from '../packages/backend/platform/commands/receipts';
import {Request,type CareerDocument} from '../packages/contracts/resume/schema';
import {Request as ProfileRequest} from '../packages/contracts/profile/schema';
let browser:Browser;let script:string;
const entry=path.resolve('dist/test-support/resume-session-entry.tsx');
beforeAll(async()=>{
 mkdirSync(path.dirname(entry),{recursive:true});writeFileSync(entry,'');
 const output=await build({configFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},plugins:[{name:'resume-session-fixture',resolveId:id=>id===entry?entry:undefined,load:id=>id===entry?`
  import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';
  import{ResumePage}from ${JSON.stringify(path.resolve('packages/frontend/features/resume/index.tsx'))};
  const request=input=>window.ownerRequest(input);
  createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false}}})},React.createElement(ResumePage,{request,profileRequest:request,opportunityId:location.hash.slice(1)})));
 `:undefined}],build:{write:false,lib:{entry,name:'ResumeFixture',formats:['iife']}}});
 const bundles=Array.isArray(output)?output:[output];script=bundles.flatMap(item=>'output'in item?item.output:[]).filter(item=>item.type==='chunk').map(item=>item.code).join('\n');
 browser=await chromium.launch({headless:true});
},20000);
afterAll(async()=>{await browser?.close();rmSync(entry,{force:true});});
async function fixture(failingHistoryReads=0){
 const root=mkdtempSync(path.join(tmpdir(),'career-resume-session-'));const db=new Database(path.join(root,'career.sqlite'));db.exec(commandMigration+profileMigration+resumeMigration);
 const opportunityId=randomUUID();const profile=createProfileDomain(db);const resume=createResumeDomain(db,{profile,resolveOpportunity:id=>({id,companyName:'Test company',role:'Engineer'})});
 const opened=resume.handle({operation:'resume.open',commandId:randomUUID(),opportunityId});if(opened.status!=='document')throw Error('fixture failed');
 const resumeId=opened.document.id;const saveCommands:Extract<Request,{operation:'resume.save'}>[]=[];const versionCommands:Extract<Request,{operation:'resume.name-version'}>[]=[];
 const page=await browser.newPage();page.setDefaultTimeout(3000);
 await page.exposeFunction('ownerRequest',(input:unknown)=>{
  if(ProfileRequest.safeParse(input).success)return profile.handle(input);const request=Request.parse(input);if(request.operation==='resume.save')saveCommands.push(request);
  if(request.operation==='resume.versions'&&failingHistoryReads>0){failingHistoryReads--;throw Error('read transport unavailable');}
  if(request.operation==='resume.name-version'){
   versionCommands.push(request);const prepared=resume.prepareVersion(request);if(prepared.status!=='pending-job')return prepared;
   // Trusted print boundary fixture; the actual version/receipt is committed by the public SQLite owner.
   const blobId=randomUUID();const bytes=Buffer.from('%PDF-1.4\ntrailer<</Root 1 0 R>>\n%%EOF');writeFileSync(path.join(root,blobId),bytes);const actual=readFileSync(path.join(root,blobId));
   return resume.completeVersion(request.commandId,{blobId,digest:createHash('sha256').update(actual).digest('hex'),size:actual.length},()=>{});
  }
  return resume.handle(request);
 });
 await page.route('https://career-resume-session.test/**',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
 async function start(){await page.goto('https://career-resume-session.test/#'+opportunityId);await page.addScriptTag({content:script});await page.getByRole('textbox',{name:'简历正文',exact:true}).waitFor();}
 async function assertLayoutSaved(fontSize:number){await expect.poll(()=>saveCommands.length).toBeGreaterThan(0);await page.getByTestId('resume-save-state').filter({hasText:'已保存'}).waitFor();const command=saveCommands.at(-1)!;expect(resume.handle({operation:'resume.receipt',commandId:command.commandId})).toMatchObject({status:'document',document:{content:{layout:{fontSize}}}});expect(resume.handle({operation:'resume.read',resumeId})).toMatchObject({status:'document',document:{content:{layout:{fontSize}}}});}
 return {root,resume,opened,page,start,saveCommands,versionCommands,assertLayoutSaved,close:async()=>{await page.close();db.close();rmSync(root,{recursive:true,force:true});}};
}
it('a failed document search does not stop font layout autosave and its actual owner receipt',async()=>{
 const f=await fixture();try{
  await f.start();await f.page.getByRole('button',{name:'查找替换',exact:true}).click();await f.page.getByLabel('查找',{exact:true}).fill('text that is absent');await f.page.getByRole('button',{name:'定位',exact:true}).click();await f.page.getByText('当前文稿没有找到该文字',{exact:true}).waitFor();
  await f.page.getByLabel('简历字号',{exact:true}).selectOption('13');await f.assertLayoutSaved(13);
 }finally{await f.close();}
});
it('restoring a frozen body keeps its success notice and later layout changes still autosave',async()=>{
 const f=await fixture();try{
  const frozen:CareerDocument=structuredClone(f.opened.document.content);frozen.sections[0].blocks=[{id:randomUUID(),type:'paragraph',spans:[{text:'Frozen original body',marks:[]}]}];
  expect(f.resume.handle({operation:'resume.save',commandId:randomUUID(),resumeId:f.opened.document.id,expectedRevision:1,expectedProfileRevision:0,content:frozen}).status).toBe('document');
  const commandId=randomUUID();expect(f.resume.prepareVersion({operation:'resume.name-version',commandId,resumeId:f.opened.document.id,expectedRevision:2,expectedProfileRevision:0,name:'Frozen version'}).status).toBe('pending-job');
  // Binary fixture for the editor/owner seam only; production Chromium PDF has a separate desktop acceptance.
  const bytes=Buffer.from('%PDF-1.4\ntrailer<</Root 1 0 R>>\n%%EOF');const blobId=randomUUID();writeFileSync(path.join(f.root,blobId),bytes);const actual=readFileSync(path.join(f.root,blobId));
  expect(f.resume.completeVersion(commandId,{blobId,digest:createHash('sha256').update(actual).digest('hex'),size:actual.length},()=>{}).status).toBe('version');
  const current=structuredClone(frozen);current.sections[0].blocks=[{id:randomUUID(),type:'paragraph',spans:[{text:'Current later body',marks:[]}]}];
  expect(f.resume.handle({operation:'resume.save',commandId:randomUUID(),resumeId:f.opened.document.id,expectedRevision:2,expectedProfileRevision:0,content:current}).status).toBe('document');
  await f.start();f.page.on('dialog',dialog=>dialog.accept());await f.page.getByRole('button',{name:'版本历史',exact:true}).click();await f.page.getByRole('button',{name:'Frozen version',exact:true}).click();await f.page.getByRole('button',{name:'恢复此版本正文',exact:true}).click();
  await f.page.getByText('已恢复正文；此替换可以撤销',{exact:true}).waitFor();expect(await f.page.getByRole('textbox',{name:'简历正文',exact:true}).textContent()).toContain('Frozen original body');
  await f.page.getByLabel('简历字号',{exact:true}).selectOption('13');await f.assertLayoutSaved(13);
  const restored=f.resume.handle({operation:'resume.read',resumeId:f.opened.document.id});if(restored.status!=='document')throw Error('read failed');expect(restored.document.content).toEqual({...frozen,layout:{...frozen.layout,fontSize:13}});
 }finally{await f.close();}
});
it('invalid live editor content blocks layout autosave, version freezing and leaving until corrected',async()=>{
 const f=await fixture();try{
  await f.start();const body=f.page.getByRole('textbox',{name:'简历正文',exact:true}).locator('p').first();await body.fill('x'.repeat(10001));
  await f.page.getByTestId('resume-save-state').filter({hasText:'格式不受支持，当前输入未保存'}).waitFor();
  await f.page.getByLabel('简历字号',{exact:true}).selectOption('13');
  // Longer than debounce; no older valid document may silently substitute for the visible invalid body.
  await new Promise(resolve=>setTimeout(resolve,900));expect(f.saveCommands).toHaveLength(0);
  expect(await f.page.evaluate(()=>!window.dispatchEvent(new Event('beforeunload',{cancelable:true})))).toBe(true);
  await f.page.getByRole('button',{name:'命名版本（⌘S）',exact:true}).click();await f.page.getByLabel('版本名称',{exact:true}).fill('Must not freeze old content');await f.page.getByRole('button',{name:'保存版本及 PDF',exact:true}).click();
  await f.page.getByText('请先结束中文输入并解决当前稿保存状态',{exact:true}).waitFor();expect(f.resume.handle({operation:'resume.versions',resumeId:f.opened.document.id})).toEqual({status:'versions',versions:[]});
  await f.page.getByRole('button',{name:'关闭，保留当前稿',exact:true}).click();await body.fill('Corrected supported body');await f.assertLayoutSaved(13);
  const corrected=f.resume.handle({operation:'resume.read',resumeId:f.opened.document.id});if(corrected.status!=='document')throw Error('read failed');expect(corrected.document.content.sections[0].blocks[0]).toMatchObject({type:'paragraph',spans:[{text:'Corrected supported body'}]});
 }finally{await f.close();}
});

it('committed version remains saved when history reads fail, and explicit reread reveals the real version',async()=>{
 const f=await fixture(2);try{
  await f.start();await f.page.getByRole('button',{name:'命名版本（⌘S）',exact:true}).click();await f.page.getByLabel('版本名称',{exact:true}).fill('Committed despite read failure');await f.page.getByRole('button',{name:'保存版本及 PDF',exact:true}).click();
  await f.page.getByText('命名版本及 PDF 已冻结保存',{exact:true}).waitFor();await f.page.getByText('版本历史读取失败，缓存可能不完整；已保存的版本保持不变。',{exact:true}).waitFor();
  expect(f.versionCommands).toHaveLength(1);expect(f.resume.handle({operation:'resume.receipt',commandId:f.versionCommands[0].commandId})).toMatchObject({status:'version',version:{name:'Committed despite read failure'}});
  await f.page.getByRole('button',{name:'版本历史',exact:true}).click();await f.page.getByText('版本历史读取失败，缓存可能不完整；已保存的版本保持不变。',{exact:true}).waitFor();expect(await f.page.getByText('尚未创建命名版本。',{exact:true}).count()).toBe(0);
  await f.page.getByLabel('简历字号',{exact:true}).selectOption('13');await f.assertLayoutSaved(13);await f.page.getByText('版本历史读取失败，缓存可能不完整；已保存的版本保持不变。',{exact:true}).waitFor();
  await f.page.getByRole('button',{name:'重新读取版本历史',exact:true}).click();await f.page.getByRole('button',{name:'Committed despite read failure',exact:true}).waitFor();expect(await f.page.getByText('版本历史读取失败，缓存可能不完整；已保存的版本保持不变。',{exact:true}).count()).toBe(0);
  expect(f.versionCommands).toHaveLength(1);
 }finally{await f.close();}
});

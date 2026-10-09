import {it,expect} from 'vitest';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {sourcePaperFixture} from './fixtures/source-resume';
it('one directly editable source paper retains project duties/date, bold, IME boundaries and undo at 600px',async()=>{
 const root=path.resolve('out/miaoda-resume-adaptation/SOURCE-PAPER-UI-TEST');await mkdir(root,{recursive:true});
 const content=sourcePaperFixture();
 await writeFile(path.join(root,'index.html'),'<div id="root"></div><script type="module" src="/main.tsx"></script>');
 await writeFile(path.join(root,'main.tsx'),`import React from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{ResumePage}from'../../../packages/frontend/features/resume/index';import'../../../packages/frontend/app/style.css';import'../../../packages/frontend/design-system/aura-approved.css';let profile={revision:0,name:'TEST Name',contact:'TEST Contact',links:[{label:'TEST Website',href:'https://example.test'},{label:'TEST GitHub',href:'https://github.com/example-test'}]};let doc={id:'11111111-1111-4111-8111-111111111111',opportunityId:'22222222-2222-4222-8222-222222222222',revision:1,recordedAt:'2026-10-08T00:00:00Z',content:${JSON.stringify(content)}};window.savedContent=doc.content;window.writeCount=0;window.career={};const request=async input=>{if(input.operation==='profile.read')return{status:'profile',profile};if(input.operation==='profile.save'){profile={revision:profile.revision+1,name:input.name,contact:input.contact,links:input.links};window.savedProfile=profile;return {status:'profile',profile};}if(input.operation==='resume.save'){window.writeCount++;window.savedContent=input.content;doc={...doc,content:input.content,revision:doc.revision+1};}return{status:'document',document:doc,profile,opportunity:{id:doc.opportunityId,companyName:'TEST company',role:'TEST role'}}};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><ResumePage opportunityId={doc.opportunityId} request={request} profileRequest={request}/></QueryClientProvider>);`);
 const server=await createServer({configFile:false,root,cacheDir:path.join(root,'.vite'),server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd()]}}});await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error();const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:600,height:820}});page.setDefaultTimeout(8000);
 try{
  await page.goto('http://127.0.0.1:'+address.port);const editor=page.getByRole('textbox',{name:'简历正文'});await editor.waitFor();expect(await page.getByRole('article',{name:'简历编辑纸面'}).count()).toBe(1);expect(await page.locator('.miaoda-columns,.resume-workbench-columns').count()).toBe(0);
  const paper=page.getByRole('article',{name:'简历编辑纸面'});
  // Supplied A4 paper has 9mm margins; its editable width must match the PDF print area.
  expect(await editor.evaluate(el=>(el as HTMLElement).offsetWidth)).toBe(726);
  expect(await paper.evaluate(el=>el.querySelector('.tiptap>h2')!.getBoundingClientRect().top-el.querySelector('header')!.getBoundingClientRect().bottom)).toBeLessThan(16);
  expect(await paper.getByLabel('基础资料姓名',{exact:true}).isVisible()).toBe(true);
  await paper.getByLabel('基础资料姓名',{exact:true}).fill('TEST Edited Name');
  await paper.getByLabel('基础资料联系方式',{exact:true}).fill('TEST Edited Contact');
  await page.getByRole('button',{name:'保存信息',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).savedProfile?.name)).toBe('TEST Edited Name');
  expect(await page.evaluate(()=>(window as any).savedProfile.links)).toEqual([{label:'TEST Website',href:'https://example.test'},{label:'TEST GitHub',href:'https://github.com/example-test'}]);
  await paper.getByRole('button',{name:'＋ 网页 / GitHub',exact:true}).click();
  await paper.getByLabel('链接显示文字 3',{exact:true}).fill('TEST New GitHub');
  await paper.getByLabel('修改网页地址 3',{exact:true}).click();
  await paper.getByLabel('网页地址 3',{exact:true}).fill('https://github.com/second-example-test');
  await page.getByRole('button',{name:'保存信息',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).savedProfile.links.length)).toBe(3);
  expect(await page.evaluate(()=>(window as any).savedProfile.links[2])).toEqual({label:'TEST New GitHub',href:'https://github.com/second-example-test'});
  await expect.poll(()=>paper.evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width/r.height-210/297);})).toBeLessThan(0.002);
  expect(await editor.locator('li').first().evaluate(el=>(el as HTMLElement).offsetHeight)).toBeLessThan(23);
  const narrowLines=await editor.locator('p').evaluateAll(nodes=>nodes.map(el=>(el as HTMLElement).offsetHeight));
  await page.setViewportSize({width:1280,height:900});
  await expect.poll(()=>paper.evaluate(el=>{const r=el.getBoundingClientRect();return Math.abs(r.width/r.height-210/297);})).toBeLessThan(0.002);
  expect(await editor.locator('p').evaluateAll(nodes=>nodes.map(el=>(el as HTMLElement).offsetHeight))).toEqual(narrowLines);
  await page.setViewportSize({width:600,height:820});
  await editor.click();await page.waitForTimeout(750);expect(await page.evaluate(()=>(window as any).writeCount)).toBe(0);const duties=editor.locator('[data-entry-field=responsibility]'),date=editor.locator('[data-entry-field=date]');await duties.click();await page.keyboard.type('TEST 项目负责人');await date.click();await page.keyboard.type('2024.01 - 2025.06');await expect.poll(()=>page.evaluate(()=>(window as any).savedContent.sections[1].blocks[1].spans[0]?.text)).toBe('TEST 项目负责人');
  await expect.poll(()=>page.evaluate(()=>(window as any).savedContent.sections[1].blocks[2].spans[0]?.text)).toBe('2024.01 - 2025.06');
  await date.click();await page.keyboard.press('End');await page.keyboard.type(' TEST');await page.getByRole('button',{name:'撤销',exact:true}).click();await page.getByRole('button',{name:'重做',exact:true}).click();await expect.poll(()=>date.textContent()).toContain(' TEST');
  await duties.click();await page.keyboard.press(process.platform==='darwin'?'Meta+ArrowRight':'End');await page.keyboard.press(process.platform==='darwin'?'Meta+Shift+ArrowLeft':'Shift+Home');await duties.dispatchEvent('compositionstart');await page.keyboard.insertText('zhengniuwa');await page.waitForTimeout(900);expect(await page.evaluate(()=>(window as any).savedContent.sections[1].blocks[1].spans.some((s:any)=>s.text==='zhengniuwa'))).toBe(false);await page.keyboard.press(process.platform==='darwin'?'Meta+ArrowRight':'End');await page.keyboard.press(process.platform==='darwin'?'Meta+Shift+ArrowLeft':'Shift+Home');await page.keyboard.insertText('TEST 中文职责');await duties.dispatchEvent('compositionend');await expect.poll(()=>page.evaluate(()=>(window as any).savedContent.sections[1].blocks[1].spans[0]?.text)).toBe('TEST 中文职责');
  expect(await editor.locator('strong').textContent()).toBe('TEST 中文技能');expect(await editor.locator('em').textContent()).toBe('TEST 负责交付');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'添加项目',exact:true}).click();await expect.poll(()=>editor.locator('[data-entry-field=name]').count()).toBe(2);await page.getByRole('button',{name:'撤销',exact:true}).click();await expect.poll(()=>editor.locator('[data-entry-field=name]').count()).toBe(1);
 }finally{await browser.close();await server.close();await rm(root,{recursive:true,force:true});}
},30000);

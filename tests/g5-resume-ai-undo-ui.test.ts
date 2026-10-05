import {it,expect} from 'vitest';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRuntimeBackend} from '../packages/backend/bootstrap/runtime';

it.each(['toolbar','keyboard'] as const)('Resume %s undo waits for accepted AI content to join history, retaining preceding manual bold and revision',async(mode)=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-g5-resume-undo-ui-')),ui=path.resolve('dist/g5-resume-undo-ui');await mkdir(ui,{recursive:true});
 const runtime=await createRuntimeBackend(path.join(root,'workspaces/local'),path.resolve('dist/application/writer.cjs'),root);
 const human=await runtime.connectHuman();const call=(module:Parameters<typeof runtime.business>[1],input:unknown)=>runtime.business(human,module,input) as Promise<any>;
 let slowAcceptedRead=false;
 const company=(await call('opportunity',{operation:'company.create',commandId:randomUUID(),name:'Undo race'})).company;
 const opportunity=(await call('opportunity',{operation:'create',commandId:randomUUID(),companyId:company.id,role:'Resume'})).opportunity;
 const opened=await call('resume',{operation:'resume.open',commandId:randomUUID(),opportunityId:opportunity.id});
 const content=structuredClone(opened.document.content);content.sections[0].blocks[0].spans=[{text:'Controlled delivery experience.',marks:[]}];
 await call('resume',{operation:'resume.save',commandId:randomUUID(),resumeId:opened.document.id,expectedRevision:1,expectedProfileRevision:0,content});
 await writeFile(path.join(ui,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(ui,'main.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{ResumePage}from'../../packages/frontend/features/resume/index.tsx';window.career={developmentDiagnostics:true,request:async(module,input)=>{const r=await fetch('/owner',{method:'POST',body:JSON.stringify({module,input})});if(!r.ok)throw Error('transport');return r.json();}};window.careerMaterials={request:async()=>({kind:'list',items:[]})};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><ResumePage opportunityId="${opportunity.id}" request={input=>window.career.request('resume',input)} profileRequest={input=>window.career.request('profile',input)}/></QueryClientProvider>);`);
 const server=await createServer({configFile:false,root:ui,cacheDir:path.join(ui,'.vite'),plugins:[{name:'owner-read-latency',configureServer(server){server.middlewares.use('/owner',(req,res)=>{let body='';req.on('data',chunk=>body+=chunk);req.on('end',async()=>{try{const {module,input}=JSON.parse(body);const result=await call(module,input);if(input.operation==='product.decide'&&result.kind==='product_decided'&&result.state==='accepted')slowAcceptedRead=true;else if(input.operation==='resume.read'&&slowAcceptedRead){slowAcceptedRead=false;await new Promise(resolve=>setTimeout(resolve,2200));}res.setHeader('content-type','application/json');res.end(JSON.stringify(result));}catch{res.statusCode=500;res.end();}});});}}],server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd()]}}});
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try{
  await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error('port');browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(10000);await page.goto('http://127.0.0.1:'+address.port);
  const editor=page.getByRole('textbox',{name:'简历正文'});await editor.waitFor();
  await page.getByText('更多工具',{exact:true}).click();await page.getByRole('button',{name:'简历优化提案',exact:true}).click();const selection=page.getByLabel('简历优化选择');await selection.getByLabel(/个人简介 · Controlled delivery/).check();const ai=selection.getByRole('region',{name:'产品任务辅助'});
  await ai.getByRole('button',{name:'准备外发预览'}).click();await ai.getByRole('button',{name:'授权这份最终请求'}).click();const proposal=ai.getByRole('article',{name:'产品待审提案'}).filter({has:page.getByRole('heading',{name:/^增加简历内容/})});await proposal.waitFor();
  // Literal regression fixture; this does not stand in for real macOS IME.
  await editor.locator('p').last().click();await page.keyboard.insertText('蒸牛蛙，这是中文输入测试 abc123');
  await page.getByRole('button',{name:'查找替换',exact:true}).click();await page.getByLabel('查找',{exact:true}).fill('这是中文输入测试');await page.getByRole('button',{name:'定位',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.getSelection()?.toString())).toBe('这是中文输入测试');await page.getByRole('button',{name:'加粗',exact:true}).click();
  expect(await editor.locator('strong').textContent()).toBe('这是中文输入测试');
  await proposal.getByRole('button',{name:'接受本条并立即生效'}).click();
  // Background status polling can report accepted before the editor readback arrives.
  await expect.poll(()=>proposal.getByRole('heading').textContent()).toContain('已采纳');
  if(mode==='keyboard'){
   await editor.focus();await page.keyboard.press(process.platform==='darwin'?'Meta+z':'Control+z');
   expect(await editor.locator('strong').textContent()).toBe('这是中文输入测试');
  }
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  expect.soft(await editor.locator('strong').count()).toBe(1);
  await new Promise(resolve=>setTimeout(resolve,2800));
  await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');
  expect(await page.getByRole('button',{name:'确认以正式版本为基线保存我的输入'}).count()).toBe(0);
  const formal=await call('resume',{operation:'resume.read',resumeId:opened.document.id});
  expect.soft(formal.document.content.sections[0].blocks).toHaveLength(1);
  expect.soft(formal.document.content.sections.at(-1).blocks[0].spans).toEqual([{text:'蒸牛蛙，',marks:[]},{text:'这是中文输入测试',marks:[{type:'bold'}]},{text:' abc123',marks:[]}]);
  expect(await proposal.getByRole('heading').textContent()).toContain('已采纳');
  const tasks=await call('ai',{operation:'product.list'});expect(tasks.tasks[0].proposals.find((p:any)=>p.change.kind==='resume-add').state).toBe('accepted');
 }finally{await browser?.close();await server.close();await runtime.close();await rm(root,{recursive:true,force:true});await rm(ui,{recursive:true,force:true});}
},45000);

import {it,expect} from 'vitest';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRuntimeBackend} from '../packages/backend/bootstrap/runtime';

it('AI reconciliation adopts concurrent identity alignment and keeps it after undo and further typing',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-alignment-remote-ui-')),ui=path.resolve('dist/alignment-remote-ui');await mkdir(ui,{recursive:true});
 const runtime=await createRuntimeBackend(path.join(root,'workspaces/local'),path.resolve('dist/application/writer.cjs'),root);
 const human=await runtime.connectHuman();const call=(module:Parameters<typeof runtime.business>[1],input:unknown)=>runtime.business(human,module,input) as Promise<any>;

 const company=(await call('opportunity',{operation:'company.create',commandId:randomUUID(),name:'Undo race'})).company;
 const opportunity=(await call('opportunity',{operation:'create',commandId:randomUUID(),companyId:company.id,role:'Resume'})).opportunity;
 const opened=await call('resume',{operation:'resume.open',commandId:randomUUID(),opportunityId:opportunity.id});
 const content=structuredClone(opened.document.content);content.sections[0].blocks[0].spans=[{text:'Controlled delivery experience.',marks:[]}];
 await call('resume',{operation:'resume.save',commandId:randomUUID(),resumeId:opened.document.id,expectedRevision:1,expectedProfileRevision:0,content});
 await writeFile(path.join(ui,'index.html'),'<html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(ui,'main.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{ResumePage}from'../../packages/frontend/features/resume/index.tsx';window.career={developmentDiagnostics:true,request:async(module,input)=>{const r=await fetch('/owner',{method:'POST',body:JSON.stringify({module,input})});if(!r.ok)throw Error('transport');return r.json();}};window.careerMaterials={request:async()=>({kind:'list',items:[]})};createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}><ResumePage opportunityId="${opportunity.id}" request={input=>window.career.request('resume',input)} profileRequest={input=>window.career.request('profile',input)}/></QueryClientProvider>);`);
 const server=await createServer({configFile:false,root:ui,cacheDir:path.join(ui,'.vite'),plugins:[{name:'owner-read-latency',configureServer(server){server.middlewares.use('/owner',(req,res)=>{let body='';req.on('data',chunk=>body+=chunk);req.on('end',async()=>{try{const {module,input}=JSON.parse(body);const result=await call(module,input);res.setHeader('content-type','application/json');res.end(JSON.stringify(result));}catch{res.statusCode=500;res.end();}});});}}],server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd()]}}});
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try{
  await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error('port');browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(10000);await page.goto('http://127.0.0.1:'+address.port);
  const editor=page.getByRole('textbox',{name:'简历正文'});await editor.waitFor();
  await page.getByLabel('简历更多',{exact:true}).click();await page.getByRole('button',{name:'简历优化提案',exact:true}).click();const selection=page.getByLabel('简历优化选择');await selection.getByLabel(/个人简介 · Controlled delivery/).check();const ai=selection.getByRole('region',{name:'产品任务辅助'});
  await ai.getByRole('button',{name:'准备外发预览'}).click();await ai.getByRole('button',{name:'授权这份最终请求'}).click();const proposal=ai.getByRole('article',{name:'产品待审提案'}).filter({has:page.getByRole('heading',{name:/^增加简历内容/})});await proposal.waitFor();
  const remote=await call('resume',{operation:'resume.read',resumeId:opened.document.id});const changed=structuredClone(remote.document.content);changed.layout.identityNameAlignment='right';
  await call('resume',{operation:'resume.save',commandId:randomUUID(),resumeId:opened.document.id,expectedRevision:remote.document.revision,expectedProfileRevision:remote.profile.revision,content:changed});
  await proposal.getByRole('button',{name:'接受本条并立即生效'}).click();await page.getByText('仅选定区块的提案已生效，可独立撤销；其他输入保留。',{exact:true}).waitFor();
  const identity=page.getByTestId('resume-name-layout');expect(await identity.evaluate(el=>getComputedStyle(el).textAlign)).toBe('right');
  await page.getByRole('button',{name:'撤销',exact:true}).click();expect(await identity.evaluate(el=>getComputedStyle(el).textAlign)).toBe('right');
  await editor.locator('p').last().click();await page.keyboard.type('Local continuation after AI Undo.');await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');
  const formal=await call('resume',{operation:'resume.read',resumeId:opened.document.id});expect(formal.document.content.layout.identityNameAlignment).toBe('right');
 }finally{await browser?.close();await server.close();await runtime.close();await rm(root,{recursive:true,force:true});await rm(ui,{recursive:true,force:true});}
},45000);

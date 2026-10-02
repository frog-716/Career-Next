import {it,expect} from 'vitest';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import Database from 'better-sqlite3';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createOpportunityDomain} from '../packages/backend/domains/opportunity/public';
import {opportunityMigration} from '../packages/backend/domains/opportunity/migration';
import {commandMigration} from '../packages/backend/platform/commands/receipts';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {Request} from '../packages/contracts/opportunity/schema';
it('Company conflict keeps the draft through public read/revision retry and dirty or unknown UI protects leaving',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-opportunity-ui-'));const ui=path.resolve('dist/opportunity-ui-test');await mkdir(ui,{recursive:true});const db=new Database(path.join(root,'career.sqlite'));db.exec(commandMigration);db.exec(opportunityMigration);const owner=createOpportunityDomain(db);const created=owner.handle({operation:'company.create',commandId:crypto.randomUUID(),name:'原公司名'});if(created.kind!=='company')throw Error('fixture failed');
 await writeFile(path.join(ui,'index.html'),'<html><body><div id="app"></div><script type="module" src="/main.tsx"></script></body></html>');
 await writeFile(path.join(ui,'main.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import{OpportunityPage}from'../../packages/frontend/features/opportunity/index.tsx';createRoot(document.getElementById('app')!).render(<OpportunityPage request={async input=>{const response=await fetch('/test-owner',{method:'POST',body:JSON.stringify(input)});if(!response.ok)throw Error('lost');return response.json();}}/>);`);
 let release:(()=>void)|undefined;let delayed=false;let drop=false;

 const middleware=(req:IncomingMessage,res:ServerResponse)=>{let body='';req.on('data',chunk=>{body+=String(chunk);});req.on('end',()=>{void (async()=>{const input=Request.parse(JSON.parse(body));if(input.operation==='company.rename'&&delayed){await new Promise<void>(resolve=>{release=resolve;});delayed=false;}const result=owner.handle(input);if(drop&&input.operation==='company.rename'){drop=false;res.statusCode=503;res.end();return;}res.setHeader('content-type','application/json');res.end(JSON.stringify(result));})().catch(()=>{res.statusCode=500;res.end();});});};
 const server=await createServer({configFile:false,root:ui,plugins:[{name:'opportunity-owner-test',configureServer(server){server.middlewares.use('/test-owner',middleware);}}],server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd()]}}});
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try{
  await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error('port failed');browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.setDefaultTimeout(5000);page.on('pageerror',error=>{console.error(error.message);});await page.goto(`http://127.0.0.1:${address.port}`);await page.getByRole('button',{name:'原公司名',exact:true}).click();
  const name=page.getByLabel('公司名称',{exact:true});await name.fill('我的名称草稿');
  owner.handle({operation:'company.rename',commandId:crypto.randomUUID(),id:created.company.id,expectedRevision:1,name:'另一窗口已改名'});
  await page.getByRole('button',{name:'保存公司改名',exact:true}).click();await page.getByRole('complementary',{name:'公司改名冲突比较'}).waitFor();expect(await name.inputValue()).toBe('我的名称草稿');expect(await page.getByRole('complementary',{name:'公司改名冲突比较'}).textContent()).toContain('另一窗口已改名');
  await page.getByRole('button',{name:'采用公司新基线并保留名称草稿'}).click();expect(await name.inputValue()).toBe('我的名称草稿');
  delayed=true;await page.getByRole('button',{name:'保存公司改名',exact:true}).click();await page.waitForFunction(()=>document.querySelector<HTMLInputElement>('input[name="name"]')?.disabled||document.querySelector<HTMLInputElement>('input[name="name"]')?.closest('fieldset')?.disabled);expect(await name.isDisabled()).toBe(true);await expect.poll(()=>typeof release).toBe('function');release?.();await page.getByRole('status').filter({hasText:'公司已保存'}).waitFor();expect(owner.handle({operation:'company.read',id:created.company.id})).toMatchObject({kind:'company',company:{name:'我的名称草稿',revision:3}});
  await name.fill('尚未提交');expect(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});return !window.dispatchEvent(event);})).toBe(true);
  drop=true;await page.getByRole('button',{name:'保存公司改名',exact:true}).click();await page.getByRole('status').filter({hasText:'保存结果待核对'}).waitFor();expect(await name.isDisabled()).toBe(true);expect(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});return !window.dispatchEvent(event);})).toBe(true);
  await page.getByRole('button',{name:'核对原保存回执'}).click();await page.getByRole('status').filter({hasText:'公司已保存'}).waitFor();expect(await name.inputValue()).toBe('尚未提交');
  await page.getByLabel('明确选择公司').selectOption(created.company.id);await page.getByLabel('岗位名称',{exact:true}).fill('人工岗位');expect(await page.evaluate(()=>!window.dispatchEvent(new Event('beforeunload',{cancelable:true})))).toBe(true);await page.getByRole('button',{name:'创建机会',exact:true}).click();await page.getByRole('button',{name:'登记真实阶段事件'}).waitFor();
  await page.getByLabel('变化说明',{exact:true}).fill('尚未提交的实际阶段说明');expect(await page.evaluate(()=>!window.dispatchEvent(new Event('beforeunload',{cancelable:true})))).toBe(true);await page.getByRole('button',{name:'登记真实阶段事件'}).click();await page.getByRole('status').filter({hasText:'已保存'}).waitFor();expect(owner.handle({operation:'list'})).toMatchObject({kind:'opportunities',items:[{phase:'interview',result:'active'}]});
  await page.getByLabel('变化说明',{exact:true}).fill('尚未提交的退出说明');expect(await page.evaluate(()=>!window.dispatchEvent(new Event('beforeunload',{cancelable:true})))).toBe(true);
 }finally{release?.();await browser?.close();await server.close();db.close();await rm(root,{recursive:true,force:true});await rm(ui,{recursive:true,force:true});}
},30000);

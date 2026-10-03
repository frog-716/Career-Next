import {it,expect} from 'vitest';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import Database from 'better-sqlite3';
import {mkdir,writeFile,rm,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {createWikiDomain} from '../packages/backend/domains/wiki/public';
import {wikiMigration} from '../packages/backend/domains/wiki/migration';
import {commandMigration} from '../packages/backend/platform/commands/receipts';

it('Wiki late reopen cannot erase input typed while the actual owner read is in flight',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'career-g6-wiki-'));
 const ui=path.resolve('dist/g6-wiki-read');await mkdir(ui,{recursive:true});
 const db=new Database(path.join(root,'career.sqlite'));db.exec(commandMigration+wikiMigration);
 const wiki=createWikiDomain(db,{resolveSource:()=>undefined});
 const created=wiki.handle({operation:'create',commandId:randomUUID(),scope:'personal',title:'G6 saved knowledge',body:'Saved body',nature:'observation',sources:[]});
 if(created.kind!=='knowledge')throw Error('fixture_failed');
 let block=false,waiting=false,release:(()=>void)|undefined;
 await writeFile(path.join(ui,'index.html'),'<div id="app"></div><script type="module" src="/main.tsx"></script>');
 await writeFile(path.join(ui,'main.tsx'),`import React from'react';import{createRoot}from'react-dom/client';import{WikiPage}from'../../packages/frontend/features/wiki/index.tsx';createRoot(document.getElementById('app')!).render(<WikiPage request={async input=>{const r=await fetch('/owner',{method:'POST',body:JSON.stringify(input)});return r.json();}}/>);`);
 const server=await createServer({configFile:false,root:ui,cacheDir:path.join(ui,'.vite'),plugins:[{name:'g6-wiki-owner',configureServer(s){s.middlewares.use('/owner',(req,res)=>{let body='';req.on('data',c=>body+=String(c));req.on('end',async()=>{try{const input=JSON.parse(body),result=wiki.handle(input);if(block&&input.operation==='read'){waiting=true;await new Promise<void>(resolve=>{release=resolve;});}res.setHeader('content-type','application/json');res.end(JSON.stringify(result));}catch{res.statusCode=500;res.end();}});});}}],server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd()]}}});
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try{
  await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error();
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.setDefaultTimeout(6000);
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.getByRole('button',{name:'G6 saved knowledge',exact:true}).click();
  await expect.poll(()=>page.getByLabel('知识正文',{exact:true}).inputValue()).toBe('Saved body');
  block=true;await page.getByRole('button',{name:'G6 saved knowledge',exact:true}).click();
  await expect.poll(()=>waiting).toBe(true);
  await page.getByLabel('知识正文',{exact:true}).press('End');
  await page.getByLabel('知识正文',{exact:true}).pressSequentially(' human input during read');
  release!();
  await expect.poll(()=>page.getByRole('status').textContent()).not.toContain('读取中');
  await page.waitForTimeout(250);
  expect(await page.getByLabel('知识正文',{exact:true}).inputValue()).toBe('Saved body human input during read');
  await page.getByLabel('变化说明',{exact:true}).fill('Keep the independently typed input');
  await page.getByRole('button',{name:'保存知识修改',exact:true}).click();
  await expect.poll(()=>wiki.handle({operation:'read',id:created.knowledge.id})).toMatchObject({kind:'knowledge',knowledge:{body:'Saved body human input during read'}});
 }finally{release?.();await browser?.close();await server.close();db.close();await rm(root,{recursive:true,force:true});await rm(ui,{recursive:true,force:true});}
},30000);

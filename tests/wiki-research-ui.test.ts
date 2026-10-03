import { it, expect } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import Database from 'better-sqlite3';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createOpportunityDomain } from '../packages/backend/domains/opportunity/public';
import { opportunityMigration } from '../packages/backend/domains/opportunity/migration';
import { createResearchDomain } from '../packages/backend/domains/opportunity/research/public';
import { researchMigration } from '../packages/backend/domains/opportunity/research/migration';
import { commandMigration } from '../packages/backend/platform/commands/receipts';

it('Wiki reads the same stable Research item before and after promotion, provides owner navigation and no competing body editor',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-wiki-research-')),ui=await mkdtemp(path.resolve('dist/wiki-research-ui-'));
 const db=new Database(path.join(root,'career.sqlite'));db.pragma('foreign_keys=ON');db.exec(commandMigration+opportunityMigration+researchMigration);
 const core=createOpportunityDomain(db);const research=createResearchDomain(db,{core:core.capabilities});
 const c=core.handle({operation:'company.create',commandId:crypto.randomUUID(),name:'Reference Company'});if(c.kind!=='company')throw Error('fixture failed');
 const o=core.handle({operation:'create',commandId:crypto.randomUUID(),companyId:c.company.id,role:'Reference Role'});if(o.kind!=='opportunity')throw Error('fixture failed');
 const owner={kind:'opportunity',id:o.opportunity.id};const item=research.handle({operation:'create',commandId:crypto.randomUUID(),owner,title:'One owned statement',body:'Role has overseas responsibilities',nature:'fact_statement',sources:[],leads:[],userConfirmed:true,independentlyVerified:false});if(item.kind!=='item')throw Error('fixture item failed');
 await writeFile(path.join(ui,'main.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import{WikiResearchReferences}from'../../packages/frontend/features/wiki/research.tsx';createRoot(document.getElementById('root')!).render(<WikiResearchReferences opportunityRequest={async input=>(await fetch('/owner/opportunity',{method:'POST',body:JSON.stringify(input)})).json()} researchRequest={async input=>(await fetch('/owner/research',{method:'POST',body:JSON.stringify(input)})).json()} onOpenOwner={id=>{document.getElementById('navigation').textContent=id;}}/>);`);
 await writeFile(path.join(ui,'index.html'),'<div id="root"></div><p id="navigation"></p><script type="module" src="/main.tsx"></script>');
 const writes:string[]=[];
 const server=await createServer({configFile:false,root:ui,cacheDir:path.join(ui,'.vite'),plugins:[{name:'real-public-owners',configureServer(server){server.middlewares.use('/owner',(req,res)=>{let body='';req.on('data',chunk=>body+=String(chunk));req.on('end',()=>{try{const input=JSON.parse(body) as {operation:string};if(!['list','read','resolve'].includes(input.operation))writes.push(input.operation);const result=req.url==='/research'?research.handle(input):core.handle(input);res.setHeader('content-type','application/json');res.end(JSON.stringify(result));}catch{res.statusCode=500;res.end();}});});}}],server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd()]}}});
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 try{
  await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error('port failed');browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.setDefaultTimeout(5000);await page.goto('http://127.0.0.1:'+address.port);
  await page.getByLabel('查看哪个机会的研究引用').selectOption(o.opportunity.id);await page.getByText('Role has overseas responsibilities',{exact:true}).waitFor();
  expect(await page.locator('textarea,[contenteditable=true]').count()).toBe(0);
  const promoted=research.handle({operation:'promote',commandId:crypto.randomUUID(),id:item.item.id,owner,expectedRevision:1,companyId:c.company.id,expectedCompanyDocumentRevision:0,sharingConfirmed:true,reason:'明确共享',businessTime:{kind:'unknown'}});expect(promoted.kind).toBe('item');
  await page.getByRole('button',{name:'刷新研究引用'}).click();await page.getByText('公司研究（唯一正文）',{exact:true}).waitFor();expect(await page.getByText('Role has overseas responsibilities',{exact:true}).count()).toBe(1);
  await page.getByRole('button',{name:'到所属机会编辑研究正本'}).click();await expect.poll(()=>page.locator('#navigation').textContent()).toBe(o.opportunity.id);expect(writes).toEqual([]);
 }finally{await browser?.close();await server.close();db.close();await rm(root,{recursive:true,force:true});await rm(ui,{recursive:true,force:true});}
},30000);

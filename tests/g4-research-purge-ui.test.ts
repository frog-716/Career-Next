import {expect,it} from 'vitest';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {openWorkspace} from '../packages/backend/platform/database/database';
import {materialsMigration} from '../packages/backend/domains/materials/migration';
import {releases} from '../packages/backend/bootstrap/releases';
import {createWriterCommands} from '../packages/backend/bootstrap/writer-commands';
import {Result as OpportunityResult} from '../packages/contracts/opportunity/schema';
import {Result as ResearchResult} from '../packages/contracts/opportunity/research/schema';
import {Result as DataResult} from '../packages/contracts/application/schema';

const cases=(['research','opportunity','company'] as const).flatMap(purgeOwner=>[false,true].map(lateRead=>({purgeOwner,lateRead})));
it.each(cases)('the real Research UI clears $purgeOwner bodies (delayed read: $lateRead)',async({purgeOwner,lateRead})=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g4-research-purge-'));
 const ui=await mkdtemp(path.resolve('tests/.g4-research-review-ui-'));
 const workspace=await openWorkspace(root,materialsMigration,releases);
 let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
 let releaseLate:(()=>void)|undefined;
 let holdNext=false,lateCaptured=false;
 const commands=createWriterCommands(workspace.database,workspace.workspaceInstance,randomUUID(),{dataRoot:root,control:{maintenance:async work=>work(),drain:async()=>{},beforeActivate:async()=>{},closeWorkspace:()=>{throw Error('not_requested');}}});
 const session=commands.connect();
 const company=OpportunityResult.parse(await commands.business(session,'opportunity',{operation:'company.create',commandId:randomUUID(),name:'真实研究公司'}));
 if(company.kind!=='company')throw Error('company_failed');
 const opportunity=OpportunityResult.parse(await commands.business(session,'opportunity',{operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'研究引用机会'}));
 if(opportunity.kind!=='opportunity')throw Error('opportunity_failed');
 const researchOwner=purgeOwner==='company'?{kind:'company',id:company.company.id}:{kind:'opportunity',id:opportunity.opportunity.id};
 const body='PRIVATE_RESEARCH_BODY_MUST_DISAPPEAR';
 const research=ResearchResult.parse(await commands.business(session,'research',{operation:'create',commandId:randomUUID(),owner:researchOwner,title:'真实只读研究',body,nature:'inference',sources:[],leads:[],userConfirmed:false,independentlyVerified:false}));
 if(research.kind!=='item')throw Error('research_failed');
 const reference={owner:purgeOwner,objectId:purgeOwner==='research'?research.item.id:purgeOwner==='company'?company.company.id:opportunity.opportunity.id};
 await writeFile(path.join(ui,'index.html'),'<div id="app"></div><script type="module" src="/main.tsx"></script>');
 await writeFile(path.join(ui,'main.tsx'),`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{WikiResearchReferences}from ${JSON.stringify(path.resolve('packages/frontend/features/wiki/research.tsx'))};const request=async(module,input)=>(await fetch('/owner',{method:'POST',body:JSON.stringify({module,input})})).json();function App(){const[notice,setNotice]=useState();return <><button onClick={async()=>setNotice(await request('purge',{}))}>清除已选研究范围</button><p data-testid="notice-ready">{notice?.sequence??0}</p><WikiResearchReferences purgeNotice={notice} opportunityRequest={input=>request('opportunity',input)} researchRequest={input=>request('research',input)} onOpenOwner={()=>{}}/></>};createRoot(document.getElementById('app')).render(<App/>);`);
 const server=await createServer({configFile:false,root:ui,cacheDir:path.join(ui,'.vite'),optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','react/jsx-dev-runtime','zod']},plugins:[{name:'actual-research-owners',configureServer(server){server.middlewares.use('/owner',(req,res)=>{let content='';req.on('data',chunk=>content+=String(chunk));req.on('end',()=>void(async()=>{
  const payload=JSON.parse(content) as {module:'opportunity'|'research'|'purge';input:{operation:string;owner?:{kind:string;id:string}}};
  let result:unknown;
  if(payload.module==='purge'){
   const planned=DataResult.parse(await commands.business(session,'application',{operation:'data.purge.plan',references:[reference]}));
   if(planned.kind!=='purge_plan')throw Error('plan_failed');
   const purged=DataResult.parse(await commands.business(session,'application',{operation:'data.purge.confirm',planId:planned.plan.id,selectedCopyIds:planned.plan.copies.map(copy=>copy.id),confirmed:true}));
   if(purged.kind!=='purged')throw Error('purge_failed');
   result={sequence:1,references:planned.plan.impact.references};
  }else{
   result=await commands.business(session,payload.module,payload.input);
   if(holdNext&&payload.module==='research'&&payload.input.operation==='read'&&payload.input.owner?.kind===researchOwner.kind){holdNext=false;lateCaptured=true;await new Promise<void>(resolve=>{releaseLate=resolve;});res.setHeader('x-review-late','1');}
  }
  res.setHeader('content-type','application/json');res.end(JSON.stringify(result));
 })().catch(()=>{res.statusCode=500;res.end();}));});}}],server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd(),ui]}}});
 try{
  await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error('listen_failed');
  browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();page.setDefaultTimeout(8000);
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.getByLabel('查看哪个机会的研究引用').selectOption(opportunity.opportunity.id);
  await page.getByText(body,{exact:true}).waitFor();
  if(lateRead){holdNext=true;await page.getByRole('button',{name:'刷新研究引用',exact:true}).click();await expect.poll(()=>lateCaptured).toBe(true);}
  await page.getByRole('button',{name:'清除已选研究范围'}).click();
  await expect.poll(async()=>{const state=DataResult.parse(await commands.business(session,'application',{operation:'data.status'}));return state.kind==='data_status'?state.pendingPurgeCount:-1;}).toBe(0);
  await expect.poll(()=>page.getByTestId('notice-ready').textContent()).toBe('1');
  await expect.poll(()=>page.getByText(body,{exact:true}).count()).toBe(0);
  if(lateRead){const lateResponse=page.waitForResponse(response=>response.headers()['x-review-late']==='1');releaseLate?.();await lateResponse;}
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  expect(await page.getByText(body,{exact:true}).count()).toBe(0);
  if(purgeOwner==='opportunity')expect(await page.getByLabel('查看哪个机会的研究引用').inputValue()).toBe('');
  const current=ResearchResult.parse(await commands.business(session,'research',{operation:'resolve',id:research.item.id,viewer:researchOwner}));
  expect(current.kind).toBe('failure');
 }finally{releaseLate?.();await browser?.close();await server.close();workspace.close();await rm(ui,{recursive:true,force:true});await rm(root,{recursive:true,force:true});}
},30000);

import {beforeAll,afterAll,it,expect} from 'vitest';
import {build} from 'vite';
import {chromium,type Browser,type Page} from 'playwright';
import path from 'node:path';
import {writeFileSync,rmSync} from 'node:fs';
const entry=path.resolve('tests/.employment-session-entry.tsx');
let browser:Browser;
let script:string;
beforeAll(async()=>{
 writeFileSync(entry,'');
 const output=await build({configFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},plugins:[{
  name:'employment-session-test',resolveId(id){return id===entry?entry:undefined;},
  load(id){return id===entry?`
   import React from 'react';
   import {createRoot} from 'react-dom/client';
   import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
   import {EmploymentPage} from ${JSON.stringify(path.resolve('packages/frontend/features/employment/index.tsx'))};
   const employment={id:'00000000-0000-4000-8000-000000000001',revision:1,company:'Test company',role:'Engineer',goal:'Original goal',status:'current',start:{kind:'unknown'},plannedEnd:{kind:'unknown'},actualEnd:{kind:'unknown'},recordedAt:'2026-10-02T00:00:00.000Z'};
   const records=location.hash==='#existing'?[employment]:[];
   const people=[];
   let release;
   window.endCommands=0;window.editCommands=0;
   window.releaseSave=()=>release();
   const request=async(input)=>{
    if(input.operation==='list')return {kind:'list',employments:records};
    if(input.operation==='read')return {kind:'employment',employment:records.find(item=>item.id===input.id),people:[...people]};
    if(input.operation==='create'){
     await new Promise(resolve=>{release=resolve;});
     const created={...employment,company:input.company,role:input.role,goal:input.goal};records.push(created);
     return {kind:'employment',employment:created,people:[]};
    }
    if(input.operation==='person.create'){
     await new Promise(resolve=>{release=resolve;});
     const person={id:'00000000-0000-4000-8000-000000000002',employmentId:employment.id,name:input.name,role:input.role,revision:1,recordedAt:'2026-10-02T00:00:00.000Z'};people.push(person);
     return {kind:'person',person};
    }
    if(input.operation==='end'||input.operation==='reopen'){window.endCommands++;window.lastEnd=input;}
    if(input.operation==='edit')window.editCommands++;
    return {kind:'failure',code:'invalid_transition'};
   };
   createRoot(document.getElementById('root')).render(React.createElement(QueryClientProvider,{client:new QueryClient()},React.createElement(EmploymentPage,{request})));
  `:undefined;},
 }],build:{write:false,lib:{entry,name:'EmploymentFixture',formats:['iife']}}});
 const bundles=Array.isArray(output)?output:[output];
 script=bundles.flatMap(item=>'output' in item?item.output:[]).filter(item=>item.type==='chunk').map(item=>item.code).join('\n');
 browser=await chromium.launch({headless:true});
},20000);
afterAll(async()=>{await browser?.close();rmSync(entry,{force:true});});
async function page(existing=false):Promise<Page>{
 const page=await browser.newPage();
 page.setDefaultTimeout(2000);
 await page.route('https://career-session.test/**',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
 await page.goto('https://career-session.test/'+(existing?'#existing':''));
 await page.addScriptTag({content:script});
 return page;
}
it('pending employment creation locks draft fields until its delayed response completes',async()=>{
 const p=await page();try{
  await p.getByRole('button',{name:'新增任职',exact:true}).click();
  const form=p.getByRole('button',{name:'创建任职',exact:true}).locator('..');
  await form.getByLabel('公司',{exact:true}).fill('New company');await form.getByLabel('岗位',{exact:true}).fill('Engineer');
  await form.getByLabel('我确认已经真实开始这段任职').check();
  await form.getByRole('button',{name:'创建任职',exact:true}).click();
  await p.getByText('保存中',{exact:true}).waitFor();
  expect(await form.getByLabel('公司',{exact:true}).isDisabled()).toBe(true);
  expect(await form.getByLabel('岗位',{exact:true}).isDisabled()).toBe(true);
  await p.evaluate(()=>{(window as unknown as {releaseSave():void}).releaseSave();});
  await p.getByRole('heading',{name:'New company · Engineer'}).waitFor();
 }finally{await p.close();}
});
it('pending person creation locks its own draft and never resets the employment draft',async()=>{
 const p=await page(true);try{
  await p.getByRole('button',{name:'Test company · Engineer · 当前'}).click();
  const goal=p.getByLabel('当前目标',{exact:true}).filter({visible:true});await goal.fill('Unsaved goal');
  const form=p.getByRole('heading',{name:'新增人物（同名不会合并）'}).locator('..');
  await form.getByLabel('姓名',{exact:true}).fill('Person');await form.getByLabel('任职角色',{exact:true}).fill('Reviewer');await form.getByRole('button',{name:'保存人物',exact:true}).click();
  await p.getByText('保存中',{exact:true}).waitFor();
  expect(await form.getByLabel('姓名',{exact:true}).isDisabled()).toBe(true);
  expect(await form.getByLabel('任职角色',{exact:true}).isDisabled()).toBe(true);
  await p.evaluate(()=>{(window as unknown as {releaseSave():void}).releaseSave();});
  await p.getByRole('heading',{name:'维护人物'}).waitFor();
  expect(await goal.inputValue()).toBe('Unsaved goal');
 }finally{await p.close();}
});
it('lifecycle action refuses to clear an unsaved role or goal',async()=>{
 const p=await page(true);try{
  await p.getByRole('button',{name:'Test company · Engineer · 当前'}).click();
  const goal=p.getByLabel('当前目标',{exact:true}).filter({visible:true});await goal.fill('Unsaved goal');
  await p.getByLabel('变化说明',{exact:true}).filter({visible:true}).fill('Real ending');
  await p.getByRole('button',{name:'确认任职已真实结束'}).click();
  await p.getByText('请先保存任职内容，再执行结束或恢复；当前输入仍保留。',{exact:true}).waitFor();
  expect(await goal.inputValue()).toBe('Unsaved goal');
  expect(await p.evaluate(()=>(window as unknown as {endCommands:number}).endCommands)).toBe(0);
 }finally{await p.close();}
});

it('ordinary current-employment save cannot discard a drafted actual end date',async()=>{
 const p=await page(true);try{
  await p.getByRole('button',{name:'Test company · Engineer · 当前'}).click();
  await p.getByLabel('实际结束类型',{exact:true}).selectOption('date');
  const endDate=p.getByLabel('实际结束',{exact:true});await endDate.fill('2024-03-04');
  await p.getByLabel('变化说明',{exact:true}).filter({visible:true}).fill('Actually ended');
  await p.getByRole('button',{name:'保存任职',exact:true}).click();
  await p.getByText('请使用“确认任职已真实结束”提交实际结束日期；当前输入仍保留。',{exact:true}).waitFor();
  expect(await endDate.inputValue()).toBe('2024-03-04');
  expect(await p.evaluate(()=>(window as unknown as {editCommands:number}).editCommands)).toBe(0);
  await p.getByRole('button',{name:'确认任职已真实结束'}).click();
  expect(await p.evaluate(()=>(window as unknown as {lastEnd:{actualEnd:unknown}}).lastEnd.actualEnd)).toEqual({kind:'date',date:'2024-03-04'});
 }finally{await p.close();}
});

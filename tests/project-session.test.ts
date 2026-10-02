import {beforeAll,afterAll,it,expect} from 'vitest';
import {build} from 'vite';
import {chromium,type Browser,type Page} from 'playwright';
import {writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
const entry=path.resolve('tests/.project-session-entry.tsx');
let browser:Browser;let script:string;
beforeAll(async()=>{
 writeFileSync(entry,'');
 const output=await build({configFile:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},plugins:[{
  name:'project-session-test',resolveId(id){return id===entry?entry:undefined;},load(id){return id===entry?`
   import React,{useState} from 'react';
   import {createRoot} from 'react-dom/client';
   import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
   import {ProjectPage} from ${JSON.stringify(path.resolve('packages/frontend/features/project/index.tsx'))};
   let project={id:'00000000-0000-4000-8000-000000000001',contextId:'00000000-0000-4000-8000-000000000002',employmentId:'00000000-0000-4000-8000-000000000003',revision:1,name:'Existing project',description:'Original description',tags:[],state:'inprogress',stateNote:'',recordedAt:'2026-10-02T00:00:00.000Z'};
   let company='Original company';
   const employment=()=>({id:project.employmentId,company,role:'Engineer',status:'current',revision:1});
   const records=location.hash==='#existing'?[project]:[];
   let release;window.releaseSave=()=>release();window.nonBodyCommands=0;
   const view=()=>({kind:'project',project,employment:project.employmentId?employment():null,participants:project.employmentId?[{id:'00000000-0000-4000-8000-000000000005',projectId:project.id,contextId:project.contextId,employmentId:project.employmentId,personId:'00000000-0000-4000-8000-000000000004',projectRole:'Original project role',active:true,recordedAt:'2026-10-02T00:00:00.000Z',person:{id:'00000000-0000-4000-8000-000000000004',employmentId:project.employmentId,name:'Confirmed person',role:'Manager',revision:1},employment:employment()}]:[]});
   const request=async(input)=>{
    if(input.operation==='list')return {kind:'list',projects:records.map(item=>({...item,employment:item.employmentId?employment():null}))};
    if(input.operation==='read')return view();
    if(input.operation==='create'){
     await new Promise(resolve=>{release=resolve;});project={...project,name:input.name,description:input.description,tags:input.tags,employmentId:input.employmentId};records.push(project);return view();
    }
    if(input.operation==='state.change'){
     window.nonBodyCommands++;await new Promise(resolve=>{release=resolve;});project={...project,state:input.state,revision:2,stateNote:input.reason};records[0]=project;return view();
    }
    window.nonBodyCommands++;return {kind:'failure',code:'invalid_transition'};
   };
   const employmentRequest=async(input)=>input.operation==='list'?{kind:'list',employments:[{...employment(),goal:'',start:{kind:'unknown'},plannedEnd:{kind:'unknown'},actualEnd:{kind:'unknown'},recordedAt:'2026-10-02T00:00:00.000Z'}]}:{kind:'employment',employment:{...employment(),goal:'',start:{kind:'unknown'},plannedEnd:{kind:'unknown'},actualEnd:{kind:'unknown'},recordedAt:'2026-10-02T00:00:00.000Z'},people:[{id:'00000000-0000-4000-8000-000000000004',employmentId:project.employmentId,name:'Confirmed person',role:'Manager',revision:1,recordedAt:'2026-10-02T00:00:00.000Z'}]};
   const client=new QueryClient();
   function Fixture(){const [epoch,setEpoch]=useState(0);return React.createElement(QueryClientProvider,{client},React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>{company='Changed company';setEpoch(value=>value+1);}},'Refresh employment relation'),React.createElement(ProjectPage,{request,employmentRequest,relationEpoch:epoch})));}
   createRoot(document.getElementById('root')).render(React.createElement(Fixture));
  `:undefined;},
 }],build:{write:false,lib:{entry,name:'ProjectFixture',formats:['iife']}}});
 const bundles=Array.isArray(output)?output:[output];script=bundles.flatMap(item=>'output' in item?item.output:[]).filter(item=>item.type==='chunk').map(item=>item.code).join('\n');
 browser=await chromium.launch({headless:true});
},20000);
afterAll(async()=>{await browser?.close();rmSync(entry,{force:true});});
async function page(existing=false):Promise<Page>{
 const p=await browser.newPage();p.setDefaultTimeout(2500);
 await p.route('https://career-project-session.test/**',route=>route.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
 await p.goto('https://career-project-session.test/'+(existing?'#existing':''));await p.addScriptTag({content:script});return p;
}
it('delayed project creation locks all draft fields until the saved result is known',async()=>{
 const p=await page();try{
  await p.getByRole('button',{name:'新增项目',exact:true}).click();
  const form=p.getByRole('button',{name:'创建项目',exact:true}).locator('..');await form.getByLabel('项目名称',{exact:true}).fill('New project');await form.getByRole('button',{name:'创建项目',exact:true}).click();
  await p.getByText('保存中',{exact:true}).waitFor();expect(await form.getByLabel('项目名称',{exact:true}).isDisabled()).toBe(true);expect(await form.getByLabel('描述',{exact:true}).isDisabled()).toBe(true);
  await p.evaluate(()=>{(window as unknown as {releaseSave():void}).releaseSave();});await p.getByRole('heading',{name:'New project'}).waitFor();
 }finally{await p.close();}
});
it('state, association and collaboration actions cannot silently save or clear unrelated content drafts',async()=>{
 const p=await page(true);try{
  await p.getByRole('button',{name:'Existing project · 进行中 · Original company'}).click();
  const name=p.getByLabel('项目名称',{exact:true}).filter({visible:true});await name.fill('Unsaved project name');await p.getByLabel('变化说明',{exact:true}).fill('Real event');
  await p.getByRole('button',{name:'记录状态变化或纠错'}).click();
  await p.getByText('请先保存项目内容，再执行状态、关联或协作动作；当前输入仍保留。',{exact:true}).waitFor();
  await p.getByRole('button',{name:'确认变更任职关联'}).click();await p.getByLabel('当前任职人物',{exact:true}).selectOption({label:'Confirmed person · Manager · 第1位'});await p.getByRole('button',{name:'确认加入或重新加入项目'}).click();
  expect(await name.inputValue()).toBe('Unsaved project name');expect(await p.evaluate(()=>(window as unknown as {nonBodyCommands:number}).nonBodyCommands)).toBe(0);
 }finally{await p.close();}
});
it('employment relation epoch refreshes live projection while preserving project content drafts',async()=>{
 const p=await page(true);try{
  await p.getByRole('button',{name:'Existing project · 进行中 · Original company'}).click();
  const name=p.getByLabel('项目名称',{exact:true}).filter({visible:true});const description=p.getByLabel('描述',{exact:true}).filter({visible:true});await name.fill('Unsaved project name');await description.fill('Unsaved description');
  await p.getByRole('button',{name:'Refresh employment relation'}).click();
  await p.getByText(/当前归属：Changed company · Engineer/).waitFor();expect(await name.inputValue()).toBe('Unsaved project name');expect(await description.inputValue()).toBe('Unsaved description');
 }finally{await p.close();}
});
it('delayed lifecycle result locks project fields instead of accepting input that is not in its command',async()=>{
 const p=await page(true);try{
  await p.getByRole('button',{name:'Existing project · 进行中 · Original company'}).click();await p.getByLabel('变化说明',{exact:true}).fill('Completed for real');await p.getByLabel('项目状态',{exact:true}).selectOption('completed');await p.getByRole('button',{name:'记录状态变化或纠错'}).click();
  await p.getByText('保存中',{exact:true}).waitFor();expect(await p.getByLabel('项目名称',{exact:true}).filter({visible:true}).isDisabled()).toBe(true);expect(await p.getByLabel('描述',{exact:true}).filter({visible:true}).isDisabled()).toBe(true);
  await p.evaluate(()=>{(window as unknown as {releaseSave():void}).releaseSave();});await p.getByRole('button',{name:'真实重新推进同一项目'}).waitFor();
 }finally{await p.close();}
});

it('unsaved collaboration role cannot lose its protection through a lifecycle or association save',async()=>{
 const p=await page(true);try{
  await p.getByRole('button',{name:'Existing project · 进行中 · Original company'}).click();
  await p.getByLabel('维护参与关系',{exact:true}).selectOption({label:'Confirmed person · Original project role · 当前 · 第1条'});
  const role=p.getByLabel('参与关系的项目职责',{exact:true});await role.fill('Unsaved collaboration role');
  await p.getByLabel('变化说明',{exact:true}).fill('Unrelated lifecycle');await p.getByLabel('项目状态',{exact:true}).selectOption('completed');
  await p.getByRole('button',{name:'记录状态变化或纠错'}).click();
  await p.getByText('请先保存或清理其他未提交的状态、关联或协作输入；它们仍保留。',{exact:true}).waitFor();
  await p.getByRole('button',{name:'确认变更任职关联'}).click();
  expect(await role.inputValue()).toBe('Unsaved collaboration role');
  expect(await p.evaluate(()=>(window as unknown as {nonBodyCommands:number}).nonBodyCommands)).toBe(0);
 }finally{await p.close();}
});

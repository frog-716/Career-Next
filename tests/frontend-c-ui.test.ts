import {it,expect} from 'vitest';
import {chromium,type Page} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';

async function ui(name:string,source:string,check:(page:Page)=>Promise<void>){
 const root=path.resolve('dist/frontend-c-'+name);await mkdir(root,{recursive:true});
 await writeFile(path.join(root,'index.html'),'<div id="app"></div><script type="module" src="/main.tsx"></script>');
 await writeFile(path.join(root,'main.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';${source}`);
 const server=await createServer({configFile:false,root,cacheDir:path.join(root,'.vite'),server:{host:'127.0.0.1',port:0,fs:{allow:[process.cwd()]}}});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error();const page=await browser.newPage({viewport:{width:600,height:820}});page.setDefaultTimeout(6000);await page.goto(`http://127.0.0.1:${address.port}`);await check(page);}finally{await browser.close();await server.close();await rm(root,{recursive:true,force:true});}
}

it('Wiki reads knowledge first and opens its preserved editor only on an explicit action',async()=>ui('wiki',`
import{WikiPage}from'../../packages/frontend/features/wiki/index.tsx';
const knowledge={id:'00000000-0000-4000-8000-000000000001',revision:1,title:'TEST knowledge',body:'TEST readable body',scope:'personal',nature:'observation',status:'active',sources:[],origin:'manual',reviewRequired:false,recordedBy:'user',verification:'not_verified',recordedAt:'2026-10-05T00:00:00Z'};
createRoot(document.getElementById('app')!).render(<WikiPage request={async input=>input.operation==='list'?{kind:'list',items:[knowledge]}:input.operation==='read'?{kind:'knowledge',knowledge}:input.operation==='create'?{kind:'knowledge',knowledge:{...knowledge,...input}}:{kind:'history',items:[]}} importContent={<p>TEST import panel</p>}/>);
`,async page=>{
 await page.getByRole('button',{name:'TEST knowledge',exact:true}).waitFor();
 expect(await page.getByLabel('知识正文',{exact:true}).isVisible()).toBe(false);
 expect(await page.getByText('TEST import panel').isVisible()).toBe(false);
 await page.getByRole('button',{name:'TEST knowledge',exact:true}).click();
 await page.getByRole('article',{name:'知识阅读'}).getByText('TEST readable body').waitFor();
 expect(await page.getByLabel('知识正文',{exact:true}).isVisible()).toBe(false);
 await page.getByRole('button',{name:'编辑',exact:true}).click();await page.getByLabel('知识正文',{exact:true}).fill('UNSAVED TEST knowledge');
 await page.getByRole('button',{name:'返回阅读（保留输入）',exact:true}).click();await page.getByRole('button',{name:'编辑',exact:true}).click();
 expect(await page.getByLabel('知识正文',{exact:true}).inputValue()).toBe('UNSAVED TEST knowledge');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}),30000);

it('Project list opens a readable detail and keeps editing and lifecycle controls on demand',async()=>ui('project',`
import{ProjectPage}from'../../packages/frontend/features/project/index.tsx';
const project={id:'00000000-0000-4000-8000-000000000002',contextId:'00000000-0000-4000-8000-000000000003',revision:1,name:'TEST personal project',description:'TEST project goal',tags:[],state:'inprogress',stateNote:'',employmentId:null,recordedAt:'2026-10-05T00:00:00Z'};
createRoot(document.getElementById('app')!).render(<QueryClientProvider client={new QueryClient()}><ProjectPage request={async input=>input.operation==='list'?{kind:'list',projects:[project]}:{kind:'project',project,employment:null,participants:[]}} onOpenWiki={()=>{}}/></QueryClientProvider>);
`,async page=>{
 await page.getByRole('button',{name:'TEST personal project · 进行中 · 个人项目'}).click();
 await page.getByText('TEST project goal',{exact:true}).waitFor();
 expect(await page.getByLabel('项目名称',{exact:true}).filter({visible:true}).count()).toBe(0);
 expect(await page.getByRole('button',{name:'记录状态变化或纠错'}).isVisible()).toBe(false);
 await page.getByRole('button',{name:'编辑项目',exact:true}).click();const name=page.getByLabel('项目名称',{exact:true}).filter({visible:true});await name.fill('UNSAVED TEST project');
 await page.getByRole('button',{name:'返回项目阅读（保留输入）'}).click();await page.getByRole('button',{name:'编辑项目',exact:true}).click();expect(await name.inputValue()).toBe('UNSAVED TEST project');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}),30000);

it('Employment reads overview first and keeps its people editor separate from the employment draft',async()=>ui('employment',`
import{EmploymentPage}from'../../packages/frontend/features/employment/index.tsx';
const employment={id:'00000000-0000-4000-8000-000000000004',revision:1,company:'TEST employer',role:'TEST analyst',goal:'TEST current goal',status:'current',start:{kind:'unknown'},plannedEnd:{kind:'unknown'},actualEnd:{kind:'unknown'},recordedAt:'2026-10-05T00:00:00Z'};
const people=[{id:'00000000-0000-4000-8000-000000000005',employmentId:employment.id,revision:1,name:'TEST colleague',role:'TEST lead',recordedAt:employment.recordedAt}];
createRoot(document.getElementById('app')!).render(<QueryClientProvider client={new QueryClient()}><EmploymentPage request={async input=>input.operation==='list'?{kind:'list',employments:[employment]}:{kind:'employment',employment,people}} renderProjects={()=><p>TEST projects</p>}/></QueryClientProvider>);
`,async page=>{
 await page.getByRole('button',{name:'TEST employer · TEST analyst · 当前'}).click();await page.getByText('TEST current goal',{exact:true}).waitFor();
 expect(await page.getByLabel('公司',{exact:true}).filter({visible:true}).count()).toBe(0);
 expect(await page.getByLabel('姓名',{exact:true}).filter({visible:true}).count()).toBe(0);
 const tabs=page.getByRole('navigation',{name:'任职分区'});await tabs.getByRole('button',{name:'人物',exact:true}).click();await page.getByRole('button',{name:'TEST colleague · TEST lead',exact:true}).click();
 expect(await page.getByLabel('姓名',{exact:true}).filter({visible:true}).count()).toBe(0);await page.getByRole('button',{name:'编辑人物',exact:true}).click();await page.getByLabel('姓名',{exact:true}).filter({visible:true}).fill('UNSAVED TEST colleague');
 await tabs.getByRole('button',{name:'概览',exact:true}).click();await page.getByRole('button',{name:'编辑任职',exact:true}).click();expect(await page.getByRole('button',{name:'确认任职已真实结束',exact:true}).isVisible()).toBe(false);await page.getByLabel('当前目标',{exact:true}).filter({visible:true}).fill('UNSAVED TEST goal');
 await tabs.getByRole('button',{name:'人物',exact:true}).click();expect(await page.getByLabel('姓名',{exact:true}).filter({visible:true}).inputValue()).toBe('UNSAVED TEST colleague');
 await tabs.getByRole('button',{name:'概览',exact:true}).click();expect(await page.getByLabel('当前目标',{exact:true}).filter({visible:true}).inputValue()).toBe('UNSAVED TEST goal');
 await tabs.getByRole('button',{name:'项目',exact:true}).click();await page.getByText('TEST projects',{exact:true}).filter({visible:true}).waitFor();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}),30000);

it('AI suggestion reading uses human language, hides identities and checks unknown results before continuing',async()=>ui('ai',`
import{ProductTaskPage}from'../../packages/frontend/support/ai/product-task.tsx';
const target={kind:'research-organize',owner:{kind:'opportunity',id:'00000000-0000-4000-8000-000000000006'}};
const proposal={id:'00000000-0000-4000-8000-000000000007',taskId:'00000000-0000-4000-8000-000000000008',operationId:'00000000-0000-4000-8000-000000000009',target,change:{kind:'create',content:{title:'TEST suggestion',body:'TEST AI suggestion body',nature:'hypothesis'},reason:'TEST material supports this interpretation',citations:[],unknowns:['TEST missing evidence']},dependencies:[],sources:[],provenance:[],state:'pending',ignored:false,validity:'current'};
const task={id:proposal.taskId,policy:'research-organize',input:{target,sources:[],egressSourceIds:[],wikiIds:[],egressWikiIds:[],objects:[]},budget:{requests:2,inputBytes:1000,outputBytes:1000},usedRequests:1,state:'completed',operations:[],proposals:[proposal]};let unknown=false;
window.career={request:async(module,input)=>module==='wiki'?{kind:'list',items:[]}:module==='application'?{kind:'data_targets',targets:[]}:input.operation==='product.list'?{kind:'product_tasks',tasks:[]}:input.operation==='product.prepare'?{kind:'product_task',task}:input.operation==='product.read'?{kind:'product_task',task}:input.operation==='product.receipt'?{kind:'receipt_missing'}:input.operation==='product.stop'?Promise.reject(Error('lost response')):{kind:'failure',code:'invalid_request'}};
window.careerMaterials={request:async()=>({kind:'list',items:[]})};createRoot(document.getElementById('app')!).render(<ProductTaskPage target={target}/>);
`,async page=>{
 const area=page.getByRole('region',{name:'产品任务辅助'});expect(await area.innerText()).not.toMatch(/research-organize|fixture|fake|Context/);
 await area.getByRole('button',{name:'准备外发预览',exact:true}).click();await area.getByRole('article',{name:'产品待审提案'}).waitFor();
 const suggestion=area.getByRole('article',{name:'产品待审提案'});expect(await suggestion.innerText()).toContain('TEST AI suggestion body');expect(await suggestion.innerText()).toContain('TEST missing evidence');expect(await suggestion.innerText()).not.toMatch(/pending|current|00000000-/);
 await area.getByRole('button',{name:'停止后续请求',exact:true}).click();await area.getByRole('status').filter({hasText:'先检查结果'}).waitFor();expect(await area.getByRole('button',{name:'继续这次操作'}).isVisible()).toBe(false);
 await area.getByRole('button',{name:'检查结果',exact:true}).click();await area.getByRole('button',{name:'继续这次操作',exact:true}).waitFor();
}),30000);

it('business AI entry exposes only the task supported by the connected real provider',async()=>ui('ai-entry',`
import{BusinessAiEntry}from'../../packages/frontend/support/ai/business-entry.tsx';
window.career={request:async()=>({kind:'product_tasks',tasks:[]})};window.careerSecrets={request:async()=>({kind:'status',status:{configured:true,enabled:true,provider:'deepseek-v4.1-flash',generation:'00000000-0000-4000-8000-000000000011',readiness:'available'}})};
window.careerMaterials={request:async()=>({kind:'list',items:[]})};createRoot(document.getElementById('app')!).render(<><BusinessAiEntry target={{kind:'research-organize',owner:{kind:'opportunity',id:'00000000-0000-4000-8000-000000000010'}}}/><BusinessAiEntry target={{kind:'greeting',opportunityId:'00000000-0000-4000-8000-000000000010',includeName:false}}/></>);
`,async page=>{
 await page.getByRole('button',{name:'帮我整理情报',exact:true}).waitFor();expect(await page.getByRole('button',{name:'起草沟通内容',exact:true}).count()).toBe(0);await page.getByText('当前连接还不能完成这个任务。',{exact:true}).waitFor();
 expect(await page.getByRole('button',{name:'准备外发预览',exact:true}).isVisible()).toBe(false);await page.getByRole('button',{name:'帮我整理情报',exact:true}).click();await page.getByRole('button',{name:'准备外发预览',exact:true}).waitFor();expect(await page.getByRole('button',{name:'确认这份查询并执行受控搜索'}).count()).toBe(0);
}),30000);

it('normal DeepSeek settings do not present a local fake credential as a real connection',async()=>ui('provider-identity',`
import{SecretSettings}from'../../packages/frontend/support/ai/secret-settings.tsx';
const bridge={request:async()=>({kind:'status',status:{configured:true,enabled:true,generation:'00000000-0000-4000-8000-000000000011',readiness:'available'}})};createRoot(document.getElementById('app')!).render(<SecretSettings bridge={bridge}/>);
`,async page=>{await page.getByRole('status').filter({hasText:'DeepSeek 尚未连接'}).waitFor();expect(await page.getByRole('status').innerText()).not.toContain('当前本机检查可用');}),30000);

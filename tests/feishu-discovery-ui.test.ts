import {it,expect} from 'vitest';
import {chromium} from 'playwright';import {createServer} from 'vite';
import {mkdir,rm,writeFile} from 'node:fs/promises';import path from 'node:path';

async function fixture(connection='connected'){
 const root=path.resolve('out/f2-validation/UI-TEST');await mkdir(root,{recursive:true});
 await writeFile(path.join(root,'index.html'),'<div id="root"></div><script type="module" src="/main.tsx"></script>');
 await writeFile(path.join(root,'main.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import{FeishuMaterialsPicker}from'../../../packages/frontend/features/materials/FeishuMaterialsPicker';import'../../../packages/frontend/app/style.css';import'../../../packages/frontend/design-system/aura-approved.css';window.calls=[];window.careerFeishu={getConnectionStatus:async()=>({provider:'feishu',state:${JSON.stringify(connection)}})};const bridge={searchDocuments:async input=>{window.calls.push(input);return{kind:'results',hasMore:false,items:[{ref:'11111111-1111-4111-8111-111111111111',title:'TEST 项目复盘',type:'docx',updatedAt:'2026-10-01T12:00:00.000Z',url:null},{ref:'22222222-2222-4222-8222-222222222222',title:'TEST 表格',type:'sheet',updatedAt:null,url:null}]}}};window.careerFeishuDiscovery=bridge;createRoot(document.getElementById('root')).render(<FeishuMaterialsPicker bridge={bridge}/>);`);
 const server=await createServer({configFile:false,root,cacheDir:path.resolve('out/f2-validation/vite-cache'),server:{watch:null,host:'127.0.0.1',port:0,fs:{allow:[process.cwd()]}}});await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error();const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:600,height:820}});page.setDefaultTimeout(5000);await page.goto('http://127.0.0.1:'+address.port);return{page,close:async()=>{await browser.close();await server.close();await rm(root,{recursive:true,force:true});}};
}
it('typing never searches; explicit click shows metadata and selection never reads or creates content',async()=>{
 const {page,close}=await fixture();try{
  await page.getByRole('heading',{name:'飞书资料',exact:true}).waitFor();await page.getByRole('textbox',{name:'搜索飞书资料标题'}).fill('项目复盘');
  expect(await page.evaluate(()=>(window as any).calls.length)).toBe(0);
  await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:/TEST 项目复盘/}).waitFor();
  expect(await page.getByText('云文档',{exact:true}).isVisible()).toBe(true);expect(await page.getByText('电子表格',{exact:true}).isVisible()).toBe(true);expect(await page.getByText(/2026\/10\/1/).isVisible()).toBe(true);
  await page.getByRole('button',{name:/TEST 项目复盘/}).click();expect(await page.getByRole('status').innerText()).toContain('已选择');expect(await page.getByRole('status').innerText()).toContain('TEST 项目复盘');
  expect(await page.evaluate(()=>(window as any).calls.length)).toBe(1);expect(await page.getByRole('button',{name:'读取这份资料',exact:true}).isEnabled()).toBe(false);
  expect(await page.locator('body').innerText()).not.toMatch(/11111111|token|open_id|api\/|SELECTED_METADATA/);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await close();}
},30000);

it('zero results explain the next step; failed authorization offers reconnect rather than technical output',async()=>{
 const {page,close}=await fixture();try{
  await page.getByRole('textbox',{name:'搜索飞书资料标题'}).fill('TEST zero');
  await page.evaluate(()=>{window.careerFeishuDiscovery!.searchDocuments=async()=>({kind:'results',items:[],hasMore:false});});
  await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByText('没有找到匹配标题。可以换一个更短的关键词再搜。',{exact:true}).waitFor();
  await page.evaluate(()=>{window.careerFeishuDiscovery!.searchDocuments=async()=>({kind:'failure',reason:'reauthorization_required'});});
  await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByText('飞书连接已失效，请到设置重新授权。',{exact:true}).first().waitFor();
  expect(await page.getByRole('button',{name:'搜索',exact:true}).isEnabled()).toBe(false);expect(await page.locator('body').innerText()).not.toMatch(/token|open_id|reauthorization_required/);
 }finally{await close();}
},25000);

it('unconnected or revoked authorization leaves search disabled without any external action',async()=>{
 for(const state of ['not_connected','connection_invalid','reauthorization_required']){
  const {page,close}=await fixture(state);try{await page.getByRole('heading',{name:'飞书资料',exact:true}).waitFor();expect(await page.getByRole('button',{name:'搜索',exact:true}).isEnabled()).toBe(false);expect(await page.evaluate(()=>(window as any).calls.length)).toBe(0);}finally{await close();}
 }
},35000);

import {test,expect} from 'vitest';
import {chromium} from 'playwright';import {createServer} from 'vite';
import {mkdir,writeFile,rm} from 'node:fs/promises';import path from 'node:path';
async function fixture(mode='normal'){
 const root=path.resolve('out/f3a-validation/UI-TEST');await mkdir(root,{recursive:true});
 await writeFile(path.join(root,'index.html'),'<div id="root"></div><script type="module" src="/main.tsx"></script>');
 await writeFile(path.join(root,'main.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import{FeishuMaterialsPicker}from'../../../packages/frontend/features/materials/FeishuMaterialsPicker';import'../../../packages/frontend/app/style.css';import'../../../packages/frontend/design-system/aura-approved.css';const mode=${JSON.stringify(mode)};window.calls=[];window.careerFeishu={getConnectionStatus:async()=>({provider:'feishu',state:'connected'})};window.careerFeishuDiscovery={searchDocuments:async()=>{throw Error('UNAUTHORIZED SEARCH')}};window.careerFeishuBitable={getSelectedBitable:async()=>({ref:'11111111-1111-4111-8111-111111111111',title:'TEST Base',type:'bitable',url:null,updatedAt:null}),listBitableTables:async x=>{window.calls.push('tables');return mode==='denied'?{kind:'failure',reason:'permission_required'}:{kind:'tables',title:'TEST Base',items:mode==='zero'?[]:[{ref:'22222222-2222-4222-8222-222222222222',name:'TEST Products'},{ref:'33333333-3333-4333-8333-333333333333',name:'TEST Tasks'}],hasMore:false}},listBitableViews:async x=>{window.calls.push('views');return{kind:'views',items:[{ref:crypto.randomUUID(),name:'TEST All',type:'grid'}],hasMore:false}},listBitableFields:async x=>{window.calls.push('fields');return{kind:'fields',items:[{name:'TEST Title',type:'text'},{name:'TEST Formula',type:'formula'}],hasMore:false}}};createRoot(document.getElementById('root')).render(<FeishuMaterialsPicker/>);`);
 const server=await createServer({configFile:false,root,cacheDir:path.resolve('out/f3a-validation/vite-cache'),server:{watch:null,host:'127.0.0.1',port:0,fs:{allow:[process.cwd()]}}});await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error();const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:600,height:820}});page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(20000);await page.goto('http://127.0.0.1:'+address.port,{waitUntil:'domcontentloaded'});return{page,close:async()=>{await browser.close();await server.close();await rm(root,{recursive:true,force:true});}};
}
test('restored selected Bitable requires an explicit structure action; table/view choices never fetch records',async()=>{
 const {page,close}=await fixture();try{
  await page.getByText('已选择：TEST Base',{exact:true}).waitFor();expect(await page.evaluate(()=>(window as any).calls)).toEqual([]);
  await page.getByRole('button',{name:'查看表格结构',exact:true}).click();await page.getByRole('button',{name:'选择表：TEST Products',exact:true}).waitFor();
  expect(await page.getByText('TEST Title',{exact:true}).count()).toBe(2);expect(await page.getByText('TEST Formula',{exact:true}).count()).toBe(2);
  await page.getByRole('button',{name:'选择表：TEST Products',exact:true}).click();await page.getByRole('button',{name:'选择视图：TEST All',exact:true}).first().click();expect(await page.getByRole('status').filter({hasText:'已选择表：TEST Products'}).innerText()).toContain('TEST All');
  await page.getByRole('button',{name:'选择表：TEST Tasks',exact:true}).click();expect(await page.getByRole('status').filter({hasText:'已选择表：TEST Tasks'}).innerText()).not.toContain('视图：TEST All');
  expect(await page.evaluate(()=>(window as any).calls)).toEqual(['tables','views','fields','views','fields']);expect(await page.locator('body').innerText()).not.toMatch(/11111111|22222222|token|open_id|record_id|cell|formula_value/);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await close();}
},60000);
test('zero tables and denied permission stay truthful and never continue to view/field or record access',async()=>{
 for(const mode of ['zero','denied']){const {page,close}=await fixture(mode);try{
  await page.getByRole('button',{name:'查看表格结构',exact:true}).click();await page.getByText(mode==='zero'?'这份多维表格没有可用的数据表。':'读取表格结构需要只读权限，请先检查飞书授权。',{exact:true}).waitFor();expect(await page.evaluate(()=>(window as any).calls)).toEqual(['tables']);
 }finally{await close();}}
},60000);

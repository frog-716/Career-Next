import {it,expect} from 'vitest';import {chromium} from 'playwright';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {createNodeHost} from '../../apps/desktop/node/host';

it('production Wiki material source picker routes to Feishu metadata, keeps the four modules and creates no business object',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'career-F2-TEST-browser-'));let host:Awaited<ReturnType<typeof createNodeHost>>|undefined;const browser=await chromium.launch({channel:'chrome',headless:true});let searches=0;
 try{
  host=await createNodeHost({profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false,feishuPorts:{authState:async()=>'ready',readCurrentUser:async()=>({displayName:'TEST nickname'}),downloadAvatar:async()=>({bytes:Buffer.alloc(0),mime:'image/png'})},feishuDiscoveryPorts:{searchDocuments:async()=>{searches++;return {hasMore:false,items:[{documentId:'PRIVATE DOC TOKEN',title:'TEST 岗位复盘',type:'docx',updatedAt:'2026-10-01T12:00:00.000Z',url:null}]};}}});
  const context={bind(){},replaceBinding(){},notify(){}};await host.handlers['feishu/connect']({},context);const before=await host.handlers['business/profile']({operation:'profile.read'},context);
  const page=await browser.newPage({viewport:{width:600,height:820}});await page.goto(host.url+'/#/wiki');await page.getByRole('navigation',{name:'一级导航'}).waitFor();const tour=page.getByRole('region',{name:'新手教程'});if(await tour.isVisible())await tour.getByRole('button',{name:'跳过',exact:true}).click();
  await page.getByRole('button',{name:'添加资料',exact:true}).click();await page.getByRole('button',{name:'飞书',exact:true}).click();await page.getByRole('textbox',{name:'搜索飞书资料标题'}).fill('岗位复盘');expect(searches).toBe(0);
  await page.getByRole('button',{name:'搜索',exact:true}).click();await page.getByRole('button',{name:/TEST 岗位复盘/}).click();await page.getByRole('status').filter({hasText:'已选择：TEST 岗位复盘'}).waitFor();expect(searches).toBe(1);
  expect(await page.getByRole('button',{name:'查看内容',exact:true}).isEnabled()).toBe(true);expect(await page.getByRole('navigation',{name:'一级导航'}).getByRole('link').count()).toBe(4);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.evaluate(()=>window.careerMaterials.request({operation:'list'}))).toMatchObject({kind:'list',items:[]});expect(await page.evaluate(()=>window.career.request('wiki',{operation:'list',includeRetired:true}))).toMatchObject({kind:'list',items:[]});expect(await host.handlers['business/profile']({operation:'profile.read'},context)).toEqual(before);
  await page.reload();await page.getByRole('navigation',{name:'一级导航'}).waitFor();expect(searches).toBe(1);expect(await page.locator('.career-connection-name').textContent()).toBe('TEST nickname');
 }finally{await browser.close();await host?.close();await rm(profile,{recursive:true,force:true});}
},40000);

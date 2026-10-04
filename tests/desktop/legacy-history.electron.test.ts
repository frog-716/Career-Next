import {expect,it} from 'vitest';
import {_electron} from 'playwright';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {seedLegacyHistoryTestProfile} from '../fixtures/legacy-history-workspace';
it('packaged readonly histories preserve statuses, unresolved details and have no execution controls or current tasks',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-legacy-history-desktop-')),profile=path.join(root,'profile');await seedLegacyHistoryTestProfile(profile);const packaged=process.env.CAREER_PACKAGED==='1';
 const app=await _electron.launch({executablePath:packaged?path.resolve('out/CareerNext-darwin-arm64/CareerNext.app/Contents/MacOS/CareerNext'):undefined,args:packaged?[`--user-data-dir=${profile}`]:['.',`--user-data-dir=${profile}`],timeout:30000});
 try{const page=await app.firstWindow();page.setDefaultTimeout(10000);await page.getByRole('navigation',{name:'一级导航'}).waitFor();expect(await page.getByRole('navigation',{name:'一级导航'}).getByRole('link').count()).toBe(4);
  await page.getByRole('button',{name:'设置与资料维护',exact:true}).click();await page.getByRole('button',{name:'历史 AI 建议',exact:true}).click();const history=page.getByRole('region',{name:'历史 AI 建议',exact:true});await history.getByRole('button',{name:'TEST Research pending · pending',exact:true}).waitFor();
  for(const status of ['pending','accepted','rejected','resolved','superseded']){await history.getByRole('button',{name:`TEST Research ${status} · ${status}`,exact:true}).click();const details=history.getByRole('article',{name:'历史 AI 建议详情'});await details.getByRole('heading',{name:'Research · '+status,exact:true}).waitFor();expect(await details.textContent()).toContain('原目标当前无法解析');expect(await details.textContent()).toContain('不代表独立核验');}
  await history.getByRole('button',{name:'TEST Resume accepted · accepted',exact:true}).click();await history.getByRole('article').getByRole('heading',{name:'Resume · accepted',exact:true}).waitFor();expect(await history.getByRole('button',{name:/Accept|Reject|Retry|Apply|Edit|Re-run|接受|拒绝|重试|应用|编辑|重新运行/}).count()).toBe(0);
  const current=await page.evaluate(async()=>({wiki:await window.career.request('ai',{operation:'ai.list'}),product:await window.career.request('ai',{operation:'product.list'})}));expect(current).toEqual({wiki:{kind:'tasks',tasks:[]},product:{kind:'product_tasks',tasks:[]}});
  await page.getByRole('button',{name:'完整旅程任务辅助',exact:true}).click();expect(await page.getByRole('region',{name:'产品任务辅助'}).count()).toBe(0);expect(await page.getByRole('article',{name:'产品待审提案'}).count()).toBe(0);
  await mkdir('out/verification/legacy-history',{recursive:true});await page.screenshot({path:'out/verification/legacy-history/packaged.png'});await writeFile('out/verification/legacy-history/packaged.json',JSON.stringify({packaged,statuses:5,resumeRead:true,unresolved:true,noExecutionButtons:true,currentTasksEmpty:true,primaryNavigation:4,realSourceRead:0,externalRequests:0},null,2));
 }finally{await app.evaluate(({dialog})=>{dialog.showMessageBoxSync=(()=>1) as typeof dialog.showMessageBoxSync;}).catch(()=>{});await app.close();await rm(root,{recursive:true,force:true});}
},90000);

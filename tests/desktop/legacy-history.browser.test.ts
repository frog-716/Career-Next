import {it,expect} from 'vitest';
import {launchBrowserFixture,skipTutorial,auxiliary} from '../fixtures/browser-host';
import {seedLegacyHistoryTestProfile} from '../fixtures/legacy-history-workspace';
it('Node/Browser readonly histories retain five statuses and unresolved identity without becoming executable tasks',async()=>{
 const f=await launchBrowserFixture({prepare:seedLegacyHistoryTestProfile});try{await skipTutorial(f.page);await auxiliary(f.page,'设置');await f.page.getByRole('button',{name:'高级资料维护',exact:true}).click();await f.page.getByText('历史 AI 建议（只读）',{exact:true}).click();const history=f.page.getByRole('region',{name:'历史 AI 建议',exact:true});
 for(const status of ['pending','accepted','rejected','resolved','superseded']){await history.getByRole('button',{name:`TEST Research ${status} · ${status}`,exact:true}).click();const details=history.getByRole('article',{name:'历史 AI 建议详情'});await details.getByRole('heading',{name:'Research · '+status,exact:true}).waitFor();expect(await details.innerText()).toContain('原目标当前无法解析');expect(await details.innerText()).toContain('不代表独立核验');}
 await history.getByRole('button',{name:'TEST Resume accepted · accepted',exact:true}).click();await history.getByRole('article').getByRole('heading',{name:'Resume · accepted',exact:true}).waitFor();expect(await history.getByRole('button',{name:/接受|拒绝|重试|应用|编辑|重新运行/}).count()).toBe(0);expect(await f.page.evaluate(async()=>({wiki:await window.career.request('ai',{operation:'ai.list'}),product:await window.career.request('ai',{operation:'product.list'})}))).toEqual({wiki:{kind:'tasks',tasks:[]},product:{kind:'product_tasks',tasks:[]}});
 }finally{await f.close();}
},60000);

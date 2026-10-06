import {it,expect} from 'vitest';
import {launchBrowserFixture,skipTutorial} from '../fixtures/browser-host';
it('Browser beforeunload preserves a dirty identity draft on cancellation, and resumed pages retain TEST content',async()=>{
 const f=await launchBrowserFixture();try{const page=f.page;await skipTutorial(page);const id=await page.evaluate(async()=>{const c:any=await window.career.request('opportunity',{operation:'company.create',commandId:crypto.randomUUID(),name:'E2 TEST continuity'});const o:any=await window.career.request('opportunity',{operation:'create',commandId:crypto.randomUUID(),companyId:c.company.id,role:'TEST role'});return o.opportunity.id;});await page.goto(f.host.url+'/#/opportunity/'+id+'/resume');const editor=page.getByRole('textbox',{name:'简历正文'});await editor.waitFor();await editor.locator('p').first().fill('E2 TEST continuous 中文 body');await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');await page.getByLabel('简历更多',{exact:true}).click();await page.getByRole('button',{name:'修改基础资料',exact:true}).click();await page.getByLabel('基础资料姓名',{exact:true}).fill('E2 TEST unsaved identity');await expect.poll(()=>page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})).toBe(true);page.removeAllListeners('dialog');page.once('dialog',dialog=>void dialog.dismiss());await page.reload({timeout:3000}).catch(()=>{});expect(await page.getByLabel('基础资料姓名',{exact:true}).inputValue()).toBe('E2 TEST unsaved identity');expect(await editor.textContent()).toContain('E2 TEST continuous');
 // Exercise the public back/forward-cache lifecycle. No explicit ready() call may mask a broken restore hook.
 // This is automated browser lifecycle evidence, not another physical macOS sleep.
 const closed=page.waitForResponse(response=>response.url().endsWith('/api/close-tab')&&response.status()===200);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await closed;
 const restored=page.waitForResponse(response=>response.url().endsWith('/api/ready')&&response.status()===200);
 const events=page.waitForResponse(response=>response.url().endsWith('/api/events')&&response.status()===200);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 const restoredIdentity=await (await restored).json();expect(restoredIdentity.result.workspaceInstance).toBe(f.host.identity().workspaceInstance);await events;
 const opportunities=await page.evaluate(()=>window.career.request('opportunity',{operation:'list'}));expect(JSON.stringify(opportunities)).toContain(id);
 expect(await page.getByLabel('基础资料姓名',{exact:true}).inputValue()).toBe('E2 TEST unsaved identity');expect(await editor.textContent()).toContain('E2 TEST continuous');
 await page.getByLabel('基础资料姓名',{exact:true}).fill('');page.on('dialog',dialog=>void dialog.accept());await page.reload();await editor.waitFor();expect(await editor.textContent()).toContain('E2 TEST continuous');
 }finally{await f.close();}
},45000);

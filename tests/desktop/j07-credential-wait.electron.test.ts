import {it,expect} from 'vitest';import {_electron} from 'playwright';
import {mkdtemp,writeFile,rm,readFile,readdir} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
async function harness(delay:number,failure?:number|'generic'){
 const root=await mkdtemp(path.join(os.tmpdir(),'j07-interactive-auth-')),bundle=process.env.J07_WAIT_PACKAGE_PATH??'out/CareerNext-darwin-arm64/CareerNext.app',main=path.resolve(bundle,'Contents/Resources/app.asar/dist/application/main.cjs'),shim=path.join(root,'utility-shim.cjs'),entry=path.join(root,'main-shim.cjs'),trace=path.join(root,'unexpected-network.txt'),authorizationTrace=path.join(root,'native-call-count.json');
 await writeFile(shim,`globalThis.fetch=async()=>{require('node:fs').writeFileSync(${JSON.stringify(trace)},'unexpected network call');throw Error('Network forbidden in credential wait validation');};require(${JSON.stringify(main.replace('main.cjs','utility.cjs'))});`);
 // Replace only the native OS boundary. All app contracts, ports, resolver and UI remain production code.
 await writeFile(entry,`const {utilityProcess,safeStorage}=require('electron');safeStorage.isAsyncEncryptionAvailable=async()=>true;safeStorage.encryptStringAsync=async()=>Buffer.from('SYNTHETIC_OPAQUE_CIPHER');let reads=0;safeStorage.decryptStringAsync=async()=>{require('node:fs').writeFileSync(${JSON.stringify(authorizationTrace)},JSON.stringify({nativeReadCount:++reads}));await new Promise(resolve=>setTimeout(resolve,${delay}));${failure===undefined?"return {result:'SYNTHETIC_WAIT_CREDENTIAL'};":`throw Object.assign(Error('SYNTHETIC_ERROR_NO_KEY_MUST_ESCAPE'),{code:${JSON.stringify(failure)}});`}};const original=utilityProcess.fork.bind(utilityProcess);utilityProcess.fork=(modulePath,args,options)=>original(modulePath.endsWith('/utility.cjs')?${JSON.stringify(shim)}:modulePath,args,options);require(${JSON.stringify(main)});`);
 const application=await _electron.launch({args:[entry,'--user-data-dir='+path.join(root,'profile')]});const page=await application.firstWindow();page.setDefaultTimeout(4000);
 await page.getByRole('button',{name:'设置与资料维护'}).waitFor();await expect.poll(()=>page.evaluate(async()=>{try{return (await window.career.ready()).workspaceInstance;}catch{return '';}})).not.toBe('');
 await page.evaluate(()=>window.careerTavilySecrets.request({operation:'save',value:'SYNTHETIC_WAIT_CREDENTIAL'}));await page.getByRole('button',{name:'设置与资料维护'}).click();
 let closed=false;return {root,page,application,trace,authorizationTrace,async close(){if(closed)return;closed=true;try{await application.close();}finally{await rm(root,{recursive:true,force:true});}}};
}
it('packaged formal credential wait stays interactive past 60 seconds, suppresses duplicate reads and never calls network',async()=>{
 const h=await harness(65000);
 try{await h.page.getByRole('button',{name:'检查正式搜索凭据链（不联网）'}).click();
  await h.page.getByRole('status').filter({hasText:'正在等待系统授权'}).waitFor();
  const control=await h.page.evaluate(async()=>{const start=Date.now(),ready=await window.career.ready(),receipt=await window.careerTavilySearch.request({operation:'receipt'}),status=await window.careerTavilySecrets.request({operation:'status'}),business=await window.career.request('wiki',{operation:'list'});return {elapsed:Date.now()-start,ready:!!ready.workspaceInstance,receipt,status,business};});
  expect(control.elapsed).toBeLessThan(2000);expect(control.ready).toBe(true);expect(control.business).toMatchObject({kind:'list'});expect(control.receipt).toMatchObject({kind:'state',state:'not_run',requestCount:0});expect(control.status).toMatchObject({kind:'status',status:{authorization:'waiting_for_system_authorization'}});
  // A second explicit check shares the one native operation, not a new system prompt.
  const duplicate=h.page.evaluate(()=>window.careerTavilySearch.request({operation:'credential.check'}));
  await h.page.getByRole('status').filter({hasText:'系统授权已完成'}).waitFor({timeout:72000});
  const second=await duplicate;expect(second).toMatchObject({kind:'credential_readiness',available:true});
  expect(JSON.parse(await readFile(h.authorizationTrace,'utf8'))).toEqual({nativeReadCount:1});
  const text=await h.page.locator('body').innerText();expect(text).toContain('正式凭据交接：可用');expect(text).not.toContain('SYNTHETIC_WAIT_CREDENTIAL');
  expect(await h.page.evaluate(()=>window.careerTavilySearch.request({operation:'receipt'}))).toMatchObject({kind:'state',state:'not_run',requestCount:0});await expect(readFile(h.trace)).rejects.toThrow();await assertNoCredentialInProfile(path.join(h.root,'profile'));
 }finally{await h.close();}
},85000);
it('app cancel during authorization returns cancelled without HTTP, and late native completion cannot restore readiness',async()=>{
 const h=await harness(2200);
 try{await h.page.getByRole('button',{name:'检查正式搜索凭据链（不联网）'}).click();await h.page.getByRole('status').filter({hasText:'正在等待系统授权'}).waitFor();await h.page.getByRole('button',{name:'取消等待系统授权（不发送）'}).click();await h.page.getByRole('status').filter({hasText:'已取消等待'}).waitFor();
  await expect.poll(()=>h.page.locator('body').innerText()).toContain('credential_cancelled');await new Promise(resolve=>setTimeout(resolve,2400));
  const status=await h.page.evaluate(()=>window.careerTavilySecrets.request({operation:'status'}));expect(status).toMatchObject({kind:'status',status:{authorization:'cancelled',readiness:'unavailable'}});expect(JSON.stringify(status)).not.toContain('SYNTHETIC');await expect(readFile(h.trace)).rejects.toThrow();await assertNoCredentialInProfile(path.join(h.root,'profile'));
 }finally{await h.close();}
},20000);
it.each([[-128,'credential_cancelled','已取消等待'],[-25293,'credential_denied','系统拒绝本次凭据读取'],['generic','credential_unavailable','系统未提供可区分']])('formal packaged bridge preserves native outcome %s without guesses or credential leakage',async(code,reason,label)=>{
 const h=await harness(200,code as number|'generic');
 try{await h.page.getByRole('button',{name:'检查正式搜索凭据链（不联网）'}).click();await h.page.getByRole('status').filter({hasText:String(label)}).waitFor();await expect.poll(()=>h.page.locator('body').innerText()).toContain(String(reason));expect(await h.page.locator('body').innerText()).not.toContain('SYNTHETIC');expect(await h.page.evaluate(()=>window.careerTavilySearch.request({operation:'receipt'}))).toMatchObject({kind:'state',requestCount:0,state:'not_run'});await expect(readFile(h.trace)).rejects.toThrow();await assertNoCredentialInProfile(path.join(h.root,'profile'));
 }finally{await h.close();}
},20000);

async function assertNoCredentialInProfile(root:string){
 for(const entry of await readdir(root,{withFileTypes:true})){const file=path.join(root,entry.name);if(entry.isDirectory())await assertNoCredentialInProfile(file);else if(entry.isFile())expect((await readFile(file)).includes(Buffer.from('SYNTHETIC_WAIT_CREDENTIAL'))).toBe(false);}
}

it('closing the app during a pending native authorization does not wait for its emergency deadline',async()=>{
 const h=await harness(65000);
 try{await h.page.getByRole('button',{name:'检查正式搜索凭据链（不联网）'}).click();await h.page.getByRole('status').filter({hasText:'正在等待系统授权'}).waitFor();await expect(readFile(h.trace)).rejects.toThrow();const start=Date.now();await h.close();expect(Date.now()-start).toBeLessThan(3000);}finally{await h.close();}
},15000);

import {it,expect} from 'vitest';
import {_electron,type ElectronApplication,type Page} from 'playwright';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const executable=process.env.CAREER_PACKAGED_EXECUTABLE;
async function launch(profile:string){if(!executable)throw Error('normal packaged executable required');const app=await _electron.launch({executablePath:executable,args:[`--user-data-dir=${profile}`],timeout:30000});const page=await app.firstWindow();await page.getByRole('navigation',{name:'一级导航'}).waitFor();return {app,page};}
async function prepare(page:Page){return page.evaluate(async()=>{const result=await window.career.request('opportunity',{operation:'company.create',commandId:crypto.randomUUID(),name:'Virtual credential gate fixture'}) as any;return window.career.request('ai',{operation:'product.prepare',commandId:crypto.randomUUID(),input:{target:{kind:'research-organize',owner:{kind:'company',id:result.company.id}},sources:[],egressSourceIds:[],wikiIds:[],egressWikiIds:[],objects:[]},budget:{requests:2,inputBytes:524288,outputBytes:196608}});});}
async function finish(app:ElectronApplication|undefined,root:string){if(app){await app.evaluate(({dialog})=>{dialog.showMessageBoxSync=(()=>1) as typeof dialog.showMessageBoxSync;}).catch(()=>{});await app.close().catch(()=>{});}await rm(root,{recursive:true,force:true});}
it('normal Main startup honors a persisted first-save pending marker even without binding.json',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-g6-pending-startup-')),profile=path.join(root,'profile');let app:ElectronApplication|undefined;
 try{await mkdir(path.join(profile,'security'),{recursive:true});await writeFile(path.join(profile,'security/pending-generation.json'),JSON.stringify({generation:randomUUID()}));const session=await launch(profile);app=session.app;
  expect(await session.page.evaluate(()=>window.careerSecrets.request({operation:'status'}))).toMatchObject({kind:'status',status:{enabled:false,configured:false}});
  expect(await prepare(session.page)).toMatchObject({kind:'failure',code:'provider_disabled'});
  await writeFile('/tmp/career-g6/native-startup-gate.json',JSON.stringify({packaged:true,firstSavePendingWithoutBinding:true,vaultDisabled:true,runtimeProviderDisabled:true,realProvider:'NOT TESTED'},null,2));
 }finally{await finish(app,root);}
},60000);
it('two normal credential bridges cannot reenable an earlier save after a later disable, including app restart',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-g6-credential-concurrency-')),profile=path.join(root,'profile');let app:ElectronApplication|undefined;
 try{let session=await launch(profile);app=session.app;
  await app.evaluate(({Menu})=>{const item=Menu.getApplicationMenu()!.items.find(item=>item.label==='文件')!.submenu!.items.find(item=>item.label==='新建窗口')!;item.click();});await expect.poll(()=>app!.windows().length).toBe(2);const second=app.windows()[1]!;await second.getByRole('navigation',{name:'一级导航'}).waitFor();
  await app.evaluate(({safeStorage})=>{const original=safeStorage.encryptStringAsync.bind(safeStorage);safeStorage.encryptStringAsync=async value=>{const encrypted=await original(value);(globalThis as any).__g6EncryptReady=true;await new Promise<void>(resolve=>(globalThis as any).__g6ReleaseEncrypt=resolve);return encrypted;};});
  await session.page.evaluate(value=>{(window as any).__g6Save=window.careerSecrets.request({operation:'save',value});},'G6_VIRTUAL_CONCURRENT_'+randomUUID());await expect.poll(()=>app!.evaluate(()=>(globalThis as any).__g6EncryptReady)).toBe(true);
  await second.evaluate(()=>{(window as any).__g6Disable=window.careerSecrets.request({operation:'disable'});});
  // An observable private gate response proves the later intent arrived before releasing A.
  expect(await prepare(second)).toMatchObject({kind:'failure',code:'provider_disabled'});
  await app.evaluate(()=>(globalThis as any).__g6ReleaseEncrypt());await session.page.evaluate(()=>(window as any).__g6Save);await second.evaluate(()=>(window as any).__g6Disable);
  expect(await second.evaluate(()=>window.careerSecrets.request({operation:'status'}))).toMatchObject({kind:'status',status:{configured:true,enabled:false}});expect(await prepare(second)).toMatchObject({kind:'failure',code:'provider_disabled'});
  await app.close();app=undefined;session=await launch(profile);app=session.app;expect(await prepare(session.page)).toMatchObject({kind:'failure',code:'provider_disabled'});
  await writeFile('/tmp/career-g6/native-concurrent-gate.json',JSON.stringify({packaged:true,twoRealWindows:true,actualSafeStorageEncryption:true,earlierSaveThenLaterDisable:true,vaultDisabled:true,runtimeDisabled:true,restartDisabled:true,realProvider:'NOT TESTED'},null,2));
 }finally{await finish(app,root);}
},120000);

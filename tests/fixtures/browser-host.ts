import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';import {tmpdir} from 'node:os';
import {chromium,type Page} from 'playwright';
import {createNodeHost} from '../../apps/desktop/node/host';
/** TEST-only driver. Uses the real Node host, browser bridge, owners and SQLite; no compatibility shell. */
export async function launchBrowserFixture(options:{profile?:string;fake?:boolean;prepare?:(profile:string)=>Promise<unknown>}={}){
 const profile=options.profile??await mkdtemp(path.join(tmpdir(),'career-E2-TEST-browser-'));
 if(!profile.includes('TEST'))throw Error('isolated_TEST_profile_required');
 await options.prepare?.(profile);
 let host=await createNodeHost({profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false,...options.fake?{providerBinding:{enabled:true,generation:'fake-v1'}}:{}});
 const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:850}});
 if(options.fake)await context.addInitScript(()=>{let bridge:any;Object.defineProperty(window,'career',{configurable:true,get:()=>bridge,set:value=>{bridge=value;bridge.developmentDiagnostics=true;}});});
 async function open(route=''){const page=await context.newPage();page.on('dialog',dialog=>void dialog.accept());page.setDefaultTimeout(10000);const url=host.url+'/'+route;if(page.url()===url)await page.reload();else await page.goto(url);await page.getByRole('navigation',{name:'一级导航'}).waitFor();return page;}
 const page=await open();
 return {profile,page,browser,context,get host(){return host;},open,
  async reopen(route:string){const port=Number(new URL(host.url).port);await host.close();host=await createNodeHost({profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port,automaticBackups:false,...options.fake?{providerBinding:{enabled:true,generation:'fake-v1'}}:{}});const url=host.url+'/'+route;if(page.url()===url)await page.reload();else await page.goto(url);await page.getByRole('navigation',{name:'一级导航'}).waitFor();return page;},
  async close(){await browser.close();await host.close();await rm(profile,{recursive:true,force:true});},
 };
}
export async function skipTutorial(page:Page){const tutorial=page.getByRole('region',{name:'新手教程'});if(await tutorial.isVisible())await tutorial.getByRole('button',{name:'跳过',exact:true}).click();}
export async function auxiliary(page:Page,label:string){await page.getByRole('button',{name:'连接与辅助菜单'}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();}

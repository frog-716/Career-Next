import {test,expect} from 'vitest';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';

test('browser event transport validates content-free Feishu eviction and keeps Materials purge delivery',async()=>{
 const root=path.resolve('out/delivery-validation/eviction-bridge-UI-TEST');await mkdir(root,{recursive:true});
 await writeFile(path.join(root,'index.html'),'<div id="root"></div><script type="module" src="/main.ts"></script>');
 await writeFile(path.join(root,'main.ts'),`import {installBrowserBridge} from '../../../packages/frontend/app/browser-bridge';
 const id='11111111-1111-4111-8111-111111111111';let sent=false;
 window.delivered=[];window.purges=[];window.addEventListener('career-feishu-cache-evicted',event=>window.delivered.push(event.detail));
 window.fetch=async url=>{const route=String(url),result=route==='/api/events'?(sent?[]:(sent=true,[{kind:'feishu_cache_evicted',materialIds:[id],previewRefs:[],recordRefs:[],all:false,body:'TEST forbidden extra body'},{kind:'feishu_cache_evicted',materialIds:[id],previewRefs:[],recordRefs:[],all:false},{workspaceInstance:id,references:[{owner:'materials',objectId:id}]}])):{protocolVersion:1,workspaceInstance:id,backendGeneration:id,connectionGeneration:id};return new Response(JSON.stringify(route==='/api/bootstrap'?{capability:'TEST memory capability'}:{ok:true,result}),{headers:{'Content-Type':'application/json'}});};
 await installBrowserBridge();window.career.onPurge(notice=>window.purges.push(notice));await window.career.ready();`);
 const server=await createServer({configFile:false,root,cacheDir:path.join(root,'.vite'),server:{watch:null,host:'127.0.0.1',port:0,fs:{allow:[process.cwd()]}}});await server.listen();const address=server.httpServer!.address();if(!address||typeof address==='string')throw Error('TEST server');
 const browser=await chromium.launch({channel:'chrome',headless:true});try{const page=await browser.newPage();await page.goto('http://127.0.0.1:'+address.port,{waitUntil:'domcontentloaded'});await expect.poll(()=>page.evaluate(()=>(window as any).delivered.length),{timeout:10000}).toBe(1);expect(await page.evaluate(()=>(window as any).delivered[0])).toEqual({kind:'feishu_cache_evicted',materialIds:['11111111-1111-4111-8111-111111111111'],previewRefs:[],recordRefs:[],all:false});expect(await page.evaluate(()=>(window as any).purges.length)).toBe(1);}finally{await browser.close();await server.close();await rm(root,{recursive:true,force:true});}
},60000);

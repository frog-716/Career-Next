import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium,type BrowserServer} from 'playwright';
import {z} from 'zod';
import path from 'node:path';
import {release} from 'node:os';
const Environment=z.strictObject({browserVersion:z.literal('153.0.8010.12'),executable:z.string(),platformRelease:z.string(),fonts:z.array(z.strictObject({path:z.string(),digest:z.string().regex(/^[a-f0-9]{64}$/)})),fontVersion:z.string().max(120)});
/** Fixed local engine/environment, static Career HTML only, no external resource access. */
export function createHeadlessPdfEngine(manifestFile:string,onBrowserStarted?:(pid:number)=>void){
 let server:BrowserServer|undefined,cancelled=false;
 function environment(){try{return Environment.parse(JSON.parse(readFileSync(manifestFile,'utf8')));}catch{throw Error('pdf_environment_unavailable');}}
 return {async close(){cancelled=true;await server?.close();},metadata(){const env=environment();return {fontVersion:env.fontVersion,engineVersion:'chromium-'+env.browserVersion};},async print(html:string){
  const env=environment();if(env.platformRelease!==release())throw Error('pdf_environment_changed');const executable=path.resolve(path.dirname(manifestFile),env.executable);for(const font of env.fonts)if(createHash('sha256').update(readFileSync(font.path)).digest('hex')!==font.digest)throw Error('pdf_font_environment_changed');
  if(cancelled)throw Error('pdf_failed');
  server=await chromium.launchServer({host:'127.0.0.1',executablePath:executable,headless:true,args:['--disable-background-networking','--disable-component-update','--no-first-run'],timeout:30000});
  const pid=server.process().pid;if(pid)onBrowserStarted?.(pid);
  try{if(cancelled)throw Error('pdf_failed');const browser=await chromium.connect(server.wsEndpoint());if(browser.version()!==env.browserVersion)throw Error('pdf_engine_version_changed');const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',route=>route.abort());const page=await context.newPage();await page.goto('data:text/html,'+encodeURIComponent(html),{timeout:30000});await page.evaluate(()=>document.fonts.ready);const bytes=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,scale:1});if(!bytes.length||bytes.length>16*1024*1024)throw Error('pdf_failed');return bytes;}finally{await server.close();}
 }};
}

import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fork} from 'node:child_process';
import {z} from 'zod';
/** Printing has its own supervised process; terminating a Worker cannot release browser children. */
export function createHeadlessPrinter(manifestFile:string,safetyTimeoutMs=60000){
 const jobs=new Set<{stop:()=>void;done:Promise<void>}>();let closed=false;
 return {metadata(){const env=z.object({fontVersion:z.string().max(120),browserVersion:z.literal('153.0.8010.12')}).parse(JSON.parse(readFileSync(manifestFile,'utf8')));return {fontVersion:env.fontVersion,engineVersion:'chromium-'+env.browserVersion};},
  print(html:string):Promise<Buffer>{
   if(closed)return Promise.reject(Error('pdf_failed'));
   return new Promise((resolve,reject)=>{
    const child=fork(path.join(path.dirname(manifestFile),'print-worker.cjs'),[],{execArgv:[],serialization:'advanced',detached:true,stdio:['ignore','ignore','ignore','ipc'],env:{PATH:process.env.PATH,HOME:process.env.HOME}});
    let bytes:Buffer|undefined,browserPid:number|undefined,stopping=false,exited=false;
    let grace:NodeJS.Timeout|undefined,force:NodeJS.Timeout|undefined;
    const killBrowser=()=>{if(browserPid)try{process.kill(-browserPid,'SIGKILL');}catch{}};
    const stop=()=>{if(stopping||exited)return;stopping=true;if(child.connected)child.send({cancel:true},()=>{});grace=setTimeout(()=>{killBrowser();child.kill('SIGTERM');force=setTimeout(()=>child.kill('SIGKILL'),2000);},3000);};
    let done!:()=>void;const job={stop,done:new Promise<void>(resolve=>done=resolve)};jobs.add(job);
    const timeout=setTimeout(stop,safetyTimeoutMs);
    child.on('message',(message:any)=>{if(Number.isSafeInteger(message?.browserPid)&&message.browserPid>1)browserPid=message.browserPid;if(message?.browserClosed===true)browserPid=undefined;if(!stopping&&ArrayBuffer.isView(message?.bytes)&&message.bytes.BYTES_PER_ELEMENT===1&&message.bytes.length>0&&message.bytes.length<=16*1024*1024)bytes=Buffer.from(message.bytes);});
    child.once('error',stop);
    child.once('close',()=>{exited=true;clearTimeout(timeout);clearTimeout(grace);clearTimeout(force);killBrowser();jobs.delete(job);done();if(bytes&&!stopping)resolve(bytes);else reject(Error('pdf_failed'));});
    child.send({manifestFile,html},error=>{if(error)stop();});
   });
  },
  async close(){closed=true;const pending=[...jobs];pending.forEach(job=>job.stop());await Promise.allSettled(pending.map(job=>job.done));},
 };
}

import {spawn,execFile} from 'node:child_process';import {readFile,realpath} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {z} from 'zod';
const State=z.strictObject({port:z.number().int().min(1025).max(65535),pid:z.number().int().positive(),instance:z.string().min(20).max(100),host:z.literal('node-v1').optional(),phase:z.enum(['ready','stopping']).optional()});
export async function verifiedHost(profile:string){try{const value=State.parse(JSON.parse(await readFile(path.join(profile,'browser-host.json'),'utf8')));const response=await fetch(`http://127.0.0.1:${value.port}/host-status`,{redirect:'error',signal:AbortSignal.timeout(1500)});if(!response.ok)return;const status=await response.json();if(status.pid!==value.pid||status.instance!==value.instance||!status.ready)return;process.kill(value.pid,0);return value;}catch{return;}}
export async function launchCareer(profile:string,artifacts:string,openBrowser=true){
 let saved;try{saved=State.parse(JSON.parse(await readFile(path.join(profile,'browser-host.json'),'utf8')));}catch{}if(saved?.host==='node-v1'&&saved.phase==='stopping'){const deadline=Date.now()+30000;while(Date.now()<deadline){try{process.kill(saved.pid,0);}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH'){saved=undefined;break;}throw error;}await new Promise(resolve=>setTimeout(resolve,100));}if(saved)throw Error('backend_still_exiting');}
 let current=await verifiedHost(profile);if(current&&current.host!=='node-v1')throw Error('legacy_host_running');
 if(!current){
  const child=spawn(process.execPath,[path.join(artifacts,'node-host.cjs'),'--user-data-dir='+profile],{detached:true,stdio:'ignore',env:{PATH:'/usr/bin:/bin',HOME:os.homedir()}});let failed=false;child.once('error',()=>{failed=true;});child.once('exit',()=>{failed=true;});child.unref();
  const deadline=Date.now()+30000;while(Date.now()<deadline){current=await verifiedHost(profile);if(current?.host==='node-v1')break;if(failed)throw Error('backend_start_failed');await new Promise(resolve=>setTimeout(resolve,100));}
  if(!current||current.host!=='node-v1')throw Error('backend_start_failed');
 }
 const url=`http://127.0.0.1:${current.port}`;
 if(openBrowser)await new Promise<void>((resolve,reject)=>execFile('/usr/bin/open',['-a','Google Chrome',url],error=>error?reject(Error('chrome_unavailable')):resolve()));
 return {url,pid:current.pid,instance:current.instance};
}
export async function stopCareer(profile:string){const state=await verifiedHost(profile);if(!state||state.host!=='node-v1')throw Error('node_host_not_running');process.kill(state.pid,'SIGTERM');const deadline=Date.now()+30000;while(Date.now()<deadline){try{process.kill(state.pid,0);}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return;throw error;}await new Promise(resolve=>setTimeout(resolve,100));}throw Error('backend_still_exiting');}
async function main(){const args=process.argv.slice(2),action=args.find(x=>['start','stop','status'].includes(x))??'start';if(args.some(x=>!['start','stop','status','--no-browser-open'].includes(x)&&!x.startsWith('--user-data-dir=')))throw Error('invalid_request');const profile=path.resolve(args.find(x=>x.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length)??path.join(os.homedir(),'Library/Application Support/Career Next'));
 if(action==='stop'){await stopCareer(profile);console.log('Career 本地后台已退出。');return;}if(action==='status'){const state=await verifiedHost(profile);console.log(JSON.stringify({running:!!state,host:state?.host??(state?'legacy':'none'),...state?{url:`http://127.0.0.1:${state.port}`,pid:state.pid}:{}}));return;}
 if(process.env.CAREER_LAUNCH_LOCKED!=='1')throw Error('native_launcher_required');console.log(JSON.stringify(await launchCareer(profile,__dirname,!args.includes('--no-browser-open'))));
}
if(require.main===module)void main().catch(error=>{const code=['legacy_host_running','chrome_unavailable','backend_start_failed','node_host_not_running','backend_still_exiting'].includes(error.message)?error.message:'launcher_failed';console.error(code);process.exitCode=1;});

import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const args=process.argv.slice(2),stop=args[0]==='stop';if(stop)args.shift();
if(args.some(arg=>!arg.startsWith('--user-data-dir=')))throw Error('Only an explicit profile path is accepted.');
const profile=path.resolve(args[0]?.slice('--user-data-dir='.length)??path.join(os.homedir(),'Library/Application Support/Career Next'));
if(stop){
 const state=JSON.parse(await readFile(path.join(profile,'browser-host.json'),'utf8'));
 if(!Number.isInteger(state.port)||state.port<1024||state.port>65535||!Number.isInteger(state.pid)||typeof state.instance!=='string')throw Error('Invalid launcher state');
 const status=await fetch(`http://127.0.0.1:${state.port}/host-status`,{redirect:'error',signal:AbortSignal.timeout(3000)}).then(response=>response.json());
 if(status.pid!==state.pid||status.instance!==state.instance)throw Error('The saved process is no longer this Career host.');
 process.kill(state.pid,'SIGTERM');
 const deadline=Date.now()+30000;let exited=false;
 while(Date.now()<deadline){try{process.kill(state.pid,0);}catch(error){if(error.code==='ESRCH'){exited=true;break;}throw error;}await new Promise(resolve=>setTimeout(resolve,50));}
 if(!exited)throw Error('Career is still exiting; do not start another writer.');
 console.log('Career 本地后台已退出。');
}else{
 // Electron is the packaged system host; Chrome is opened only after its backend and loopback server are ready.
 const electron=(await import('electron')).default;
 const child=spawn(electron,[path.resolve('.'),`--user-data-dir=${profile}`],{detached:true,stdio:'ignore'});child.unref();
 console.log('正在启动 Career 本地后台，准备好后会在 Chrome 打开。');
}

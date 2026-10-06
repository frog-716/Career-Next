import {readFile} from 'node:fs/promises';import path from 'node:path';import {createNodeHost,type NodeHostOptions} from './host';import {createRecoveryHost} from './recovery';import {durableJson} from '../../../packages/backend/platform/backup/managed-copies';
const args=process.argv.slice(2);if(args.length!==1||!args[0]?.startsWith('--user-data-dir='))throw Error('invalid_request');
const profile=path.resolve(args[0].slice('--user-data-dir='.length));let host:Awaited<ReturnType<typeof createNodeHost>>|Awaited<ReturnType<typeof createRecoveryHost>>|undefined,closing=false;
async function close(){if(closing)return;closing=true;if(host)durableJson(path.join(profile,'browser-host.json'),{port:Number(new URL(host.url).port),pid:process.pid,instance:host.instance,host:'node-v1',phase:'stopping'});await host?.close();process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
async function start(options:NodeHostOptions):Promise<void>{
 try{host=await createNodeHost(options);}catch(error){
  if((error as NodeJS.ErrnoException).code==='EADDRINUSE')return start({...options,port:0});
  if(error instanceof Error&&error.message==='active_pointer_invalid'){
   try{host=await createRecoveryHost({...options,reopen:async()=>{if(closing||!host)return;const port=Number(new URL(host.url).port);await host.close();host=undefined;await start({...options,port});}});}catch(recoveryError){if((recoveryError as NodeJS.ErrnoException).code==='EADDRINUSE')return start({...options,port:0});throw recoveryError;}
  }else throw error;
 }
 durableJson(path.join(profile,'browser-host.json'),{port:Number(new URL(host.url).port),pid:process.pid,instance:host.instance,host:'node-v1',phase:'ready'});process.send?.({ready:true});
}
void (async()=>{let port=47631;try{const state=JSON.parse(await readFile(path.join(profile,'browser-host.json'),'utf8'));if(Number.isInteger(state.port)&&state.port>1024&&state.port<65536)port=state.port;}catch{}
 await start({profile,artifacts:__dirname,webRoot:path.join(__dirname,'../materials-renderer'),port,requestExit:()=>void close()});
})().catch(()=>{console.error('CAREER_NODE_STARTUP_FAILED');void host?.close().finally(()=>process.exit(1));if(!host)process.exit(1);});

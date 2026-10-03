import {Worker} from 'node:worker_threads';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
export async function startWriter<Store extends {[K in keyof Store]:(...args:never[])=>unknown}>(root:string,generation:string,artifact=path.join(__dirname,'writer.cjs'),options?:{dataRoot?:string;control?:(action:string,args:unknown[])=>Promise<unknown>}){
 const worker=new Worker(path.resolve(artifact),{workerData:{root,generation,dataRoot:options?.dataRoot}});
 const pending=new Map<string,{resolve(result:unknown):void;reject(error:Error):void}>();let dead=false;
 let readyResolve!:()=>void,readyReject!:(error:Error)=>void;
 const ready=new Promise<void>((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 function failed(error:Error){dead=true;readyReject(error);for(const item of pending.values())item.reject(error);pending.clear();}
 worker.on('error',error=>failed(Error(error.message==='workspace_busy'?'workspace_busy':'db_failed')));
 worker.on('exit',()=>failed(Error('disconnected')));
 // Control requests can precede ready during interrupted-purge recovery.
 worker.on('message',message=>{if(message.ready===true){readyResolve();return;}if(message.control){void Promise.resolve(options?.control?.(message.control,message.args??[])).then(result=>worker.postMessage({controlReply:message.id,result}),()=>worker.postMessage({controlReply:message.id,error:'maintenance_failed'}));return;}const item=pending.get(message.id);if(!item)return;pending.delete(message.id);if(message.error)item.reject(Error(message.error));else item.resolve(message.result);});
 await ready;
 function send<T>(message:object):Promise<T>{if(dead)return Promise.reject(Error('disconnected'));return new Promise((resolve,reject)=>{const id=randomUUID();pending.set(id,{resolve:value=>resolve(value as T),reject});worker.postMessage({...message,id});});}
 return {call<K extends keyof Store>(method:K,...args:Parameters<Store[K]>):Promise<Awaited<ReturnType<Store[K]>>>{return send({call:{method,args}});},async close(){if(!dead){const exit=new Promise<void>(resolve=>worker.once('exit',()=>resolve()));await send({close:true});await exit;}}};
}
export type Writer=Awaited<ReturnType<typeof startWriter>>;

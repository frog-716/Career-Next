import {randomUUID} from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import { openWorkspace } from '../platform/database/database';
import { materialsMigration } from '../domains/materials/migration';
import { createWriterCommands } from './writer-commands';
import { releases } from './releases';
async function start() {
const workspace = await openWorkspace(workerData.root, materialsMigration,releases);
let workspaceClosed=false;const closeWorkspace=()=>{if(!workspaceClosed){workspace.close();workspaceClosed=true;}};
const controls=new Map<string,{resolve(value:unknown):void;reject(error:Error):void}>();
function control(action:string,...args:unknown[]):Promise<unknown>{return new Promise((resolve,reject)=>{const id=randomUUID();controls.set(id,{resolve,reject});parentPort!.postMessage({id,control:action,args});});}
const store=createWriterCommands(workspace.database,workspace.workspaceInstance,workerData.generation,{dataRoot:workerData.dataRoot??workerData.root,control:{drain:async refs=>{await control('drain',refs);},beforeActivate:async()=>{await control('beforeActivate');},maintenance:async work=>{await control('maintenance',true);try{return await work();}finally{await control('maintenance',false);}},closeWorkspace}});
parentPort!.on('message',(message:{controlReply?:string;result?:unknown;error?:string})=>{if(!message.controlReply)return;const item=controls.get(message.controlReply);if(item){controls.delete(message.controlReply);if(message.error)item.reject(Error(message.error));else item.resolve(message.result);}});
await store.lifecycleRecover();
parentPort!.postMessage({ ready: true });
let queue = Promise.resolve();
parentPort!.on('message', (message: { id: string; call?: {method: keyof typeof store;args:unknown[]}; close?: boolean;controlReply?:string;result?:unknown;error?:string }) => {
  if(message.controlReply){const item=controls.get(message.controlReply);if(item){controls.delete(message.controlReply);if(message.error)item.reject(Error(message.error));else item.resolve(message.result);}return;}
  // Read-only fence assertions must remain responsive while maintenance waits for file leases.
  if(message.call?.method==='persistenceAssert'){try{store.persistenceAssert(message.call.args[0] as Parameters<typeof store.persistenceAssert>[0]);parentPort!.postMessage({id:message.id,result:true});}catch{parentPort!.postMessage({id:message.id,error:'persistence_denied'});}return;}
  queue = queue.then(async () => {
  try {
    if (message.close) { closeWorkspace(); parentPort!.postMessage({ id: message.id, result: true }); parentPort!.close(); return; }
    const call = message.call!;
    const method = store[call.method] as (...args: unknown[]) => unknown;
    const result = await method(...call.args);
    parentPort!.postMessage({ id: message.id, result });
  } catch (error) {
    const allowed = ['invalid_capability','file_failed','storage_failed','conflict','not_found','workspace_busy','invalid_request','persistence_denied','maintenance_busy'];
    const code = error instanceof Error && allowed.includes(error.message) ? error.message : 'db_failed';
    parentPort!.postMessage({ id: message.id, error: code });
  }
  });
});

}
void start().catch(error => {throw error;});

import type {ProviderAdapter} from '../../contracts/ai/provider';
import type {DispatchIntent} from './ports';
export interface AiWriterControllerPort {
 prepareDispatch(operationId:string):Promise<DispatchIntent>;
 markProcessing(operationId:string):Promise<void>;
 settle(operationId:string,response:unknown):Promise<void>;
 markUnknown(operationId:string,reason?:string):Promise<void>;
 failOperation(operationId:string,reason:string):Promise<void>;
 cancelBeforeHandoff(operationId:string):Promise<void>;
 stop(taskId:string,mode:'stop'|'revoke'):Promise<void>;
}
/** Lives on utility control loop. Never owns SQLite or exposes a manual user session. */
export function createAiController(writer:AiWriterControllerPort,adapter:ProviderAdapter){
 const closed=new Set<string>(),purged=new Set<string>(),paused=new Map<string,number>(),pauseLeases=new Map<object,string[]>(),activePauses=new Map<string,number>(),authorized=new Map<string,Map<string,number>>(),running=new Map<string,{taskId:string;abort:AbortController;intent?:DispatchIntent}>();let shutDown=false;
 const references=(intent:DispatchIntent)=>[...intent.manifest.provenance.map(ref=>ref.owner+'/'+ref.objectId),'wiki/'+(intent.manifest.target.scopeId??`scope:${intent.manifest.target.scope}`),...(intent.manifest.target.scopeId?[intent.manifest.target.scope+'/'+intent.manifest.target.scopeId]:[])];
 const touches=(intent:DispatchIntent,operationId:string)=>references(intent).some(key=>purged.has(key)||(activePauses.get(key)??0)>0||(paused.get(key)??0)>(authorized.get(operationId)?.get(key)??0));
 function stop(taskId:string,mode:'stop'|'revoke'){
  closed.add(taskId);for(const entry of running.values())if(entry.taskId===taskId)entry.abort.abort();
  return writer.stop(taskId,mode);
 }
 async function start(taskId:string,operationId:string){
  if(shutDown||closed.has(taskId))throw Error('task_closed');if(running.has(operationId))throw Error('operation_in_flight');
  const entry:{taskId:string;abort:AbortController;intent?:DispatchIntent}={taskId,abort:new AbortController()};running.set(operationId,entry);
  try{
   const intent=await writer.prepareDispatch(operationId);
   entry.intent=intent;if(shutDown||closed.has(taskId)||entry.abort.signal.aborted||touches(intent,operationId)){await writer.cancelBeforeHandoff(operationId);return;}
   if(intent.taskId!==taskId||JSON.stringify(intent.manifest.recipient)!==JSON.stringify(adapter.recipient)||adapter.network!=='none'){await writer.cancelBeforeHandoff(operationId);throw Error('provider_binding_mismatch');}
   // No await between final live-gate check and transport handoff.
   const response=adapter.send({operationId,manifest:intent.manifest,manifestDigest:intent.manifestDigest},entry.abort.signal);
   // A fast rejection is handled while a slow writer records processing.
   void response.catch(()=>{});
   await writer.markProcessing(operationId);
   try{const output=await response;if(shutDown||touches(intent,operationId)){await writer.markUnknown(operationId,'remote_outcome_unconfirmed');return;}await writer.settle(operationId,output);}catch(error){const reason=error instanceof Error?error.message:'provider_failure';if(['timeout','outcome_unknown','aborted'].includes(reason)||entry.abort.signal.aborted)await writer.markUnknown(operationId,'remote_outcome_unconfirmed');else await writer.failOperation(operationId,'provider_failure');}
  }finally{running.delete(operationId);authorized.delete(operationId);}
 }
 // Called only after a new, trusted human authorization has committed in the writer.
 function closeAffected(){for(const [id,entry] of running)if(entry.intent&&touches(entry.intent,id)){closed.add(entry.taskId);entry.abort.abort();}}
 return {start,stop,
  /** Capture on the utility loop when the live human authorization request enters, before awaiting the writer. */
  captureAuthorization:():ReadonlyMap<string,number>=>new Map([...paused].filter(([key])=>!activePauses.has(key))),
  openAfterAuthorization:(taskId:string,operationId?:string,snapshot?:ReadonlyMap<string,number>)=>{if(operationId&&running.has(operationId))return;closed.delete(taskId);if(operationId)authorized.set(operationId,new Map(snapshot??[]));},isClosed:(taskId:string)=>shutDown||closed.has(taskId),
  /** Synchronous admission boundary after a validated purge confirmation, before any async marker/drain. */
  pauseReferences(refs:readonly {owner:string;objectId:string}[]){const lease={},keys=[...new Set(refs.map(ref=>ref.owner+'/'+ref.objectId))];for(const key of keys){paused.set(key,(paused.get(key)??0)+1);activePauses.set(key,(activePauses.get(key)??0)+1);}pauseLeases.set(lease,keys);closeAffected();return lease;},
  /** End this request's temporary hold. Old authorizations stay invalid; permanent purge revocations stay closed. */
  finishPause(lease:object){const keys=pauseLeases.get(lease);if(!keys)return;pauseLeases.delete(lease);for(const key of keys){const count=(activePauses.get(key)??1)-1;if(count)activePauses.set(key,count);else activePauses.delete(key);}},
  revokeReferences(refs:readonly {owner:string;objectId:string}[]){for(const ref of refs)purged.add(ref.owner+'/'+ref.objectId);closeAffected();},shutdown(){shutDown=true;for(const entry of running.values()){closed.add(entry.taskId);entry.abort.abort();}}};
}

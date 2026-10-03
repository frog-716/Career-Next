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
 const closed=new Set<string>(),running=new Map<string,{taskId:string;abort:AbortController}>();
 function stop(taskId:string,mode:'stop'|'revoke'){
  closed.add(taskId);for(const entry of running.values())if(entry.taskId===taskId)entry.abort.abort();
  return writer.stop(taskId,mode);
 }
 async function start(taskId:string,operationId:string){
  if(closed.has(taskId))throw Error('task_closed');if(running.has(operationId))throw Error('operation_in_flight');
  const entry={taskId,abort:new AbortController()};running.set(operationId,entry);
  try{
   const intent=await writer.prepareDispatch(operationId);
   if(closed.has(taskId)||entry.abort.signal.aborted){await writer.cancelBeforeHandoff(operationId);return;}
   if(intent.taskId!==taskId||JSON.stringify(intent.manifest.recipient)!==JSON.stringify(adapter.recipient)||adapter.network!=='none'){await writer.cancelBeforeHandoff(operationId);throw Error('provider_binding_mismatch');}
   // No await between final live-gate check and transport handoff.
   const response=adapter.send({operationId,manifest:intent.manifest,manifestDigest:intent.manifestDigest},entry.abort.signal);
   // A fast rejection is handled while a slow writer records processing.
   void response.catch(()=>{});
   await writer.markProcessing(operationId);
   try{await writer.settle(operationId,await response);}catch(error){const reason=error instanceof Error?error.message:'provider_failure';if(['timeout','outcome_unknown','aborted'].includes(reason)||entry.abort.signal.aborted)await writer.markUnknown(operationId,'remote_outcome_unconfirmed');else await writer.failOperation(operationId,'provider_failure');}
  }finally{running.delete(operationId);}
 }
 // Called only after a new, trusted human authorization has committed in the writer.
 return {start,stop,openAfterAuthorization:(taskId:string)=>closed.delete(taskId),isClosed:(taskId:string)=>closed.has(taskId)};
}

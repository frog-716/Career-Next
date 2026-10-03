import {ProviderBinding} from '../platform/providers/binding';
import {safeManagedPath} from '../platform/backup/managed-copies';
import {randomUUID,createHash} from 'node:crypto';
import {mkdir,open,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {startWriter} from '../platform/database/client';
import {createMaterialsBackend} from '../domains/materials/public';
import {renderSnapshot} from '../domains/resume/public';
import {createBlobBroker} from '../platform/files/blobs';
import {createPersistenceSinkGate,type PersistenceToken,type PersistenceReference} from '../platform/persistence/fence';
import type {ProductionSinkAdapter} from '../platform/files/staging';
import {createAiController} from '../ai-runtime/controller';
import {createDeterministicFakeProvider} from '../platform/providers/deterministic-fake';
import {Request as AiRequest,Result as AiResult} from '../../contracts/ai/schema';
import {Request as DataRequest,Result as DataResult} from '../../contracts/application/schema';
import {Result as ResumeResult} from '../../contracts/resume/schema';
import type {HumanSession} from '../platform/runtime/sessions';
import type {BusinessModule} from '../../contracts/common/bridge';
import type {RuntimeStore} from './writer-commands';
import {createLocalSearch} from '../platform/search/public';
import {LocalSearchRequest,LocalSearchResult} from '../../contracts/application/local-search';
const maximumPdfBytes=16*1024*1024;
export async function createRuntimeBackend(initialRoot:string,writerArtifact?:string,dataRoot=initialRoot,options?:{automaticBackups?:boolean;providerBinding?:ProviderBinding}){
 let providerBinding:ProviderBinding=options?.providerBinding??{enabled:true,generation:'fake-v1'},bindingEpoch=0;let root=initialRoot,closing=false,maintenance=false,admission=true,currentSession:HumanSession|undefined;
 const purgePlans=new Map<string,{workspace:string;refs:PersistenceReference[];copies:string[]}>();
 const operations=new Set<Promise<unknown>>(),prints=new Map<string,Promise<ResumeResult>>(),tokens=new Map<string,PersistenceToken>();
 let writer!:Awaited<ReturnType<typeof startWriter<RuntimeStore>>>;
 let materials!:Awaited<ReturnType<typeof createMaterialsBackend>>;
 let blobs!:ReturnType<typeof createBlobBroker>;
 let gate!:ReturnType<typeof createPersistenceSinkGate>;
 let controller!:ReturnType<typeof createAiController>;
 let localSearch!:ReturnType<typeof createLocalSearch>;
 function track<T>(job:Promise<T>){operations.add(job);void job.finally(()=>operations.delete(job)).catch(()=>{});return job;}
 function assertCurrent(session:HumanSession){if(!currentSession||session.actor?.kind!=='human'||session.actor.token!==currentSession.actor.token||session.workspaceInstance!==currentSession.workspaceInstance||session.backendGeneration!==currentSession.backendGeneration||session.connectionGeneration!==currentSession.connectionGeneration)throw Error('invalid_capability');}
 function allowed(){if(closing||maintenance||!admission)throw Error('maintenance_busy');}
 function adapter(token:PersistenceToken,boundGate=gate):ProductionSinkAdapter {tokens.set(token.id,token);return {controlledSink:filename=>boundGate.controlledSink(token,filename),withLease:work=>boundGate.withLease(token,work)};}
 async function drain(refs:readonly PersistenceReference[]){controller?.revokeReferences(refs);await gate.drainAndDiscard(refs);}
 async function initialize(){await mkdir(root,{recursive:true,mode:0o700});admission=true;
 writer=await startWriter<RuntimeStore>(root,randomUUID(),writerArtifact,{dataRoot,control:async(action,args)=>{if(action==='renewProfile'){gate.allowRenewedProfile(args[0] as number);return;}if(action==='drain'){await drain(args[0] as PersistenceReference[]);return;}if(action==='beforeActivate'){admission=false;controller?.shutdown();await drain([...tokens.values()].flatMap(t=>[...t.inputs,...t.targets]));return;}if(action==='maintenance'){maintenance=args[0]===true;return;}throw Error('invalid_request');}});
 await writer.call('providerBinding',providerBinding);const boundWriter=writer;gate=createPersistenceSinkGate(async token=>{if(!admission)throw Error('persistence_denied');await boundWriter.call('persistenceAssert',token);});
 const boundGate=gate;materials=await createMaterialsBackend(root,undefined,undefined,boundWriter,async id=>adapter(await boundWriter.call('producerToken',id),boundGate));
 const establish=materials.connectHuman.bind(materials);materials.connectHuman=async()=>{const session=await establish();currentSession=session;return session;};
 blobs=createBlobBroker(root,maximumPdfBytes);await blobs.initialize();
 makeController();
 localSearch=createLocalSearch(root,writerArtifact?path.join(path.dirname(writerArtifact),'local-search.cjs'):undefined);
 }
 function makeController(){const aiWriter=writer;controller=createAiController({prepareDispatch:id=>aiWriter.call('aiPrepareDispatch',id),markProcessing:id=>aiWriter.call('aiMarkProcessing',id),settle:(id,value)=>aiWriter.call('aiSettle',id,value),markUnknown:(id,reason)=>aiWriter.call('aiMarkUnknown',id,reason),failOperation:(id,reason)=>aiWriter.call('aiFailOperation',id,reason),cancelBeforeHandoff:id=>aiWriter.call('aiCancelBeforeHandoff',id),stop:async(taskId,mode,commandId)=>{if(!currentSession||!commandId)throw Error('invalid_capability');await aiWriter.call('business',currentSession,'ai',{operation:'ai.stop',commandId,taskId,mode});}},createDeterministicFakeProvider(providerBinding.generation));if(!providerBinding.enabled)controller.setProviderBinding(undefined);
 }
 // Writer startup recovery can request drain before there is any producer/sink.
 gate=createPersistenceSinkGate(()=>{throw Error('persistence_denied');});await initialize();
 const automatic=setInterval(()=>{if(options?.automaticBackups!==false&&!closing&&!maintenance&&admission)void writer.call('automaticBackup').catch(()=>{});},60000);automatic.unref();
 async function completePdf(session:HumanSession,commandId:string,input:Uint8Array):Promise<ResumeResult>{const boundWriter=writer,boundMaterials=materials,boundBlobs=blobs;
  await boundWriter.call('pdfCheck',session,commandId);const token=await boundWriter.call('producerToken',commandId),sink=adapter(token),bytes=Buffer.from(input);
  if(bytes.length===0||bytes.length>maximumPdfBytes||bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.subarray(-1024).includes(Buffer.from('%%EOF')))return boundWriter.call('pdfFail',commandId);
  const artifact={blobId:randomUUID(),digest:createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
  try{const prepared=await boundWriter.call('pdfPrepare',session,commandId,artifact);if(prepared.kind==='receipt')return ResumeResult.parse(prepared.result);
   await boundBlobs.publishBytes(artifact.blobId,bytes,artifact.digest,()=>boundWriter.call('persistenceAssert',token),sink);
   const published=await boundBlobs.readBytes(artifact.blobId,artifact.digest,sink);if(published.length!==artifact.size)throw Error('storage_failed');
   await boundWriter.call('pdfPublished',session,commandId,artifact.blobId);return ResumeResult.parse(await boundWriter.call('pdfCommit',session,commandId,artifact));
  }catch{const result=await boundWriter.call('pdfFail',commandId);await boundMaterials.collectGarbage().catch(()=>{});return ResumeResult.parse(result);}
 }
 return {
 configureProvider(input:unknown){const next=ProviderBinding.parse(input),epoch=++bindingEpoch;controller.setProviderBinding(undefined);controller.shutdown();providerBinding=next;track(writer.call('providerBinding',next).then(()=>{if(!closing&&epoch===bindingEpoch)makeController();})).catch(()=>{});},
 get materials(){return materials;},
 async search(session:HumanSession,input:unknown){
  allowed();assertCurrent(session);const request=LocalSearchRequest.parse(input),bound=localSearch,boundWriter=writer;
  // One bounded maintenance batch, then yield back to the independent control loop.
  const maintenanceState=await boundWriter.call('searchMaintenance',session);
  const result=LocalSearchResult.parse(await bound.search(request));
  allowed();assertCurrent(session);if(bound!==localSearch)return LocalSearchResult.parse({kind:'local-search.failure',code:'disconnected',partial:true,notice:'结果未完整检索'});
  if(result.kind!=='local-search.results')return result;
  const readable=new Set(await boundWriter.call('searchReadable',session,request,result.items));
  const items=result.items.filter(item=>readable.has(item.id)),partial=result.partial||maintenanceState.pending||items.length!==result.items.length;
  return {...result,items,partial,notice:partial?'结果未完整检索' as const:'检索完成' as const};
 },
 async connectHuman(){allowed();currentSession=await materials.connectHuman();await Promise.allSettled([...operations]);await writer.call('recoverPending');await materials.collectGarbage();if(options?.automaticBackups!==false)await writer.call('automaticBackup').catch(()=>{});return currentSession;},
 business(session:HumanSession,module:BusinessModule,input:unknown){const parsed=module==='ai'?AiRequest.safeParse(input):undefined;const control=parsed?.success&&['ai.stop','product.stop'].includes(parsed.data.operation);if(control){if(closing)throw Error('disconnected');}else allowed();return track((async()=>{assertCurrent(session);const boundController=controller;const authorization=module==='ai'&&['ai.authorize','product.authorize'].includes(AiRequest.parse(input).operation)?boundController.captureAuthorization():undefined;let pause:object|undefined;
 if(module==='application'){const request=DataRequest.parse(input);if(request.operation==='data.purge.confirm'){const plan=purgePlans.get(request.planId);if(plan?.workspace===session.workspaceInstance&&request.selectedCopyIds.every(id=>plan.copies.includes(id))){pause=boundController.pauseReferences(plan.refs);await localSearch.close();}}}
 try{
  if(module==='ai'){const request=AiRequest.parse(input);if(request.operation==='ai.stop'||request.operation==='product.stop'){const persistence=controller.stop(request.taskId,request.mode,request.commandId);track(persistence).catch(()=>{});return AiResult.parse({kind:'execution_blocked',taskId:request.taskId,commandId:request.commandId,mode:request.mode,dispatchBlocked:true,persistencePending:true});}}
  const result=await writer.call('business',session,module,input);
  if(module==='ai'){const request=AiRequest.parse(input),value=AiResult.parse(result);if((request.operation==='ai.authorize'||request.operation==='product.authorize')&&(value.kind==='task'||value.kind==='product_task')&&value.task.operations.some(op=>op.id===request.operationId&&op.state==='not_sent'&&op.authorized)){boundController.openAfterAuthorization(value.task.id,request.operationId,authorization);void boundController.start(value.task.id,request.operationId).catch(()=>{});}}
  if(module==='application'){const value=DataResult.parse(result);if(value.kind==='purge_plan')purgePlans.set(value.plan.id,{workspace:session.workspaceInstance,refs:value.plan.impact.references,copies:value.plan.copies.map(c=>c.id)});if(value.kind==='restored'){await localSearch.close();await writer.close();root=path.resolve(dataRoot,value.copy.relativePath);tokens.clear();prints.clear();currentSession=undefined;await initialize();}}
  if(module==='application'&&!admission&&DataResult.parse(result).kind==='failure'){await writer.close();const pointer=JSON.parse(await readFile(path.join(dataRoot,'active-workspace-pointer.json'),'utf8'));root=safeManagedPath(dataRoot,pointer.relativePath);tokens.clear();prints.clear();currentSession=undefined;await initialize();return DataResult.parse({kind:'failure',code:'restore_failed_reconnected'});}
  if(module==='application'&&(input as {operation:string}).operation==='feedback.discard-screenshot')await materials.collectGarbage();
  return result;
 }finally{if(pause){boundController.finishPause(pause);if(!closing&&admission)localSearch=createLocalSearch(root,writerArtifact?path.join(path.dirname(writerArtifact),'local-search.cjs'):undefined);}}
 })());},
 async selectSentFile(session:HumanSession,filename:string){allowed();const boundWriter=writer,boundMaterials=materials,boundBlobs=blobs;if(!['.pdf','.txt','.md','.png','.jpg','.jpeg','.webp'].includes(path.extname(filename).toLowerCase()))throw Error('unsupported_file');return track((async()=>{const token=await boundWriter.call('artifactToken',session),sink=adapter(token);let prepared:{id:string;blobId:string}|undefined;
 try{const bytes=await sink.withLease(async()=>{await boundWriter.call('persistenceAssert',token);const handle=await open(filename,constants.O_RDONLY|constants.O_NOFOLLOW);try{const info=await handle.stat();if(!info.isFile()||info.size<1||info.size>maximumPdfBytes)throw Error('unsupported_file');const buffer=Buffer.alloc(info.size+1);let count=0;while(count<buffer.length){await boundWriter.call('persistenceAssert',token);const value=await handle.read(buffer,count,Math.min(65536,buffer.length-count),count);if(!value.bytesRead)break;count+=value.bytesRead;}if(count!==info.size)throw Error('file_failed');return buffer.subarray(0,count);}finally{await handle.close();}});
 const digest=createHash('sha256').update(bytes).digest('hex');prepared=await boundWriter.call('artifactPrepare',session,token,path.basename(filename),digest,bytes.length);await boundBlobs.publishBytes(prepared.blobId,bytes,digest,()=>boundWriter.call('persistenceAssert',token),sink);return await boundWriter.call('artifactComplete',session,token,prepared.id);
 }catch(error){if(prepared)await boundWriter.call('artifactFail',prepared.id).catch(()=>{});await boundMaterials.collectGarbage().catch(()=>{});throw error;}})());},
 async printHtml(session:HumanSession,commandId:string){allowed();const snapshot=await writer.call('pdfCheck',session,commandId);return {html:renderSnapshot(snapshot)};},
 completePdf(session:HumanSession,commandId:string,input:Uint8Array){allowed();const key=session.connectionGeneration+'/'+commandId,previous=prints.get(key);if(previous)return previous;const job=track(completePdf(session,commandId,input));prints.set(key,job);void job.finally(()=>prints.delete(key)).catch(()=>{});return job;},
 failPdf(session:HumanSession,commandId:string){const boundWriter=writer;return track((async()=>{await boundWriter.call('pdfCheck',session,commandId);return boundWriter.call('pdfFail',commandId);})());},
 async close(){closing=true;controller.shutdown();await localSearch.close();clearInterval(automatic);await Promise.allSettled([...operations]);await materials.close();},
 };
}

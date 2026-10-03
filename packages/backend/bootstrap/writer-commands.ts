import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createPersistenceFence,type PersistenceToken,type PersistenceReference} from '../platform/persistence/fence';
import {createAiRuntime} from '../ai-runtime/public';
import {composeAiPorts} from './ai-composition';
import {composeLifecycle,type LifecycleControl} from './lifecycle-composition';
import type Database from 'better-sqlite3';
import { createMaterialsStore } from '../domains/materials/store';
import { createSessions,type HumanSession } from '../platform/runtime/sessions';
import { createLedger } from '../platform/database/ledger';
import { composeDomains } from './domain-registry';
import type { BusinessModule } from '../../contracts/common/bridge';
import {Request as ProfileRequest} from '../../contracts/profile/schema';
import { PdfArtifact,Result as ResumeResult } from '../../contracts/resume/schema';
export function createWriterCommands(db:Database.Database,workspaceInstance:string,generation:string,options?:{dataRoot:string;control:LifecycleControl}){
 const authority=createSessions(workspaceInstance,generation);
 const materials=createMaterialsStore(db,workspaceInstance,generation,authority);
 const root=path.dirname(db.name),ledger=createLedger(db),fence=createPersistenceFence(db,{workspaceInstance,backendGeneration:generation});
 let human=false;let currentHuman:HumanSession|undefined;let ai!:ReturnType<typeof createAiRuntime>;let lifecycle!:ReturnType<typeof composeLifecycle>;
 const domains=composeDomains(db,materials,{ai:{handle:input=>ai.handle(input,'human')},application:{handle:input=>lifecycle.handle(input,'human')}});
 ai=createAiRuntime(db,composeAiPorts(domains,materials,root,{workspaceInstance,backendGeneration:generation},fence,()=>{try{if(!currentHuman)return false;authority.check(currentHuman);return true;}catch{return false;}}));
 const control=options?.control??{drain:async()=>{},beforeActivate:async()=>{},maintenance:async<T>(work:()=>Promise<T>)=>work(),closeWorkspace:()=>{throw Error('restore_unavailable');}};
 lifecycle=composeLifecycle(db,domains,materials,fence,ai,root,options?.dataRoot??root,control,()=>currentHuman);
 const producers=new Map<string,PersistenceToken>();
 function capture(id:string,inputs:PersistenceReference[],targets:PersistenceReference[]){if(producers.has(id))return assertProducer(id);const token=fence.capture({producerId:id,inputs,targets});producers.set(id,token);return token;}
 function assertProducer(id:string){const token=producers.get(id);if(!token)throw Error('invalid_capability');fence.assert(token);return token;}
 domains.files.recover();
 const physicalCommand=(id:string)=>'resume.version/'+id;
 function recoverPending(){for(const id of domains.resume.recoverPendingVersions())ledger.fail(physicalCommand(id),'invalid_capability');}
 recoverPending();
 return {...materials,
  connect(){currentHuman=materials.connect();return currentHuman;},
  async business(session:HumanSession,module:BusinessModule,input:unknown){authority.check(session);human=true;try{if(module==='profile'&&ProfileRequest.parse(input).operation==='profile.save'){let renewal:{renewed:boolean;generation:number}|undefined;const before=domains.profile.read().revision;const result=db.transaction(()=>{const saved=domains.profile.handle(input);if(saved.status==='profile'&&saved.profile.revision>before)renewal=fence.renewProfileAfterHumanSave({actor:'human',ownerRevision:saved.profile.revision});return saved;})();if(renewal?.renewed)await control.renewProfile?.(renewal.generation);return result;}const result=await domains.handle(module,input);if(module==='resume'){const parsed=ResumeResult.parse(result);if(parsed.status==='pending-job')capture((input as {commandId:string}).commandId,[{owner:'resume',objectId:parsed.job.resumeId},{owner:'profile',objectId:'current'}],[{owner:'resume',objectId:parsed.job.resumeId}]);}return result;}finally{human=false;}},
  begin(session:HumanSession,name:string){const id=materials.begin(session,name);capture(id,[],[{owner:'import',objectId:id}]);return id;},
  valid(session:HumanSession,id:string){assertProducer(id);return materials.valid(session,id);},
  preview(session:HumanSession,input:Parameters<typeof materials.preview>[1]){assertProducer(input.importId);return materials.preview(session,input);},
  published(session:HumanSession,input:Parameters<typeof materials.published>[1],blobId:string){assertProducer(input.importId);return materials.published(session,input,blobId);},
  commit(session:HumanSession,input:Parameters<typeof materials.commit>[1],blobId:string){assertProducer(input.importId);return materials.commit(session,input,blobId);},
  producerToken(id:string){return assertProducer(id);},
  persistenceAssert(token:PersistenceToken){fence.assert(token);},
  persistenceReferences(){return [...producers.values()].flatMap(t=>[...t.inputs,...t.targets]);},
  aiPrepareDispatch:ai.prepareDispatch,aiMarkProcessing:ai.markProcessing,aiSettle:ai.settle,aiMarkUnknown:ai.markUnknown,aiFailOperation:ai.failOperation,aiCancelBeforeHandoff:ai.cancelBeforeHandoff,
  aiStop(taskId:string,mode:'stop'|'revoke',commandId:string){human=true;try{return ai.handle({operation:'ai.stop',commandId,taskId,mode},'human');}finally{human=false;}},
  lifecycleRecover:()=>lifecycle.recoverPendingPurges(),automaticBackup:()=>lifecycle.automaticCheck(),
  artifactToken(session:HumanSession){authority.check(session);const id=randomUUID();return capture(id,[],[{owner:'actual-artifact',objectId:id}]);},
  artifactPrepare(session:HumanSession,token:PersistenceToken,name:string,digest:string,size:number){authority.check(session);fence.assert(token);return domains.files.prepare(name,digest,size,token.producerId);},
  artifactComplete(session:HumanSession,token:PersistenceToken,id:string){authority.check(session);fence.assert(token);const value=domains.files.complete(id);if(!value)throw Error('file_failed');return {kind:'artifact' as const,id,name:value.name};},
  artifactFail(id:string){domains.files.purge(id);},
  recoverPending(){db.transaction(recoverPending)();},
  pdfPrepare(session:HumanSession,commandId:string,input:unknown){
   authority.check(session);assertProducer(commandId);const artifact=PdfArtifact.parse(input);
   const result=ResumeResult.parse(domains.resume.handle({operation:'resume.receipt',commandId}));
   if(result.status!=='pending-job')return {kind:'receipt' as const,result};
   db.transaction(()=>ledger.hold(physicalCommand(commandId),result.job.contentHash,artifact.blobId,artifact.digest,artifact.size,generation,'resume.version'))();
   return {kind:'publish' as const,artifact};
  },
  pdfCheck(session:HumanSession,commandId:string){authority.check(session);assertProducer(commandId);const job=domains.pendingPrint(commandId);if(!job)throw Error('invalid_capability');return job;},
  pdfCommit(session:HumanSession,commandId:string,input:unknown){
   authority.check(session);assertProducer(commandId);const artifact=PdfArtifact.parse(input);
   return domains.resume.completeVersion(commandId,artifact,versionId=>{
    ledger.verifyHold(artifact.blobId,physicalCommand(commandId),generation);
    const held=ledger.describe(artifact.blobId);if(!held||held.digest!==artifact.digest||held.size!==artifact.size)throw Error('invalid_capability');
    ledger.retain(artifact.blobId,versionId,physicalCommand(commandId),'resume');
   });
  },
  pdfPublished(session:HumanSession,commandId:string,blobId:string){authority.check(session);assertProducer(commandId);db.transaction(()=>ledger.published(blobId,physicalCommand(commandId)))();},
  pdfFail(commandId:string){return db.transaction(()=>{ledger.fail(physicalCommand(commandId),'storage_failed');return domains.resume.failVersion(commandId);})();},
 };
}
export type RuntimeStore=ReturnType<typeof createWriterCommands>;

import type Database from 'better-sqlite3';
import { createMaterialsStore } from '../domains/materials/store';
import { createSessions,type HumanSession } from '../platform/runtime/sessions';
import { createLedger } from '../platform/database/ledger';
import { composeDomains } from './domain-registry';
import type { BusinessModule } from '../../contracts/common/bridge';
import { PdfArtifact,Result as ResumeResult } from '../../contracts/resume/schema';
export function createWriterCommands(db:Database.Database,workspaceInstance:string,generation:string){
 const authority=createSessions(workspaceInstance,generation);
 const materials=createMaterialsStore(db,workspaceInstance,generation,authority);
 const domains=composeDomains(db,materials),ledger=createLedger(db);
 const physicalCommand=(id:string)=>'resume.version/'+id;
 function recoverPending(){for(const id of domains.resume.recoverPendingVersions())ledger.fail(physicalCommand(id),'invalid_capability');}
 recoverPending();
 return {...materials,
  business(session:HumanSession,module:BusinessModule,input:unknown){authority.check(session);return domains.handle(module,input);},
  recoverPending(){db.transaction(recoverPending)();},
  pdfPrepare(session:HumanSession,commandId:string,input:unknown){
   authority.check(session);const artifact=PdfArtifact.parse(input);
   const result=ResumeResult.parse(domains.resume.handle({operation:'resume.receipt',commandId}));
   if(result.status!=='pending-job')return {kind:'receipt' as const,result};
   db.transaction(()=>ledger.hold(physicalCommand(commandId),result.job.contentHash,artifact.blobId,artifact.digest,artifact.size,generation,'resume.version'))();
   return {kind:'publish' as const,artifact};
  },
  pdfCheck(session:HumanSession,commandId:string){authority.check(session);const job=domains.pendingPrint(commandId);if(!job)throw Error('invalid_capability');return job;},
  pdfCommit(session:HumanSession,commandId:string,input:unknown){
   authority.check(session);const artifact=PdfArtifact.parse(input);
   return domains.resume.completeVersion(commandId,artifact,versionId=>{
    ledger.verifyHold(artifact.blobId,physicalCommand(commandId),generation);
    const held=ledger.describe(artifact.blobId);if(!held||held.digest!==artifact.digest||held.size!==artifact.size)throw Error('invalid_capability');
    ledger.retain(artifact.blobId,versionId,physicalCommand(commandId),'resume');
   });
  },
  pdfPublished(session:HumanSession,commandId:string,blobId:string){authority.check(session);db.transaction(()=>ledger.published(blobId,physicalCommand(commandId)))();},
  pdfFail(commandId:string){return db.transaction(()=>{ledger.fail(physicalCommand(commandId),'storage_failed');return domains.resume.failVersion(commandId);})();},
 };
}
export type RuntimeStore=ReturnType<typeof createWriterCommands>;

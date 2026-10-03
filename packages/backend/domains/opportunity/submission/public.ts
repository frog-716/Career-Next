import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {Request,Result,Submission,SentResume,type SentResumeInput} from '../../../../contracts/opportunity/submission/schema';
import {Snapshot,PdfArtifact} from '../../../../contracts/resume/schema';
import type {OpportunityCapabilities} from '../../../../contracts/opportunity/capabilities';
import {commandReceipt,executeCommand} from '../../../platform/commands/receipts';
export interface SentMaterialPorts {
 resolveFrozenResume(id:string):{name:string;snapshot:Snapshot;pdf:PdfArtifact}|undefined;
 resolveActualArtifact(id:string):{name:string;blobId:string;digest:string;size:number}|undefined;
 retainExisting(blobId:string,reason:'submission'|'communication',ownerKey:string):void;
 releaseRetention?(reason:'submission'|'communication',ownerKey:string):void;
}
/** Public freeze capability accepts only previously published, physically validated artifacts. */
export function freezeSentResume(input:SentResumeInput,ports:SentMaterialPorts):SentResume {
 if(input.kind!=='retained')return SentResume.parse(input);
 if(input.candidate.kind==='resume'){const candidate=ports.resolveFrozenResume(input.candidate.id);if(!candidate)throw Error('source_unavailable');return SentResume.parse({...input,name:candidate.name,snapshot:Snapshot.parse(candidate.snapshot),pdf:PdfArtifact.parse(candidate.pdf)});}
 const candidate=ports.resolveActualArtifact(input.candidate.id);if(!candidate)throw Error('source_unavailable');return SentResume.parse({...input,name:candidate.name,pdf:{blobId:candidate.blobId,digest:candidate.digest,size:candidate.size}});
}
export function createSubmissionDomain(db:Database.Database,ports:SentMaterialPorts&{core:OpportunityCapabilities}){
 function read(opportunityId:string){const row=db.prepare('SELECT body_json FROM opportunity_submission WHERE opportunity_id=?').get(opportunityId) as {body_json:string}|undefined;return row?Submission.parse(JSON.parse(row.body_json)):undefined;}
 function tombstone(opportunityId:string){return db.prepare('SELECT id FROM opportunity_submission_purged WHERE opportunity_id=?').get(opportunityId) as {id:string}|undefined;}
 function handle(input:unknown):Result {
  const parsed=Request.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};
  const request=parsed.data;
  try{
   if(request.operation==='submission.receipt'){const receipt=commandReceipt(db,'submission',request.commandId);return receipt===undefined?{kind:'receipt_missing'}:Result.parse(receipt);}
   const current=ports.core.readOpportunity(request.opportunityId);if(!current)throw Error('not_found');
   if(request.operation==='submission.read'){const purged=tombstone(request.opportunityId);if(purged)return {kind:'purged',id:purged.id};const submission=read(request.opportunityId);return submission?{kind:'submission',submission,opportunity:current}:{kind:'empty',opportunity:current};}
   return Result.parse(executeCommand(db,'submission',request.commandId,request,()=>{
    if(request.operation==='submission.correct-time'){const old=read(request.opportunityId);if(!old)throw Error('not_found');if(old.revision!==request.expectedRevision)throw Error('conflict');const core=ports.core.correctSubmissionTime({commandId:request.commandId,opportunityId:request.opportunityId,expectedRevision:request.expectedOpportunityRevision,eventId:old.coreEventId,businessTime:request.businessTime,reason:request.reason});const submission=Submission.parse({...old,revision:old.revision+1,businessTime:request.businessTime});db.prepare('UPDATE opportunity_submission SET body_json=? WHERE id=?').run(JSON.stringify(submission),old.id);db.prepare('INSERT INTO opportunity_submission_commands VALUES (?,?)').run(request.commandId,old.id);return {kind:'submission',submission,opportunity:core.opportunity};}
    if(read(request.opportunityId)||tombstone(request.opportunityId))throw Error('already_exists');
    if(current.revision!==request.expectedOpportunityRevision)throw Error('conflict');
    const id=randomUUID();const resume=freezeSentResume(request.resume,ports);
    if(resume.kind==='retained')ports.retainExisting(resume.pdf.blobId,'submission',id);
    const core=ports.core.recordStage({commandId:request.commandId,opportunityId:request.opportunityId,expectedRevision:request.expectedOpportunityRevision,stage:'submitted',businessTime:request.businessTime,reason:request.reason});
    if(!core.opportunity||!core.eventId)throw Error('storage_failed');
    const submission=Submission.parse({id,opportunityId:request.opportunityId,revision:1,resume,greeting:request.greeting,businessTime:request.businessTime,recordedAt:new Date().toISOString(),historical:request.historical,coreEventId:core.eventId});
    db.prepare('INSERT INTO opportunity_submission VALUES (?,?,?)').run(id,request.opportunityId,JSON.stringify(submission));
    db.prepare('INSERT INTO opportunity_submission_commands VALUES (?,?)').run(request.commandId,id);
    return {kind:'submission',submission,opportunity:core.opportunity};
   }));
  }catch(error){const message=error instanceof Error?error.message:'';return {kind:'failure',code:['not_found','conflict','already_exists','source_unavailable'].includes(message)?message as 'not_found':'storage_failed'};}
 }
 function describePurge(id:string){const row=db.prepare('SELECT body_json FROM opportunity_submission WHERE id=?').get(id) as {body_json:string}|undefined;if(!row)return undefined;const value=Submission.parse(JSON.parse(row.body_json));return {id:value.id,opportunityId:value.opportunityId,blobIds:value.resume.kind==='retained'?[value.resume.pdf.blobId]:[],retentionIds:[value.id]};}
 function purge(id:string){db.transaction(()=>{const item=describePurge(id);if(item)db.prepare('INSERT OR IGNORE INTO opportunity_submission_purged VALUES (?,?)').run(item.id,item.opportunityId);for(const row of db.prepare('SELECT command_id FROM opportunity_submission_commands WHERE submission_id=?').all(id) as {command_id:string}[])db.prepare("UPDATE platform_commands SET result_json=? WHERE owner='submission' AND command_id=?").run(JSON.stringify({kind:'purged',id}),row.command_id);ports.releaseRetention?.('submission',id);db.prepare('DELETE FROM opportunity_submission_commands WHERE submission_id=?').run(id);db.prepare('DELETE FROM opportunity_submission WHERE id=?').run(id);})();}
 return {handle,hasFirstSubmission:(opportunityId:string)=>!!read(opportunityId)||!!tombstone(opportunityId),describePurge,purge};
}

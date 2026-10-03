import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {Request,Result,Communication,History} from '../../../../contracts/opportunity/communication/schema';
import type {OpportunityCapabilities} from '../../../../contracts/opportunity/capabilities';
import {commandReceipt,executeCommand} from '../../../platform/commands/receipts';
import {freezeSentResume,type SentMaterialPorts} from '../submission/public';
export function createCommunicationDomain(db:Database.Database,ports:SentMaterialPorts&{core:OpportunityCapabilities;hasFirstSubmission(opportunityId:string):boolean}){
 function read(id:string){const row=db.prepare('SELECT body_json FROM opportunity_communication WHERE id=?').get(id) as {body_json:string}|undefined;return row?Communication.parse(JSON.parse(row.body_json)):undefined;}
 function handle(input:unknown):Result {
  const parsed=Request.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};
  const request=parsed.data;
  try{
   if(request.operation==='communication.receipt'){const receipt=commandReceipt(db,'communication',request.commandId);return receipt===undefined?{kind:'receipt_missing'}:Result.parse(receipt);}
   if(request.operation==='communication.read'){const communication=read(request.id);if(!communication)throw Error('not_found');return {kind:'communication',communication};}
   if(request.operation==='communication.list'){if(!ports.core.readOpportunity(request.opportunityId))throw Error('not_found');return {kind:'list',items:(db.prepare('SELECT body_json FROM opportunity_communication WHERE opportunity_id=? ORDER BY rowid DESC').all(request.opportunityId) as {body_json:string}[]).map(row=>Communication.parse(JSON.parse(row.body_json)))};}
   if(request.operation==='communication.history'){if(!read(request.id))throw Error('not_found');return {kind:'history',items:(db.prepare('SELECT event_json FROM opportunity_communication_history WHERE communication_id=? ORDER BY rowid DESC').all(request.id) as {event_json:string}[]).map(row=>History.parse(JSON.parse(row.event_json)))};}
   return Result.parse(executeCommand(db,'communication',request.commandId,request,()=>{
    const recordedAt=new Date().toISOString();let item:Communication;let type:'recorded'|'text_corrected'|'archived'|'restored'='recorded';
    if(request.operation==='communication.record'||request.operation==='communication.resend'){
     if(!ports.core.readOpportunity(request.opportunityId))throw Error('not_found');
     if(request.operation==='communication.resend'&&!ports.hasFirstSubmission(request.opportunityId))throw Error('first_submission_required');
     const id=randomUUID();const material=request.operation==='communication.resend'?freezeSentResume(request.resume,ports):undefined;
     if(material?.kind==='retained')ports.retainExisting(material.pdf.blobId,'communication',id);
     item=Communication.parse({id,opportunityId:request.opportunityId,revision:1,source:{owner:'communication',objectId:id,revision:1,locator:'text',scope:'opportunity',opportunityId:request.opportunityId},medium:request.operation==='communication.resend'?'text':request.medium,purpose:request.operation==='communication.resend'?'resend':request.purpose,text:request.text,businessTime:request.businessTime,recordedAt,historical:request.historical,archived:false,...material?{sentMaterial:material,greeting:request.operation==='communication.resend'?request.greeting:undefined}:{}});
    }else{
     const old=read(request.id);if(!old)throw Error('not_found');if(old.revision!==request.expectedRevision)throw Error('conflict');
     if(request.operation==='communication.correct'){const sourceRevision=old.source.revision+(request.text!==old.text?1:0);item={...old,text:request.text,revision:old.revision+1,source:{...old.source,revision:sourceRevision},businessTime:request.businessTime};type='text_corrected';}
     else{item={...old,revision:old.revision+1,archived:request.archived};type=request.archived?'archived':'restored';}
    }
    db.prepare('INSERT INTO opportunity_communication VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET body_json=excluded.body_json').run(item.id,item.opportunityId,JSON.stringify(item));
    const event=History.parse({id:randomUUID(),communicationId:item.id,revision:item.revision,type,reason:request.reason,businessTime:'businessTime'in request?request.businessTime:{kind:'unknown'},recordedAt});
    db.prepare('INSERT INTO opportunity_communication_history VALUES (?,?,?)').run(event.id,item.id,JSON.stringify(event));
    db.prepare('INSERT INTO opportunity_communication_commands VALUES (?,?)').run(request.commandId,item.id);
    return {kind:'saved',id:item.id,revision:item.revision};
   }));
  }catch(error){const message=error instanceof Error?error.message:'';return {kind:'failure',code:['not_found','conflict','first_submission_required','source_unavailable'].includes(message)?message as 'not_found':'storage_failed'};}
 }
 function resolveSource(ref:{owner:string;objectId:string;revision:number;locator:string;scope:string;opportunityId?:string}){
  const item=read(ref.objectId);if(!item||ref.owner!=='communication'||ref.locator!=='text'||ref.scope!=='opportunity'||ref.opportunityId!==item.opportunityId)return {status:'unavailable' as const};
  if(item.source.revision!==ref.revision)return {status:'old_version_unreadable' as const,currentRevision:item.source.revision};
  return {status:'available' as const,text:item.text,revision:item.source.revision,source:item.source};
 }
 function resolveSourceMetadata(ref:{owner:string;objectId:string;revision:number;locator:string;scope:string;opportunityId?:string}){const item=read(ref.objectId);if(!item||ref.owner!=='communication'||ref.locator!=='text'||ref.scope!=='opportunity'||ref.opportunityId!==item.opportunityId)return undefined;return {id:item.id,revision:item.source.revision,scope:'opportunity',source:item.source};}
 function describePurge(id:string){const item=read(id);return item?{id:item.id,opportunityId:item.opportunityId,blobIds:item.sentMaterial?.kind==='retained'?[item.sentMaterial.pdf.blobId]:[],retentionIds:[item.id]}:undefined;}
 function purge(id:string){db.transaction(()=>{for(const row of db.prepare('SELECT command_id FROM opportunity_communication_commands WHERE communication_id=?').all(id) as {command_id:string}[])db.prepare("UPDATE platform_commands SET result_json=? WHERE owner='communication' AND command_id=?").run(JSON.stringify({kind:'purged',id}),row.command_id);ports.releaseRetention?.('communication',id);db.prepare('DELETE FROM opportunity_communication_commands WHERE communication_id=?').run(id);db.prepare('DELETE FROM opportunity_communication_history WHERE communication_id=?').run(id);db.prepare('DELETE FROM opportunity_communication WHERE id=?').run(id);})();}
 return {handle,resolveSource,resolveSourceMetadata,describePurge,purge};
}

import {TranscriptSourceRef,type SourceRef} from '../../../../contracts/common/source-ref';
import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import type {OpportunityCapabilities} from '../../../../contracts/opportunity/capabilities';
import {OpportunityView} from '../../../../contracts/opportunity/schema';
import {z} from 'zod';
import {Request,Result,Session,History,ErrorCode} from '../../../../contracts/opportunity/interview/schema';
import {executeCommand,commandReceipt} from '../../../platform/commands/receipts';
export function createInterviewDomain(db:Database.Database,dependencies:{core:OpportunityCapabilities}){
 function read(id:string){const row=db.prepare('SELECT body FROM interview_sessions WHERE id=?').get(id) as {body:string}|undefined;return row?Session.parse(JSON.parse(row.body)):undefined;}
 function history(session:Session,type:string,reason:string,businessTime:Session['confirmationTime'],previousState?:string){const h=History.parse({id:randomUUID(),sessionId:session.id,type,reason,state:session.state,previousState,businessTime,recordedAt:new Date().toISOString()});db.prepare('INSERT INTO interview_history VALUES(?,?,?)').run(h.id,session.id,JSON.stringify(h));}
 function handle(input:unknown):Result{
  const parsed=Request.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};const r=parsed.data;
  try{
   if(r.operation==='interview.read'){const session=read(r.id);return session?{kind:'session',session}:{kind:'failure',code:'not_found'};}
   if(r.operation==='interview.list'){const opportunity=dependencies.core.readOpportunity(r.opportunityId);if(!opportunity)return {kind:'failure',code:'not_found'};return {kind:'sessions',opportunityRevision:opportunity.revision,items:(db.prepare('SELECT body FROM interview_sessions WHERE opportunity_id=? ORDER BY rowid').all(r.opportunityId) as {body:string}[]).map(row=>Session.parse(JSON.parse(row.body)))};}
   if(r.operation==='interview.history'){if(!read(r.id))return {kind:'failure',code:'not_found'};return {kind:'history',items:(db.prepare('SELECT body FROM interview_history WHERE session_id=? ORDER BY rowid DESC').all(r.id) as {body:string}[]).map(row=>History.parse(JSON.parse(row.body)))};}
   if(r.operation==='interview.receipt'){const value=commandReceipt(db,'interview',r.commandId);return value?Result.parse(value):{kind:'receipt_missing'};}
   return Result.parse(executeCommand(db,'interview',r.commandId,r,()=>{
    if(r.operation==='interview.create-simulation'){
     const round=read(r.realRoundId);if(!round||round.kind!=='real'||round.opportunityId!==r.opportunityId||!dependencies.core.readOpportunity(r.opportunityId))throw Error('invalid_relation');
     const simulation=Session.parse({id:randomUUID(),opportunityId:r.opportunityId,realRoundId:round.id,kind:'simulation',revision:1,title:r.title,state:'pending',confirmationTime:{kind:'unknown'},scheduledTime:{kind:'unknown'},completionTime:{kind:'unknown'},recordedAt:new Date().toISOString()});
     db.prepare('INSERT INTO interview_sessions VALUES(?,?,?,?,?,?)').run(simulation.id,simulation.opportunityId,'simulation',round.id,1,JSON.stringify(simulation));history(simulation,'simulation_created','仅为练习，不推进真实阶段',{kind:'unknown'});return {kind:'saved',id:simulation.id,revision:1};
    }
    if(r.operation!=='interview.confirm'){
     const current=read(r.id);if(!current)throw Error('not_found');if(current.revision!==r.expectedRevision)throw Error('conflict');if(current.kind!=='real'&&!['interview.save-document','interview.transition-simulation'].includes(r.operation))throw Error('invalid_relation');
     const next={...current,revision:current.revision+1};
     if(r.operation==='interview.transition-simulation'){
      if(current.kind!=='simulation')throw Error('invalid_relation');next.state=r.state;next.completionTime=r.state==='completed'?r.businessTime:{kind:'unknown'};history(next,'simulation_state_changed',r.reason,r.businessTime,current.state);
     }else if(r.operation==='interview.save-document'){
      if(r.document==='preparation'){if(current.kind!=='real')throw Error('invalid_relation');next.preparation=r.text;}
      if(r.document==='transcript'&&r.text!==current.transcript?.text){next.transcript={text:r.text,version:(current.transcript?.version??0)+1};if(next.finalReview)next.finalReview={...next.finalReview,needsRecheck:true};}
      if(r.document==='final-review')next.finalReview={text:r.text,transcriptVersion:current.transcript?.version??null,needsRecheck:false};
     }else if(r.operation==='interview.correct-time'){
      if(r.field==='confirmation'){if(!current.stageEventId)throw Error('storage_failed');const committed=dependencies.core.correctInterviewConfirmation({commandId:r.commandId,opportunityId:current.opportunityId,expectedRevision:r.expectedOpportunityRevision,eventId:current.stageEventId,businessTime:r.businessTime,reason:r.reason});if(committed.opportunity.id!==current.opportunityId)throw Error('storage_failed');next.confirmationTime=r.businessTime;}
      if(r.field==='scheduled'){if(!['scheduled','completed'].includes(current.state)||r.businessTime.kind==='unknown'&&current.state==='scheduled')throw Error('invalid_transition');next.scheduledTime=r.businessTime;}
      if(r.field==='completion'){if(current.state!=='completed')throw Error('invalid_transition');next.completionTime=r.businessTime;}
      history(next,r.field+'_time_corrected',r.reason,r.businessTime,current.state);
     }else if(r.operation==='interview.transition'){
      if(['completed','permanently_cancelled'].includes(current.state))throw Error('invalid_transition');
      if(r.action==='schedule'){if(r.businessTime.kind==='unknown')throw Error('invalid_transition');next.state='scheduled';next.scheduledTime=r.businessTime;}
      if(r.action==='temporarily_cancel'){if(current.state!=='scheduled')throw Error('invalid_transition');next.state='awaiting_rebooking';next.scheduledTime={kind:'unknown'};}
      if(r.action==='complete'){next.state='completed';next.completionTime=r.businessTime;}
      if(r.action==='permanently_cancel'){next.state='permanently_cancelled';}
      history(next,r.action,r.reason,r.businessTime,current.state);
     }else{
      if(!['completed','permanently_cancelled'].includes(current.state)||r.state===current.state)throw Error('invalid_transition');
      if(r.state==='scheduled'&&r.businessTime.kind==='unknown')throw Error('invalid_transition');
      next.state=r.state;next.completionTime=r.state==='completed'?r.businessTime:{kind:'unknown'};next.scheduledTime=r.state==='scheduled'?r.businessTime:{kind:'unknown'};history(next,'terminal_corrected',r.reason,r.businessTime,current.state);
     }
     db.prepare('UPDATE interview_sessions SET revision=?,body=? WHERE id=?').run(next.revision,JSON.stringify(Session.parse(next)),next.id);return {kind:'saved',id:next.id,revision:next.revision};
    }
    if(!dependencies.core.readOpportunity(r.opportunityId))throw Error('not_found');
    const session=Session.parse({id:randomUUID(),opportunityId:r.opportunityId,revision:1,title:r.title,kind:'real',state:'awaiting_schedule',confirmationTime:r.confirmationTime,scheduledTime:{kind:'unknown'},completionTime:{kind:'unknown'},recordedAt:new Date().toISOString()});
    db.prepare('INSERT INTO interview_sessions VALUES(?,?,?,?,?,?)').run(session.id,session.opportunityId,'real',null,1,JSON.stringify(session));
    const core=dependencies.core.recordStage({commandId:r.commandId,opportunityId:r.opportunityId,expectedRevision:r.expectedOpportunityRevision,stage:'interview',businessTime:r.confirmationTime,reason:'确认真实面试轮次：'+r.title});
    const committed=z.strictObject({opportunity:OpportunityView,eventId:z.uuid()}).parse(core);if(committed.opportunity.id!==session.opportunityId)throw Error('storage_failed');
    session.stageEventId=committed.eventId;db.prepare('UPDATE interview_sessions SET body=? WHERE id=?').run(JSON.stringify(session),session.id);history(session,'confirmed','现实已确认存在本轮',r.confirmationTime);
    return {kind:'saved',id:session.id,revision:session.revision};
   }));
  }catch(error){const code=ErrorCode.safeParse(error instanceof Error?error.message:'storage_failed');return {kind:'failure',code:code.success?code.data:'storage_failed'};}
 }
 return {handle,resolveTranscript(input:SourceRef){
  const parsed=TranscriptSourceRef.safeParse(input);if(!parsed.success)return undefined;const ref=parsed.data,session=read(ref.objectId);
  if(!session?.transcript||session.opportunityId!==ref.opportunityId)return undefined;
  const source=TranscriptSourceRef.parse({...ref,revision:session.transcript.version});
  return {metadata:{id:session.id,revision:session.transcript.version,scope:'opportunity',source},text:ref.revision===session.transcript.version?session.transcript.text:undefined,nature:session.kind==='real'?'real_correctable_record':'simulation',opportunityId:session.opportunityId};
 }};
}

import {redactOwnerReceipts} from '../../platform/commands/purge-receipts';
import type Database from 'better-sqlite3';
import {createHash,randomUUID} from 'node:crypto';
import {Request,Result,Profile,Document,CareerDocument,NameVersion,Export,Snapshot,PdfArtifact,Version,type OpportunityResolver} from '../../../contracts/resume/schema';
import {executeCommand,commandReceipt} from '../../platform/commands/receipts';

export const resumeMigration=`
CREATE TABLE resume_documents(id TEXT PRIMARY KEY,opportunity_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL,content TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE TABLE resume_render_jobs(command_id TEXT PRIMARY KEY,payload_json TEXT NOT NULL,snapshot_json TEXT NOT NULL,name TEXT NOT NULL);
CREATE TABLE resume_versions(id TEXT PRIMARY KEY,resume_id TEXT NOT NULL REFERENCES resume_documents(id),body TEXT NOT NULL);
CREATE INDEX resume_versions_owner ON resume_versions(resume_id);
`;
function initialDocument():CareerDocument{return {schemaVersion:1,sections:[{id:randomUUID(),kind:'summary',title:'个人简介',blocks:[{id:randomUUID(),type:'paragraph',spans:[]}]},{id:randomUUID(),kind:'skills',title:'技能',blocks:[{id:randomUUID(),type:'paragraph',spans:[]}]},{id:randomUUID(),kind:'experience',title:'经历',blocks:[{id:randomUUID(),type:'paragraph',spans:[]}]},{id:randomUUID(),kind:'project',title:'项目',blocks:[{id:randomUUID(),type:'paragraph',spans:[]}]},{id:randomUUID(),kind:'education',title:'教育',blocks:[{id:randomUUID(),type:'paragraph',spans:[]}]}],layout:{template:'a4-basic',fontSize:12,identityPosition:'top'}};}
export function createResumeDomain(db:Database.Database,dependencies:OpportunityResolver){
 function profile(){return dependencies.profile.read();}
 function document(id:string){const row=db.prepare('SELECT * FROM resume_documents WHERE id=?').get(id) as {id:string;opportunity_id:string;revision:number;content:string;recorded_at:string}|undefined;return row?Document.parse({id:row.id,opportunityId:row.opportunity_id,revision:row.revision,content:JSON.parse(row.content),recordedAt:row.recorded_at}):undefined;}
 function read(id:string):Result {const doc=document(id);if(!doc)return {status:'not-found'};const opportunity=dependencies.resolveOpportunity(doc.opportunityId);return opportunity?{status:'document',document:doc,profile:profile(),opportunity}:{status:'failure',code:'opportunity-unavailable'};}
 function check(id:string,expectedRevision:number,expectedProfileRevision:number):Result|undefined{const doc=document(id);if(!doc)return {status:'not-found'};const current=profile();if(doc.revision!==expectedRevision||current.revision!==expectedProfileRevision)return {status:'conflict',document:doc,profile:current};}
 function prepareVersion(input:unknown,printMetadata={fontVersion:'macos-system-cjk',engineVersion:'electron-44.5.1'}):Result {
  const parsed=NameVersion.or(Export).safeParse(input);if(!parsed.success)return {status:'failure',code:'invalid-request'};const request=parsed.data;
  try{return Result.parse(db.transaction(()=>{
   const receipt=commandReceipt(db,'resume',request.commandId);if(receipt){const old=db.prepare('SELECT payload_json FROM resume_render_jobs WHERE command_id=?').get(request.commandId) as {payload_json:string}|undefined;if(!old||old.payload_json!==JSON.stringify(request))return {status:'conflict',profile:profile(),document:document(request.resumeId)};return receipt;}
   const old=db.prepare('SELECT payload_json,snapshot_json,name FROM resume_render_jobs WHERE command_id=?').get(request.commandId) as {payload_json:string;snapshot_json:string;name:string}|undefined;
   if(old){if(old.payload_json!==JSON.stringify(request))return {status:'conflict',profile:profile(),document:document(request.resumeId)};return {status:'pending-job',job:Snapshot.parse(JSON.parse(old.snapshot_json)),name:old.name};}
   const conflict=check(request.resumeId,request.expectedRevision,request.expectedProfileRevision);if(conflict)return conflict;
   const doc=document(request.resumeId)!;const current=profile();
   const snapshot=Snapshot.parse({id:request.commandId,resumeId:doc.id,opportunityId:doc.opportunityId,resumeRevision:doc.revision,profileRevision:current.revision,content:doc.content,profile:current,contentHash:createHash('sha256').update(JSON.stringify({content:doc.content,profile:current})).digest('hex'),templateVersion:'a4-basic-1',fontVersion:printMetadata.fontVersion,engineVersion:printMetadata.engineVersion,rendererVersion:'career-print-1',recordedAt:new Date().toISOString()});
   db.prepare('INSERT INTO resume_render_jobs VALUES(?,?,?,?)').run(request.commandId,JSON.stringify(request),JSON.stringify(snapshot),'name' in request?request.name:'');
   return {status:'pending-job',job:snapshot,name:'name' in request?request.name:''};
  })());}catch{return {status:'failure',code:'storage-failed'};}
 }
 /** Trusted writer-only completion. The retained PDF must be verified and held by the platform before this call. */
 function completeVersion(commandId:string,artifact:unknown,retain:(versionId:string)=>void):Result {
  const existing=commandReceipt(db,'resume',commandId);if(existing)return Result.parse(existing);
  const parsed=PdfArtifact.safeParse(artifact);if(!parsed.success)return {status:'failure',code:'pdf-failed'};
  const row=db.prepare('SELECT payload_json,snapshot_json,name FROM resume_render_jobs WHERE command_id=?').get(commandId) as {payload_json:string;snapshot_json:string;name:string}|undefined;
  if(!row)return {status:'not-found'};
  try{return Result.parse(executeCommand(db,'resume',commandId,JSON.parse(row.payload_json),()=>{
   const snapshot=Snapshot.parse(JSON.parse(row.snapshot_json));if(!document(snapshot.resumeId))return {status:'not-found'};
   const version=Version.parse({id:commandId,resumeId:snapshot.resumeId,name:row.name,kind:JSON.parse(row.payload_json).operation==='resume.export'?'export':'named',snapshot,pdf:parsed.data,recordedAt:new Date().toISOString()});
   retain(version.id);
   db.prepare('INSERT INTO resume_versions VALUES(?,?,?)').run(version.id,version.resumeId,JSON.stringify(version));
   return {status:'version',version};
  }));}catch{return {status:'failure',code:'storage-failed'};}
 }
 function handle(input:unknown):Result {
  const parsed=Request.safeParse(input);if(!parsed.success)return {status:'failure',code:'invalid-request'};const request=parsed.data;
  try {
   if(request.operation==='resume.name-version'||request.operation==='resume.export')return prepareVersion(request);
   if(request.operation==='resume.read')return Result.parse(read(request.resumeId));
   if(request.operation==='resume.receipt'){const receipt=commandReceipt(db,'resume',request.commandId);if(receipt)return Result.parse(receipt);const job=db.prepare('SELECT snapshot_json,name FROM resume_render_jobs WHERE command_id=?').get(request.commandId) as {snapshot_json:string;name:string}|undefined;return job?{status:'pending-job',job:Snapshot.parse(JSON.parse(job.snapshot_json)),name:job.name}:{status:'not-found'};}
   if(request.operation==='resume.versions'){if(!document(request.resumeId))return {status:'not-found'};return Result.parse({status:'versions',versions:(db.prepare('SELECT body FROM resume_versions WHERE resume_id=? ORDER BY rowid DESC').all(request.resumeId) as {body:string}[]).map(row=>JSON.parse(row.body))});}
   if(request.operation==='resume.version'){const row=db.prepare('SELECT body FROM resume_versions WHERE id=? AND resume_id=?').get(request.versionId,request.resumeId) as {body:string}|undefined;return row?{status:'version',version:Version.parse(JSON.parse(row.body))}:{status:'not-found'};}
   return Result.parse(executeCommand(db,'resume',request.commandId,request,()=>{
    if(request.operation==='resume.open'){if(!dependencies.resolveOpportunity(request.opportunityId))return {status:'failure',code:'opportunity-unavailable'};const old=db.prepare('SELECT id FROM resume_documents WHERE opportunity_id=?').get(request.opportunityId) as {id:string}|undefined;if(old)return read(old.id);const id=randomUUID();db.prepare('INSERT INTO resume_documents VALUES(?,?,?,?,?)').run(id,request.opportunityId,1,JSON.stringify(initialDocument()),new Date().toISOString());return read(id);}
    const conflict=check(request.resumeId,request.expectedRevision,request.expectedProfileRevision);if(conflict)return conflict;
    let content:CareerDocument;
    if(request.operation==='resume.restore'){const row=db.prepare('SELECT body FROM resume_versions WHERE id=? AND resume_id=?').get(request.versionId,request.resumeId) as {body:string}|undefined;if(!row)return {status:'not-found'};content=Version.parse(JSON.parse(row.body)).snapshot.content;}
    else content=request.content;
    db.prepare('UPDATE resume_documents SET revision=revision+1,content=?,recorded_at=? WHERE id=?').run(JSON.stringify(content),new Date().toISOString(),request.resumeId);
    return read(request.resumeId);
   }));
  }catch(error){return error instanceof Error&&error.message==='conflict'?{status:'conflict',profile:profile(),...('resumeId' in request?{document:document(request.resumeId)}:{})}:{status:'failure',code:'storage-failed'};}
 }
 function failVersion(commandId:string,code:'pdf-failed'|'storage-failed'='pdf-failed'):Result {
  const existing=commandReceipt(db,'resume',commandId);if(existing)return Result.parse(existing);
  const job=db.prepare('SELECT payload_json FROM resume_render_jobs WHERE command_id=?').get(commandId) as {payload_json:string}|undefined;
  if(!job)return {status:'not-found'};
  try{return Result.parse(executeCommand(db,'resume',commandId,JSON.parse(job.payload_json),()=>({status:'failure',code})));}catch{return {status:'failure',code:'storage-failed'};}
 }
 function recoverPendingVersions():string[]{
  const jobs=db.prepare('SELECT command_id FROM resume_render_jobs').all() as {command_id:string}[];
  const failed:string[]=[];
  for(const {command_id} of jobs)if(!commandReceipt(db,'resume',command_id)){failVersion(command_id);failed.push(command_id);}
  return failed;
 }
 return {handle,prepareVersion,completeVersion,failVersion,recoverPendingVersions,
 resolveFrozenVersion(id:string){const row=db.prepare('SELECT body FROM resume_versions WHERE id=?').get(id) as {body:string}|undefined;return row?Version.parse(JSON.parse(row.body)):undefined;},
 purgeImpact(id:string){const doc=document(id);if(!doc)return undefined;const versions=(db.prepare('SELECT body FROM resume_versions WHERE resume_id=?').all(id) as {body:string}[]).map(row=>Version.parse(JSON.parse(row.body)));return {id,revision:doc.revision,name:'当前简历及其历史',blobIds:versions.map(v=>v.pdf.blobId),retentions:versions.map(v=>({owner:'resume',objectId:v.id})),producerIds:(db.prepare("SELECT command_id FROM resume_render_jobs WHERE json_extract(snapshot_json,'$.resumeId')=?").all(id) as {command_id:string}[]).map(r=>r.command_id)};},
 purge(id:string){const versions=(db.prepare('SELECT id FROM resume_versions WHERE resume_id=?').all(id) as {id:string}[]).map(v=>v.id);const jobs=(db.prepare("SELECT command_id FROM resume_render_jobs WHERE json_extract(snapshot_json,'$.resumeId')=?").all(id) as {command_id:string}[]).map(j=>j.command_id);db.prepare('DELETE FROM resume_versions WHERE resume_id=?').run(id);for(const job of jobs)db.prepare('DELETE FROM resume_render_jobs WHERE command_id=?').run(job);db.prepare('DELETE FROM resume_documents WHERE id=?').run(id);redactOwnerReceipts(db,'resume',[id,...versions,...jobs],{status:'failure',code:'content-purged'});}
 };
}
export {renderSnapshot} from './render';

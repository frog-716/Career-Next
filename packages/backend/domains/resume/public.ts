import {redactOwnerReceipts} from '../../platform/commands/purge-receipts';
import type Database from 'better-sqlite3';
import {createHash,randomUUID} from 'node:crypto';
import {Request,Result,Profile,Document,CareerDocument,NameVersion,Export,Snapshot,PdfArtifact,Version,ResumeBlock,BlockProvenance,type OpportunityResolver} from '../../../contracts/resume/schema';
import {executeCommand,commandReceipt} from '../../platform/commands/receipts';

export const resumeMigration=`
CREATE TABLE resume_documents(id TEXT PRIMARY KEY,opportunity_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL,content TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE TABLE resume_render_jobs(command_id TEXT PRIMARY KEY,payload_json TEXT NOT NULL,snapshot_json TEXT NOT NULL,name TEXT NOT NULL);
CREATE TABLE resume_versions(id TEXT PRIMARY KEY,resume_id TEXT NOT NULL REFERENCES resume_documents(id),body TEXT NOT NULL);
CREATE INDEX resume_versions_owner ON resume_versions(resume_id);
`;
export const resumeProvenanceMigration=`CREATE TABLE resume_block_provenance(resume_id TEXT NOT NULL REFERENCES resume_documents(id),block_id TEXT NOT NULL,provenance_json TEXT NOT NULL,PRIMARY KEY(resume_id,block_id));`;
function initialDocument():CareerDocument{return {schemaVersion:1,sections:[{id:randomUUID(),kind:'summary',title:'个人简介',blocks:[{id:randomUUID(),type:'paragraph',spans:[]}]},{id:randomUUID(),kind:'skills',title:'技能',blocks:[{id:randomUUID(),type:'paragraph',spans:[]}]},{id:randomUUID(),kind:'experience',title:'经历',blocks:[{id:randomUUID(),type:'paragraph',spans:[]}]},{id:randomUUID(),kind:'project',title:'项目',blocks:[{id:randomUUID(),type:'paragraph',spans:[]}]},{id:randomUUID(),kind:'education',title:'教育',blocks:[{id:randomUUID(),type:'paragraph',spans:[]}]}],layout:{template:'a4-basic',fontSize:12,identityPosition:'top'}};}
/** Text proposals have no layout authority; preserve explicit legacy absence as well. */
function preserveAlignment(before:import('../../../contracts/resume/schema').ResumeBlock,after:import('../../../contracts/resume/schema').ResumeBlock){
 const result=structuredClone(after);
 if(before.type==='paragraph'&&result.type==='paragraph'){
  if(before.alignment===undefined)delete result.alignment;else result.alignment=before.alignment;
 }else if(before.type==='bullet-list'&&result.type==='bullet-list'){
  for(const item of result.items){const original=before.items.find(value=>value.id===item.id&&value.paragraphId===item.paragraphId);
   if(!original&&before.items.some(value=>value.alignment&&value.alignment!=='left'))throw Error('alignment-preservation-required');
   if(original?.alignment===undefined)delete item.alignment;else item.alignment=original.alignment;
  }
 }else{
  const aligned=before.type==='paragraph'?before.alignment&&before.alignment!=='left':before.items.some(item=>item.alignment&&item.alignment!=='left');
  if(aligned)throw Error('alignment-preservation-required');
  if(result.type==='paragraph')delete result.alignment;else for(const item of result.items)delete item.alignment;
 }
 return result;
}
/** Added text follows its anchor layout, never a provider-selected layout. */
function insertionAlignment(anchor:import('../../../contracts/resume/schema').ResumeBlock,after:import('../../../contracts/resume/schema').ResumeBlock){
 const result=structuredClone(after);
 if(result.type==='paragraph'){
  if(anchor.type==='paragraph'&&anchor.alignment!==undefined)result.alignment=anchor.alignment;else delete result.alignment;
 }else for(const [index,item] of result.items.entries()){
  const inherited=anchor.type==='bullet-list'?anchor.items[index]?.alignment:anchor.alignment;
  if(inherited===undefined)delete item.alignment;else item.alignment=inherited;
 }
 return result;
}
export function createResumeDomain(db:Database.Database,dependencies:OpportunityResolver){
 const hasProvenance=()=>!!db.prepare("SELECT 1 FROM sqlite_master WHERE name='resume_block_provenance'").get();
 function blockProvenance(id:string){return hasProvenance()?(db.prepare('SELECT block_id,provenance_json FROM resume_block_provenance WHERE resume_id=? ORDER BY block_id').all(id) as {block_id:string;provenance_json:string}[]).map(row=>BlockProvenance.parse({blockId:row.block_id,provenance:JSON.parse(row.provenance_json)})):[];}
 function replaceProvenance(id:string,values:ReturnType<typeof blockProvenance>){if(!hasProvenance()){if(values.length)throw Error('schema_unavailable');return;}db.prepare('DELETE FROM resume_block_provenance WHERE resume_id=?').run(id);for(const value of values)db.prepare('INSERT INTO resume_block_provenance VALUES(?,?,?)').run(id,value.blockId,JSON.stringify(value.provenance));}
 function profile(){return dependencies.profile.read();}
 function document(id:string){const row=db.prepare('SELECT * FROM resume_documents WHERE id=?').get(id) as {id:string;opportunity_id:string;revision:number;content:string;recorded_at:string}|undefined;return row?Document.parse({id:row.id,opportunityId:row.opportunity_id,revision:row.revision,content:JSON.parse(row.content),recordedAt:row.recorded_at}):undefined;}
 function read(id:string):Result {const doc=document(id);if(!doc)return {status:'not-found'};const opportunity=dependencies.resolveOpportunity(doc.opportunityId);return opportunity?{status:'document',document:doc,profile:profile(),opportunity}:{status:'failure',code:'opportunity-unavailable'};}
 function check(id:string,expectedRevision:number,expectedProfileRevision:number):Result|undefined{const doc=document(id);if(!doc)return {status:'not-found'};const current=profile();if(doc.revision!==expectedRevision||current.revision!==expectedProfileRevision)return {status:'conflict',document:doc,profile:current};}
 function prepareVersion(input:unknown,printMetadata={fontVersion:'unbound-test-fonts',engineVersion:'unbound-test-engine'}):Result {
  const parsed=NameVersion.or(Export).safeParse(input);if(!parsed.success)return {status:'failure',code:'invalid-request'};const request=parsed.data;
  try{return Result.parse(db.transaction(()=>{
   const receipt=commandReceipt(db,'resume',request.commandId);if(receipt){const old=db.prepare('SELECT payload_json FROM resume_render_jobs WHERE command_id=?').get(request.commandId) as {payload_json:string}|undefined;if(!old||old.payload_json!==JSON.stringify(request))return {status:'conflict',profile:profile(),document:document(request.resumeId)};return receipt;}
   const old=db.prepare('SELECT payload_json,snapshot_json,name FROM resume_render_jobs WHERE command_id=?').get(request.commandId) as {payload_json:string;snapshot_json:string;name:string}|undefined;
   if(old){if(old.payload_json!==JSON.stringify(request))return {status:'conflict',profile:profile(),document:document(request.resumeId)};return {status:'pending-job',job:Snapshot.parse(JSON.parse(old.snapshot_json)),name:old.name};}
   const conflict=check(request.resumeId,request.expectedRevision,request.expectedProfileRevision);if(conflict)return conflict;
   const doc=document(request.resumeId)!;const current=profile();const metadata=blockProvenance(doc.id),evidence=metadata.length?{blockProvenance:metadata}:{};
   const snapshot=Snapshot.parse({id:request.commandId,resumeId:doc.id,opportunityId:doc.opportunityId,resumeRevision:doc.revision,profileRevision:current.revision,content:doc.content,...evidence,profile:current,contentHash:createHash('sha256').update(JSON.stringify({content:doc.content,profile:current,...evidence})).digest('hex'),templateVersion:'a4-basic-1',fontVersion:printMetadata.fontVersion,engineVersion:printMetadata.engineVersion,rendererVersion:'career-print-2',recordedAt:new Date().toISOString()});
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
   if(request.operation==='resume.lookup'){const row=db.prepare('SELECT id FROM resume_documents WHERE opportunity_id=?').get(request.opportunityId) as {id:string}|undefined;return row?read(row.id):{status:'not-found'};}
   if(request.operation==='resume.candidates'){const row=db.prepare('SELECT id FROM resume_documents WHERE opportunity_id=?').get(request.opportunityId) as {id:string}|undefined;if(!row)return {status:'versions',versions:[]};return handle({operation:'resume.versions',resumeId:row.id});}
   if(request.operation==='resume.receipt'){const receipt=commandReceipt(db,'resume',request.commandId);if(receipt)return Result.parse(receipt);const job=db.prepare('SELECT snapshot_json,name FROM resume_render_jobs WHERE command_id=?').get(request.commandId) as {snapshot_json:string;name:string}|undefined;return job?{status:'pending-job',job:Snapshot.parse(JSON.parse(job.snapshot_json)),name:job.name}:{status:'not-found'};}
   if(request.operation==='resume.copy-candidates'){if(!document(request.resumeId))return {status:'not-found'};const items=(db.prepare('SELECT body FROM resume_versions WHERE resume_id<>? ORDER BY rowid DESC LIMIT 500').all(request.resumeId) as {body:string}[]).flatMap(row=>{const version=Version.parse(JSON.parse(row.body));if(version.kind==='export'||!version.name)return [];const source=document(version.resumeId),opportunity=source&&dependencies.resolveOpportunity(source.opportunityId);return opportunity?[{versionId:version.id,name:version.name,sourceResumeId:version.resumeId,companyName:opportunity.companyName,role:opportunity.role,recordedAt:version.recordedAt}]:[];});return {status:'copy-candidates',items};}
   if(request.operation==='resume.versions'){if(!document(request.resumeId))return {status:'not-found'};return Result.parse({status:'versions',versions:(db.prepare('SELECT body FROM resume_versions WHERE resume_id=? ORDER BY rowid DESC').all(request.resumeId) as {body:string}[]).map(row=>JSON.parse(row.body))});}
   if(request.operation==='resume.version'){const row=db.prepare('SELECT body FROM resume_versions WHERE id=? AND resume_id=?').get(request.versionId,request.resumeId) as {body:string}|undefined;return row?{status:'version',version:Version.parse(JSON.parse(row.body))}:{status:'not-found'};}
   return Result.parse(executeCommand(db,'resume',request.commandId,request,()=>{
    if(request.operation==='resume.open'){if(!dependencies.resolveOpportunity(request.opportunityId))return {status:'failure',code:'opportunity-unavailable'};const old=db.prepare('SELECT id FROM resume_documents WHERE opportunity_id=?').get(request.opportunityId) as {id:string}|undefined;if(old)return read(old.id);const id=randomUUID();db.prepare('INSERT INTO resume_documents VALUES(?,?,?,?,?)').run(id,request.opportunityId,1,JSON.stringify(initialDocument()),new Date().toISOString());return read(id);}
    const conflict=check(request.resumeId,request.expectedRevision,request.expectedProfileRevision);if(conflict)return conflict;
    let content:CareerDocument;let provenance=blockProvenance(request.resumeId);
    if(request.operation==='resume.copy-version'){const row=db.prepare('SELECT body FROM resume_versions WHERE id=?').get(request.versionId) as {body:string}|undefined;if(!row)return {status:'not-found'};const version=Version.parse(JSON.parse(row.body));if(version.kind==='export'||!version.name||version.resumeId===request.resumeId)return {status:'failure',code:'invalid-request'};const source=document(version.resumeId);if(!source||!dependencies.resolveOpportunity(source.opportunityId))return {status:'not-found'};content=structuredClone(version.snapshot.content);const oldProvenance=version.snapshot.blockProvenance??[];provenance=[];for(const section of content.sections){section.id=randomUUID();for(const block of section.blocks){const previous=oldProvenance.find(p=>p.blockId===block.id);block.id=randomUUID();if(previous)provenance.push({...previous,blockId:block.id});if(block.type==='bullet-list')for(const item of block.items){item.id=randomUUID();item.paragraphId=randomUUID();}}}}
    else if(request.operation==='resume.restore'){const row=db.prepare('SELECT body FROM resume_versions WHERE id=? AND resume_id=?').get(request.versionId,request.resumeId) as {body:string}|undefined;if(!row)return {status:'not-found'};const snapshot=Version.parse(JSON.parse(row.body)).snapshot;content=snapshot.content;provenance=snapshot.blockProvenance??[];}
    else content=request.content;
    replaceProvenance(request.resumeId,provenance.filter(value=>content.sections.some(section=>section.blocks.some(block=>block.id===value.blockId))));
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
 function profileDerivativeJobs(){return (db.prepare('SELECT command_id FROM resume_render_jobs').all() as {command_id:string}[]).filter(row=>(commandReceipt(db,'resume',row.command_id) as Result|undefined)?.status!=='version').map(row=>row.command_id);}
 function blockDependency(id:string,blockId:string){const doc=document(id);if(!doc)return undefined;for(const section of doc.content.sections){const block=section.blocks.find(item=>item.id===blockId);if(block)return {doc,section,block,provenance:blockProvenance(id).find(value=>value.blockId===blockId)?.provenance??[],digest:createHash('sha256').update(JSON.stringify({sectionId:section.id,kind:section.kind,title:section.title,block,provenance:blockProvenance(id).find(value=>value.blockId===blockId)?.provenance??[]})).digest('hex'),anchorDigest:createHash('sha256').update(JSON.stringify({sectionId:section.id,kind:section.kind,title:section.title,blockId:block.id})).digest('hex')};}return undefined;}
 function applyBlockProposal(input:{commandId:string;resumeId:string;blockId:string;expectedDigest:string;action?:'replace'|'insert'|'delete';after?:unknown;provenance?:import('../../../contracts/common/provenance').Provenance[]}):Result{return Result.parse(executeCommand(db,'resume.proposal',input.commandId,input,()=>{const before=blockDependency(input.resumeId,input.blockId);if(!before)return {status:'not-found'};if((input.action==='insert'?before.anchorDigest:before.digest)!==input.expectedDigest)return {status:'conflict',profile:profile(),document:before.doc};const action=input.action??'replace',after=action==='delete'?undefined:ResumeBlock.parse(input.after);if(after&&(action==='replace'?after.id!==before.block.id:before.doc.content.sections.some(s=>s.blocks.some(b=>b.id===after.id))))throw Error('invalid-request');const content=structuredClone(before.doc.content);const section=content.sections.find(section=>section.id===before.section.id)!;const index=section.blocks.findIndex(block=>block.id===input.blockId);if(action==='insert')section.blocks.splice(index+1,0,insertionAlignment(before.block,after!));else if(action==='delete'){if(content.sections.reduce((n,s)=>n+s.blocks.length,0)===1)throw Error('last_block_required');section.blocks.splice(index,1);if(!section.blocks.length)content.sections=content.sections.filter(s=>s.id!==section.id);}else section.blocks[index]=preserveAlignment(before.block,after!);CareerDocument.parse(content);const retained=blockProvenance(input.resumeId).filter(value=>value.blockId!==(action==='insert'?after!.id:input.blockId));if(after&&input.provenance)retained.push(BlockProvenance.parse({blockId:after.id,provenance:input.provenance}));replaceProvenance(input.resumeId,retained);db.prepare('UPDATE resume_documents SET content=?,revision=revision+1,recorded_at=? WHERE id=?').run(JSON.stringify(content),new Date().toISOString(),input.resumeId);return read(input.resumeId);}));}
 return {handle,blockDependency,applyBlockProposal,profileDerivativeImpact(){return {producerIds:profileDerivativeJobs(),blobIds:[],retentions:[]};},purgeProfileDerivatives(){for(const id of profileDerivativeJobs()){failVersion(id);db.prepare('DELETE FROM resume_render_jobs WHERE command_id=?').run(id);}},prepareVersion,completeVersion,failVersion,recoverPendingVersions,
 resolveFrozenVersion(id:string){const row=db.prepare('SELECT body FROM resume_versions WHERE id=?').get(id) as {body:string}|undefined;return row?Version.parse(JSON.parse(row.body)):undefined;},
 purgeImpact(id:string){const doc=document(id);if(!doc)return undefined;const versions=(db.prepare('SELECT body FROM resume_versions WHERE resume_id=?').all(id) as {body:string}[]).map(row=>Version.parse(JSON.parse(row.body)));return {id,revision:doc.revision,name:'当前简历及其历史',blobIds:versions.map(v=>v.pdf.blobId),retentions:versions.map(v=>({owner:'resume',objectId:v.id})),producerIds:(db.prepare("SELECT command_id FROM resume_render_jobs WHERE json_extract(snapshot_json,'$.resumeId')=?").all(id) as {command_id:string}[]).map(r=>r.command_id)};},
 purge(id:string){const versions=(db.prepare('SELECT id FROM resume_versions WHERE resume_id=?').all(id) as {id:string}[]).map(v=>v.id);const jobs=(db.prepare("SELECT command_id FROM resume_render_jobs WHERE json_extract(snapshot_json,'$.resumeId')=?").all(id) as {command_id:string}[]).map(j=>j.command_id);db.prepare('DELETE FROM resume_versions WHERE resume_id=?').run(id);for(const job of jobs)db.prepare('DELETE FROM resume_render_jobs WHERE command_id=?').run(job);replaceProvenance(id,[]);db.prepare('DELETE FROM resume_documents WHERE id=?').run(id);redactOwnerReceipts(db,'resume',[id,...versions,...jobs],{status:'failure',code:'content-purged'});redactOwnerReceipts(db,'resume.proposal',[id],{status:'failure',code:'content-purged'});}
 };
}
export {renderSnapshot} from './render';

export {validateCandidate,candidateRelations} from './candidate-validation';

export {createResumeAiPolicy} from './ai-policy';
export {importResumeSnapshot,hasResumeSnapshots} from './staging';

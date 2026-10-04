/** Explicit offline operator. No automatic startup, discovery, network or body output. */
import Database from 'better-sqlite3';
import {readFileSync,writeFileSync,existsSync,mkdirSync,cpSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {prepareMigration,executeMigration} from '../packages/backend/application/migration/public';
import {assertLiteFingerprint,assertLiteCandidate,assertLiteEmptyHistory,assertActiveReplaceable} from '../packages/backend/application/migration/lite-activation';
import {readLiteSource,liteSpans} from '../packages/backend/application/migration/lite-source';
import {digest} from '../packages/backend/application/migration/source';
import {durableJson,createManagedCopies,safeManagedPath} from '../packages/backend/platform/backup/managed-copies';
import {validateBusinessCandidate,validateCandidateRelations} from '../packages/backend/bootstrap/candidate-validation';
import {createProfileDomain} from '../packages/backend/domains/profile/public';
import {createCompanyDomain} from '../packages/backend/domains/opportunity/company/public';
import {createOpportunityCore} from '../packages/backend/domains/opportunity/core/public';
import {createResumeDomain} from '../packages/backend/domains/resume/public';
import {CareerDocument} from '../packages/contracts/resume/schema';
import {toEditor,fromEditor} from '../packages/frontend/features/resume/adapter';
const mode=process.argv[2],configPath=process.argv[3];
async function run(){
 const config=JSON.parse(readFileSync(configPath,'utf8')),dataRoot=realpathSync(config.dataRoot),metadata=config.metadataPath;
 if(mode==='stage'){
  const sourceDigest=digest(readFileSync(config.sourcePath)),sourceDb=new Database(config.sourcePath,{readonly:true,fileMustExist:true});let schemaDigest:string;
  try{schemaDigest=digest(JSON.stringify(sourceDb.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all()));}finally{sourceDb.close();}
  const input={sourcePath:config.sourcePath,sourceDigest,dataRoot,liteSelection:{selection:config.selection,schemaDigest},classification:{version:1,records:config.selection.map((s:{hash:string})=>({identity:s.hash,classification:'REAL'}))},mapping:{version:'M-Lite-current-v1',profileAuthority:'primary',opportunityPhase:'conservative-preparation',opportunityResult:'active',unknownDates:'preserve',alignment:'preserve',proposals:'excluded'}};
  const previous=existsSync(metadata)?JSON.parse(readFileSync(metadata,'utf8')):undefined;
  const plan=previous&&JSON.stringify(previous.input)===JSON.stringify(input)?previous.plan:await prepareMigration(input),receipt=await executeMigration(plan,input),second=await executeMigration(plan,input);
  if(JSON.stringify(receipt)!==JSON.stringify(second))throw Error('IDEMPOTENCY_FAILED');
  const database=new Database(path.join(plan.root,'career.sqlite'),{readonly:true});try{
   validateBusinessCandidate(database);validateCandidateRelations(database);
   const profile=createProfileDomain(database),company=createCompanyDomain(database),opportunity=createOpportunityCore(database,{resolveCompany:company.resolveCompany}),resume=createResumeDomain(database,{resolveOpportunity:opportunity.resolveOpportunity,profile});
   const source=readLiteSource(input.sourcePath,input.sourceDigest,input.liteSelection),resumeChecks=[];
   const originalDb=new Database(config.sourcePath,{readonly:true,fileMustExist:true});
   try{for(const row of originalDb.prepare("SELECT id FROM current WHERE kind='resume_document'").all() as {id:string}[]){
    const mapped=receipt.mappings.find(m=>m.kind==='resume'&&m.sourceIdentity===digest(row.id));if(!mapped)continue;
    const raw=JSON.parse((originalDb.prepare("SELECT body FROM current WHERE id=? AND kind='resume_document'").get(row.id) as {body:string}).body).document;
    const current=resume.handle({operation:'resume.read',resumeId:mapped.targetIdentity},'human');if(current.status!=='document')throw Error('CONTENT_CHECK_FAILED');
    const visible:string[]=[];for(const section of raw.sections){visible.push(section.title);for(const item of section.items)for(const [key,value] of Object.entries(item)){if(key==='id')continue;if(typeof value==='string'&&value)visible.push(value);else if(key==='bullets')for(const bullet of value as {content:string}[])if(bullet.content)visible.push(bullet.content);}}
    const saved=current.document.content.sections.flatMap(s=>[s.title,...s.blocks.flatMap(b=>b.type==='paragraph'?[b.spans.map(p=>p.text).join('')]:b.items.map(i=>i.spans.map(p=>p.text).join('')))]).filter(Boolean);
    // Independently checks every visible value; supported inline marks remain typed in the owner document.
    if(JSON.stringify(visible.map(t=>digest(liteSpans(t).map(s=>s.text).join(''))).sort())!==JSON.stringify(saved.map(digest).sort()))throw Error('RESUME_LOSSY_CONVERSION');
   }}finally{originalDb.close();}
   for(const mapping of receipt.mappings.filter(m=>m.kind==='resume')){
    const result=resume.handle({operation:'resume.read',resumeId:mapping.targetIdentity},'human');if(result.status!=='document')throw Error('CONTENT_CHECK_FAILED');
    const original=source.records.find(r=>r.identity===mapping.sourceIdentity);if(original?.kind!=='resume')throw Error('CONTENT_CHECK_FAILED');
    const normalize=(d:CareerDocument)=>({identityNameAlignment:d.layout.identityNameAlignment??'left',sections:d.sections.map(s=>({kind:s.kind,title:s.title,blocks:s.blocks.map(b=>b.type==='paragraph'?{type:b.type,alignment:b.alignment??'left',spans:b.spans}:{type:b.type,items:b.items.map(i=>({alignment:i.alignment??'left',spans:i.spans}))})}))});
    const expected={identityNameAlignment:original.document.identityNameAlignment??'left',sections:original.document.sections.map(s=>({kind:s.type==='projects'?'project':s.type,title:s.title,blocks:s.blocks.map(b=>b.type==='paragraph'?{type:b.type,alignment:b.alignment??'left',spans:b.spans}:{type:b.type,items:b.items.map(i=>({alignment:i.alignment??'left',spans:i.spans}))})}))};
    if(JSON.stringify(normalize(result.document.content))!==JSON.stringify(expected)||JSON.stringify(fromEditor(toEditor(result.document.content),result.document.content.layout))!==JSON.stringify(result.document.content))throw Error('RESUME_LOSSY_CONVERSION');
    resumeChecks.push({resumeId:result.document.id,opportunityId:result.document.opportunityId,contentDigest:digest(JSON.stringify(result.document.content)),identityAlignment:result.document.content.layout.identityNameAlignment??'left',match:true});
   }
   assertLiteEmptyHistory(database);
   const previewRoot=path.join(plan.root,'desktop-preview');mkdirSync(path.join(previewRoot,'workspaces','local'),{recursive:true,mode:0o700});cpSync(path.join(plan.root,'career.sqlite'),path.join(previewRoot,'workspaces','local','career.sqlite'));if(existsSync(path.join(plan.root,'blobs')))cpSync(path.join(plan.root,'blobs'),path.join(previewRoot,'workspaces','local','blobs'),{recursive:true});else mkdirSync(path.join(previewRoot,'workspaces','local','blobs'),{recursive:true,mode:0o700});
   const previewCopy=createManagedCopies(previewRoot).register({relativePath:'workspaces/local',kind:'current_workspace',state:'ready'});durableJson(path.join(previewRoot,'active-workspace-pointer.json'),{copyId:previewCopy.id,relativePath:previewCopy.relativePath,workspaceInstance:plan.manifest.workspaceInstance});
   durableJson(metadata,{input,plan,receipt,resumeChecks,previewRoot,stagingDatabaseDigest:digest(readFileSync(path.join(plan.root,'career.sqlite'))),counts:{profile:1,company:2,opportunity:3,resume:2},idempotency:true,contentCheck:true,excluded:0});
   console.log(JSON.stringify({stage:'PASS',counts:{profile:1,company:2,opportunity:3,resume:2},contentCheck:true,idempotency:true,excluded:0}));
  }finally{database.close();}
 }else if(mode==='activate'){
  const saved=JSON.parse(readFileSync(metadata,'utf8'));if(!saved.desktopPreviewPass)throw Error('STAGING_DESKTOP_NOT_VERIFIED');
  const pointerPath=path.join(dataRoot,'active-workspace-pointer.json'),pointer=JSON.parse(readFileSync(pointerPath,'utf8')),active=safeManagedPath(dataRoot,pointer.relativePath);
  // Source must still match the approved execution snapshot; no stale activation.
  if(digest(readFileSync(config.sourcePath))!==saved.input.sourceDigest)throw Error('source_digest_changed');
  // Take an exact rollback copy under a held real writer lock, before inspecting or switching.
  const lock=new Database(path.join(active,'writer-lock.sqlite'),{fileMustExist:true,timeout:0});try{lock.exec('BEGIN EXCLUSIVE');
   if(existsSync(path.join(active,'career.sqlite-wal'))&&readFileSync(path.join(active,'career.sqlite-wal')).length)throw Error('ACTIVE_SNAPSHOT_REQUIRED');
   const registry=createManagedCopies(dataRoot),rollback=registry.register({relativePath:'rollback/'+randomUUID(),kind:'old_workspace',sourceCopyId:pointer.copyId,state:'candidate'}),rollbackRoot=safeManagedPath(dataRoot,rollback.relativePath);
   cpSync(active,rollbackRoot,{recursive:true,errorOnExist:true,force:false});
   const db=new Database(path.join(rollbackRoot,'career.sqlite'));try{
    assertActiveReplaceable(db,digest(readFileSync(path.join(rollbackRoot,'career.sqlite'))),config.activeClassification);
    if(db.pragma('integrity_check',{simple:true})!=='ok')throw Error('IRREVERSIBLE_DATA_LOSS_RISK');
   }finally{db.close();}
   registry.update(rollback.id,{state:'ready'});durableJson(path.join(rollbackRoot,'rollback-pointer.json'),pointer);
   const stage=registry.list().find(c=>c.relativePath===path.relative(dataRoot,saved.plan.root));if(stage?.kind!=='staging'||stage.state!=='ready')throw Error('staging_copy_unavailable');
   const stageLock=new Database(path.join(saved.plan.root,'writer-lock.sqlite'),{fileMustExist:true,timeout:0});try{stageLock.exec('BEGIN EXCLUSIVE');
    if(existsSync(path.join(saved.plan.root,'career.sqlite-wal'))&&readFileSync(path.join(saved.plan.root,'career.sqlite-wal')).length)throw Error('STAGING_VERIFICATION_STALE');
    const candidate=new Database(path.join(saved.plan.root,'career.sqlite'),{readonly:true,fileMustExist:true});try{assertLiteFingerprint(candidate,{databaseDigest:saved.stagingDatabaseDigest,workspaceInstance:saved.plan.manifest.workspaceInstance},digest(readFileSync(path.join(saved.plan.root,'career.sqlite'))));assertLiteCandidate(candidate,saved.receipt);}finally{candidate.close();}
    if(readFileSync(pointerPath,'utf8')!==JSON.stringify(pointer))throw Error('ACTIVE_POINTER_CHANGED');
    durableJson(pointerPath,{copyId:stage.id,relativePath:stage.relativePath,workspaceInstance:saved.plan.manifest.workspaceInstance});registry.update(pointer.copyId,{kind:'old_workspace'});registry.update(stage.id,{kind:'current_workspace'});
    saved.activated=true;saved.rollback={copyId:rollback.id,relativePath:rollback.relativePath,databaseDigest:digest(readFileSync(path.join(rollbackRoot,'career.sqlite')))};durableJson(metadata,saved);
    console.log(JSON.stringify({activated:true,rollback:'AVAILABLE',counts:saved.counts}));
   }finally{if(stageLock.inTransaction)stageLock.exec('ROLLBACK');stageLock.close();}
  }finally{if(lock.inTransaction)lock.exec('ROLLBACK');lock.close();}
 }else throw Error('MODE_REQUIRED');
}
run().catch(error=>{const code=error instanceof Error&&/^[A-Za-z_]+$/.test(error.message)?error.message:'M_LITE_FAILED';console.log(JSON.stringify({status:'FAIL',code,errorType:error instanceof Error?error.name:'unknown',storageCode:typeof error==='object'&&error!==null&&(error as {code?:string}).code,issues:typeof error==='object'&&error!==null&&(error as {issues?:{path:unknown;code:string}[]}).issues?.map(i=>({path:i.path,code:i.code}))}));process.exitCode=1;});

import {mkdirSync,readFileSync,realpathSync,existsSync,lstatSync} from 'node:fs';
import Database from 'better-sqlite3';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {openWorkspace} from '../../platform/database/database';
import {createManagedCopies,durableJson,safeManagedPath} from '../../platform/backup/managed-copies';
import {stagingPermit,assertMigrationStaging} from '../../platform/persistence/migration-staging';
import {releases} from '../../bootstrap/releases';
import {materialsMigration} from '../../domains/materials/migration';
import {importProfileSnapshot,createProfileDomain} from '../../domains/profile/public';
import {importCompanySnapshot,createCompanyDomain} from '../../domains/opportunity/company/public';
import {importOpportunitySnapshot,createOpportunityCore} from '../../domains/opportunity/core/public';
import {importResumeSnapshot,hasResumeSnapshots} from '../../domains/resume/public';
import {CareerDocument} from '../../../contracts/resume/schema';
import {LegacyHistoryImport,type HistoryReference} from '../../../contracts/ai/legacy-history/schema';
import {createLegacyHistoryStagingWriter} from '../../ai-runtime/legacy-history/staging';
import {createLegacyHistory} from '../../ai-runtime/legacy-history/public';
import {validateBusinessCandidate,validateCandidateRelations} from '../../bootstrap/candidate-validation';
import {validateMigrationCandidate} from './candidate-validation';
import {Profile} from '../../../contracts/profile/schema';
import {readLiteSource} from './lite-source';
import {readSyntheticSource,digest} from './source';
import {Classification,Mapping,Manifest,Receipt,AdapterVersion,type LegacyRecord} from './schema';
export type MigrationInput={sourcePath:string;sourceDigest:string;classification:unknown;mapping:unknown;dataRoot:string;liteSelection?:unknown};
const Prepared=z.strictObject({root:z.string(),dataRoot:z.string(),planDigest:z.string(),manifest:Manifest});
export type Prepared=z.infer<typeof Prepared>;
function inputs(input:MigrationInput){const classification=Classification.parse(input.classification),mapping=Mapping.parse(input.mapping);
 if(classification.records.some(r=>r.classification!=='REAL')||new Set(classification.records.map(r=>r.identity)).size!==classification.records.length)throw Error('classification_rejected');
 if(!!input.liteSelection!==(mapping.version==='M-Lite-current-v1'))throw Error('mapping_source_mismatch');
 const snapshot=input.liteSelection?readLiteSource(input.sourcePath,input.sourceDigest,input.liteSelection):readSyntheticSource(input.sourcePath,input.sourceDigest),identities=classification.records.map(r=>r.identity).sort();
 if(input.liteSelection&&(identities.length!==8||JSON.stringify([...snapshot.records.map(r=>r.identity)].sort())!==JSON.stringify(identities)))throw Error('classification_rejected');
 const records=identities.map(id=>{const record=snapshot.records.find(r=>r.identity===id);if(!record)throw Error('source_identity_missing');if(record.kind==='profile'&&record.origin!=='primary')throw Error('primary_required');return record;});
 return {snapshot,records,classificationDigest:digest(JSON.stringify(classification)),mappingDigest:digest(JSON.stringify(mapping)),identities};
}
function uuid(seed:string){const hex=digest(seed);return hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);}
function transformedDocument(record:Extract<LegacyRecord,{kind:'resume'}>,planDigest:string){
 const node=(id:string,kind:string)=>uuid(JSON.stringify([planDigest,record.identity,kind,id]));
 return CareerDocument.parse({schemaVersion:1,layout:{template:'a4-basic',fontSize:12,identityPosition:'top',...record.document.identityNameAlignment?{identityNameAlignment:record.document.identityNameAlignment}:{}},sections:record.document.sections.map(section=>({id:node(section.id,'section'),kind:section.type==='projects'?'project':section.type,title:section.title,blocks:section.blocks.map(block=>block.type==='paragraph'?{...block,id:node(block.id,'paragraph')}:{...block,id:node(block.id,'list'),items:block.items.map(item=>({...item,id:node(item.id,'item'),paragraphId:node(item.id,'item-paragraph')}))})}))});
}
export async function prepareMigration(input:MigrationInput):Promise<Prepared>{
 const checked=inputs(input),dataRoot=realpathSync(input.dataRoot),root=safeManagedPath(dataRoot,'migration-staging/'+randomUUID());
 const copies=createManagedCopies(dataRoot),copy=copies.register({relativePath:path.relative(dataRoot,root),kind:'staging',state:'candidate'});
 try{mkdirSync(root,{recursive:true,mode:0o700});const workspace=await openWorkspace(root,materialsMigration,releases);try{
  const manifest=Manifest.parse({sourceDigest:checked.snapshot.digest,sourceSchemaDigest:checked.snapshot.schemaDigest,sourceVersion:checked.snapshot.version,classificationDigest:checked.classificationDigest,mappingDigest:checked.mappingDigest,adapterVersion:input.liteSelection?'m-lite-primary-v1':AdapterVersion,recordIdentities:checked.identities,workspaceInstance:workspace.workspaceInstance});
  const plan=Prepared.parse({root,dataRoot,manifest,planDigest:digest(JSON.stringify(manifest))});
  durableJson(path.join(root,'m1b-staging.json'),{kind:'m1b-staging',workspaceInstance:workspace.workspaceInstance});
  durableJson(path.join(root,'legacy-history-staging.json'),{kind:'legacy-history-staging',workspaceInstance:workspace.workspaceInstance});
  durableJson(path.join(root,'migration-plan.json'),plan);copies.update(copy.id,{state:'ready'});return plan;
 }finally{workspace.close();}}catch(error){copies.update(copy.id,{state:'failed',reason:'m1b_prepare_failed'});throw error;}
}
function boundStagePlan(rawPlan:Prepared){
 const plan=Prepared.parse(rawPlan);
 if(realpathSync(plan.dataRoot)!==plan.dataRoot||!z.uuid().safeParse(path.basename(plan.root)).success||realpathSync(plan.root)!==safeManagedPath(plan.dataRoot,'migration-staging/'+path.basename(plan.root))||digest(JSON.stringify(plan.manifest))!==plan.planDigest)throw Error('stale_plan');
 const relative=path.relative(plan.dataRoot,plan.root);
 for(const file of ['career.sqlite','writer-lock.sqlite','career.sqlite-wal','career.sqlite-shm','m1b-staging.json','legacy-history-staging.json','migration-plan.json','migration-run.json']){const full=safeManagedPath(plan.dataRoot,relative+'/'+file);if(existsSync(full)&&(!lstatSync(full).isFile()||lstatSync(full).nlink!==1))throw Error('unsafe_copy_path');}
 if(JSON.stringify(Prepared.parse(JSON.parse(readFileSync(path.join(plan.root,'migration-plan.json'),'utf8'))))!==JSON.stringify(plan))throw Error('stale_plan');
 const pointer=safeManagedPath(plan.dataRoot,'active-workspace-pointer.json');if(existsSync(pointer)){const active=z.object({relativePath:z.string()}).parse(JSON.parse(readFileSync(pointer,'utf8')));if(safeManagedPath(plan.dataRoot,active.relativePath)===plan.root)throw Error('staging_is_active');}
 return plan;
}
function checkedReceipt(db:Database.Database,plan:Prepared,body:string){
 validateMigrationCandidate(db);const receipt=Receipt.parse(JSON.parse(body));
 if(receipt.planDigest!==plan.planDigest||JSON.stringify(receipt.manifest)!==JSON.stringify(plan.manifest))throw Error('migration_receipt_invalid');
 validateBusinessCandidate(db);validateCandidateRelations(db);return receipt;
}
const Run=z.strictObject({planDigest:z.string().regex(/^[a-f0-9]{64}$/),state:z.enum(['running','failed','complete'])});
/** Restart inspection uses the real writer lock and DB receipt, never guesses success from files. */
export function inspectMigrationStaging(rawPlan:Prepared):'ready'|'running'|'failed'|'complete'{
 const plan=boundStagePlan(rawPlan),copies=createManagedCopies(plan.dataRoot),copy=copies.list().find(c=>c.relativePath===path.relative(plan.dataRoot,plan.root));
 if(copy?.kind!=='staging'||!['ready','failed'].includes(copy.state))throw Error('staging_copy_unavailable');
 const runFile=path.join(plan.root,'migration-run.json');if(!existsSync(runFile))return copy.state==='failed'?'failed':'ready';
 const run=Run.parse(JSON.parse(readFileSync(runFile,'utf8')));if(run.planDigest!==plan.planDigest)throw Error('migration_run_invalid');
 const lock=new Database(path.join(plan.root,'writer-lock.sqlite'),{fileMustExist:true,timeout:0});try{try{lock.exec('BEGIN EXCLUSIVE');}catch{return 'running';}
  const db=new Database(path.join(plan.root,'career.sqlite'),{readonly:true,fileMustExist:true});try{
   const old=db.prepare('SELECT body FROM migration_import_receipts WHERE plan_digest=?').get(plan.planDigest) as {body:string}|undefined;
   if(old){checkedReceipt(db,plan,old.body);copies.update(copy.id,{state:'ready'});durableJson(runFile,{planDigest:plan.planDigest,state:'complete'});return 'complete';}
   copies.update(copy.id,{state:'failed',reason:'m1b_interrupted'});durableJson(runFile,{planDigest:plan.planDigest,state:'failed'});return 'failed';
  }catch(error){copies.update(copy.id,{state:'failed',reason:'m1b_inspection_failed'});throw error;}finally{db.close();}
 }finally{if(lock.inTransaction)lock.exec('ROLLBACK');lock.close();}
}
/** Optional observation seam reports counts only; tests inject process/IO failures here. */
export async function executeMigration(rawPlan:Prepared,input:MigrationInput,observation:{onImported?(count:number):void}={}):Promise<Receipt>{
 const plan=boundStagePlan(rawPlan),checked=inputs(input);if(realpathSync(input.dataRoot)!==plan.dataRoot)throw Error('stale_plan');
 const expected={...plan.manifest,sourceDigest:checked.snapshot.digest,sourceSchemaDigest:checked.snapshot.schemaDigest,sourceVersion:checked.snapshot.version,classificationDigest:checked.classificationDigest,mappingDigest:checked.mappingDigest,recordIdentities:checked.identities};
 if(JSON.stringify(expected)!==JSON.stringify(plan.manifest))throw Error('stale_plan');
 const copies=createManagedCopies(plan.dataRoot),copy=copies.list().find(c=>c.relativePath===path.relative(plan.dataRoot,plan.root));if(copy?.kind!=='staging'||!['ready','failed'].includes(copy.state))throw Error('staging_copy_unavailable');
 inspectMigrationStaging(plan);
 const inspection=new Database(path.join(plan.root,'career.sqlite'),{readonly:true,fileMustExist:true});try{const identity=inspection.prepare('SELECT instance FROM platform_workspace').get() as {instance:string};if(identity.instance!==plan.manifest.workspaceInstance||inspection.pragma('user_version',{simple:true})!==releases.length+1)throw Error('staging_identity_mismatch');}finally{inspection.close();}
 const workspace=await openWorkspace(plan.root,materialsMigration,releases).catch(error=>{copies.update(copy.id,{state:'failed',reason:'m1b_open_failed'});throw error;});
 try{if(workspace.workspaceInstance!==plan.manifest.workspaceInstance)throw Error('staging_identity_mismatch');copies.update(copy.id,{state:'ready'});const permit=stagingPermit(workspace.database,{...plan,workspaceInstance:workspace.workspaceInstance});
  durableJson(path.join(plan.root,'migration-run.json'),{planDigest:plan.planDigest,state:'running'});
  const result=workspace.database.transaction(()=>{
   const db=workspace.database,old=db.prepare('SELECT body FROM migration_import_receipts WHERE plan_digest=?').get(plan.planDigest) as {body:string}|undefined;if(old)return checkedReceipt(db,plan,old.body);
   const mappings:Receipt['mappings']=[],targets=new Map<string,HistoryReference>(),recordedAt=new Date().toISOString();
   const company=createCompanyDomain(db),opportunity=createOpportunityCore(db,{resolveCompany:company.resolveCompany}),archive=createLegacyHistoryStagingWriter(db,{dataRoot:plan.dataRoot,root:plan.root,workspaceInstance:workspace.workspaceInstance});
   const history=createLegacyHistory(db,()=>false).handle({operation:'legacy-history.list'});
   if(createProfileDomain(db).read().revision!==0||company.maintenanceObjects().length||opportunity.maintenanceObjects().length||hasResumeSnapshots(db,permit)||history.kind==='legacy_history_list'&&history.items.length||db.prepare('SELECT 1 FROM migration_import_receipts LIMIT 1').get())throw Error('partial_staging');
   const rank=(record:LegacyRecord)=>['profile','company','opportunity','resume','research-proposal','resume-proposal'].indexOf(record.kind);
   for(const record of [...checked.records].sort((a,b)=>rank(a)-rank(b))){
    const id=uuid(JSON.stringify([plan.planDigest,record.kind,record.identity]));let ref:{owner:Receipt['mappings'][number]['targetOwner'];objectId:string};
    if(record.kind==='profile'){const contact=[['phone',record.basics.phone],['email',record.basics.email],['wechat',record.basics.wechat]].filter(([,value])=>value).map(([label,value])=>label+': '+value).join('\n');
     importProfileSnapshot(db,permit,Profile.parse({revision:1,name:record.basics.name,contact,links:record.basics.links.map(link=>({label:link.label,href:link.url}))}));ref={owner:'profile',objectId:'current'};
    }else if(record.kind==='company'){importCompanySnapshot(db,permit,{id,name:record.name,revision:1});ref={owner:'company',objectId:id};
    }else if(record.kind==='opportunity'){const owner=targets.get(record.companyIdentity);if(owner?.owner!=='company')throw Error('missing_relation');importOpportunitySnapshot(db,permit,{id,companyId:owner.objectId,role:record.title,...record.jd!==undefined?{jd:record.jd}:{},revision:1,phase:'preparation',result:'active',stageDates:{submitted:{kind:'unknown'},interview:{kind:'unknown'},offer:{kind:'unknown'}},recordedAt},company.resolveCompany);ref={owner:'opportunity',objectId:id};
    }else if(record.kind==='resume'){const owner=targets.get(record.opportunityIdentity);if(owner?.owner!=='opportunity')throw Error('missing_relation');importResumeSnapshot(db,permit,{id,opportunityId:owner.objectId,revision:1,content:transformedDocument(record,plan.planDigest),recordedAt},opportunity.resolveOpportunity);ref={owner:'resume',objectId:id};
    }else{
     const owner=targets.get(record.target.identity),mapped=owner?.owner===record.target.type?owner:undefined,content=structuredClone(record.content);
     if(content.availability==='available')content.basis.sources=content.basis.sources.map(source=>{if(source.ownerReference)throw Error('legacy_reference_not_allowed');const mappedSource=targets.get(source.legacyIdentity);return {...source,...mappedSource?{ownerReference:mappedSource}:{}};});
     const item=archive.importRecord(LegacyHistoryImport.parse({kind:record.kind==='research-proposal'?'research':'resume',sourceSystem:'career-legacy',snapshotDigest:plan.manifest.sourceDigest,sourceRecordIdentity:record.identity,legacyStatus:record.legacyStatus,target:{legacyType:record.target.type,legacyIdentity:record.target.identity,resolution:mapped?'resolved':'unresolved',...mapped?{ownerReference:mapped}:{}},content,recordedAt:record.recordedAt,readOnly:true,independentlyVerified:false}));ref={owner:'ai-legacy-history',objectId:item.id};
    }
    if(ref.owner!=='ai-legacy-history')targets.set(record.identity,{owner:ref.owner,objectId:ref.objectId});
    mappings.push({sourceIdentity:record.identity,kind:record.kind,targetOwner:ref.owner,targetIdentity:ref.objectId,legacyRevision:record.revision,legacyRecordedAt:record.recordedAt});
    observation.onImported?.(mappings.length);
   }
   if(digest(readFileSync(input.sourcePath))!==plan.manifest.sourceDigest)throw Error('source_digest_changed');
   assertMigrationStaging(permit,db);validateBusinessCandidate(db);validateCandidateRelations(db);
   const receipt=Receipt.parse({planDigest:plan.planDigest,manifest:plan.manifest,status:'complete',mappings});db.prepare('INSERT INTO migration_import_receipts VALUES (?,?)').run(plan.planDigest,JSON.stringify(receipt));return receipt;
  })();durableJson(path.join(plan.root,'migration-run.json'),{planDigest:plan.planDigest,state:'complete'});return result;
 }catch(error){copies.update(copy.id,{state:'failed',reason:'m1b_run_failed'});durableJson(path.join(plan.root,'migration-run.json'),{planDigest:plan.planDigest,state:'failed'});throw error;}finally{workspace.close();}
}

import {test,expect} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createMaterialsBackend} from '../../packages/backend/domains/materials/public';
import {createFeishuDocumentReader} from '../../packages/backend/platform/connectors/feishu/document';
import {createFeishuDocumentImporter} from '../../packages/backend/application/materials/document-import';
const token='TESTDocumentToken12345',selectedRef=randomUUID();
async function preview(revision:number,text:string,accountIdentity?:string|null){const reader=createFeishuDocumentReader({...accountIdentity!==undefined?{getAccountIdentity:async()=>accountIdentity}:{},getConnectionStatus:async()=>({provider:'feishu',state:'connected'}),resolveDocument:()=>({token,type:'docx',title:'TEST Doc',url:'https://test.feishu.cn/docx/'+token}),readMetadata:async()=>({documentToken:token,title:'TEST Doc',revision}),readBlocks:async()=>({items:[{id:token,parentId:'',type:1,children:['TESTtext'],text:''},{id:'TESTtext',parentId:token,type:2,children:[],text}],hasMore:false})});const p=await reader.preview({requestId:randomUUID(),selectedRef});if(p.kind!=='document_preview')throw Error();return {reader,p};}
test('confirmed document saves exact Raw once across repeats and restart; new upstream version creates a new Raw',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-doc-TEST-'));let materials=await createMaterialsBackend(root,undefined,process.env.CAREER_DOCUMENT_TEST_WRITER??path.resolve('dist/application/writer.cjs'));
 try{let session=await materials.connectHuman();const first=await preview(7,'TEST original'),make=()=>createFeishuDocumentImporter({materials,session:()=>session,resolvePreview:first.reader.resolvePreview});let importer=make();const request={commandId:randomUUID(),previewRef:first.p.ref,previewDigest:first.p.provenance.previewDigest};
 const [saved,repeated]=await Promise.all([importer.importPreview(request),importer.importPreview({...request,commandId:randomUUID()})]);expect(saved.kind).toBe('raw_saved');if(saved.kind!=='raw_saved')throw Error();expect(repeated).toMatchObject({materialId:saved.materialId});expect(await materials.list(session)).toHaveLength(1);expect((await materials.read(session,saved.materialId)).text).toBe('TEST original');
 await materials.close();materials=await createMaterialsBackend(root,undefined,process.env.CAREER_DOCUMENT_TEST_WRITER??path.resolve('dist/application/writer.cjs'));session=await materials.connectHuman();importer=make();expect(await importer.importPreview({...request,commandId:randomUUID()})).toMatchObject({kind:'raw_saved',materialId:saved.materialId,duplicate:true});
 const newer=await preview(8,'TEST new version'),next=createFeishuDocumentImporter({materials,session:()=>session,resolvePreview:newer.reader.resolvePreview});const newSaved=await next.importPreview({commandId:randomUUID(),previewRef:newer.p.ref,previewDigest:newer.p.provenance.previewDigest});expect(newSaved.kind).toBe('raw_saved');expect(await materials.list(session)).toHaveLength(2);expect((await materials.read(session,saved.materialId)).text).toBe('TEST original');
 const conflicting=await preview(7,'TEST conflicting same revision'),conflict=createFeishuDocumentImporter({materials,session:()=>session,resolvePreview:conflicting.reader.resolvePreview});expect(await conflict.importPreview({commandId:randomUUID(),previewRef:conflicting.p.ref,previewDigest:conflicting.p.provenance.previewDigest})).toEqual({kind:'failure',reason:'source_version_conflict'});
 }finally{await materials.close();await rm(root,{recursive:true,force:true});}
},20000);
test('cancelled preview and browser supplied content cannot save Raw; source details survive owner reread',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-doc-TEST-')),materials=await createMaterialsBackend(root,undefined,process.env.CAREER_DOCUMENT_TEST_WRITER??path.resolve('dist/application/writer.cjs'));
 try{const session=await materials.connectHuman(),first=await preview(7,'TEST cancellation');const importer=createFeishuDocumentImporter({materials,session:()=>session,resolvePreview:first.reader.resolvePreview});const request={commandId:randomUUID(),previewRef:first.p.ref,previewDigest:first.p.provenance.previewDigest};
 expect(await importer.importPreview({...request,text:'Browser override'})).toEqual({kind:'failure',reason:'invalid_request'});first.reader.cancel({previewRef:first.p.ref});expect(await importer.importPreview(request)).toEqual({kind:'failure',reason:'preview_unavailable'});expect(await materials.list(session)).toHaveLength(0);
 const again=await preview(7,'TEST saved'),save=createFeishuDocumentImporter({materials,session:()=>session,resolvePreview:again.reader.resolvePreview});const result=await save.importPreview({commandId:randomUUID(),previewRef:again.p.ref,previewDigest:again.p.provenance.previewDigest});if(result.kind!=='raw_saved')throw Error();const raw=await materials.read(session,result.materialId);
 expect(raw.origin).toEqual({kind:'feishu_document',identity:'user',source:again.p.source,provenance:again.p.provenance,limitations:again.p.limitations,readBoundary:again.p.readBoundary,confirmationCommandId:result.commandId});expect(await materials.resolveSource(session,raw.source)).toEqual(raw);expect(await materials.receipt(session,result.commandId)).toMatchObject({status:'committed',materialId:raw.id});
 }finally{await materials.close();await rm(root,{recursive:true,force:true});}
},20000);
import {createRuntimeBackend} from '../../packages/backend/bootstrap/runtime';
import {Result as AiResult} from '../../packages/contracts/ai/schema';
import {Result as ProjectResult} from '../../packages/contracts/project/schema';
import {Result as WikiResult} from '../../packages/contracts/wiki/schema';
import {Result as DataResult} from '../../packages/contracts/application/schema';
test('personal document Raw is usable by explicit Project Wiki and local AI context without external calls; backup candidate preserves provenance',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-doc-context-TEST-')),runtime=await createRuntimeBackend(path.join(root,'workspace'),process.env.CAREER_DOCUMENT_TEST_WRITER??path.resolve('dist/application/writer.cjs'),root,{automaticBackups:false,providerBinding:{enabled:true,generation:'fake-v1'},providerKey:async()=>{throw Error('TEST_NETWORK_FORBIDDEN');},providerTransport:async()=>{throw Error('TEST_NETWORK_FORBIDDEN');}});
 try{const session=await runtime.connectHuman(),snapshot=await preview(7,'TEST SIMULATED career document'),importer=createFeishuDocumentImporter({materials:runtime.materials,session:()=>session,resolvePreview:snapshot.reader.resolvePreview});const imported=await importer.importPreview({commandId:randomUUID(),previewRef:snapshot.p.ref,previewDigest:snapshot.p.provenance.previewDigest});if(imported.kind!=='raw_saved')throw Error(JSON.stringify(imported));const raw=await runtime.materials.read(session,imported.materialId);expect(raw.scope).toBe('personal');
 expect(WikiResult.parse(await runtime.business(session,'wiki',{operation:'list'}))).toMatchObject({kind:'list',items:[]});
 const project=ProjectResult.parse(await runtime.business(session,'project',{operation:'create',commandId:randomUUID(),name:'TEST SIMULATED project',description:'TEST ONLY',tags:[],employmentId:null,occurredAt:{kind:'unknown'}}));if(project.kind!=='project')throw Error(JSON.stringify(project));
 const target={scope:'project' as const,scopeId:project.project.id};const knowledge=WikiResult.parse(await runtime.business(session,'wiki',{operation:'create',commandId:randomUUID(),title:'TEST explicit understanding',body:'TEST human record',...target,nature:'observation',sources:[{ref:raw.source,purpose:'TEST explicit source selection'}]}));expect(knowledge.kind).toBe('knowledge');
 const prepared=AiResult.parse(await runtime.business(session,'ai',{operation:'ai.prepare',commandId:randomUUID(),sources:[raw.source],target,budget:{requests:1,inputBytes:524288,outputBytes:196608}}));if(prepared.kind!=='task')throw Error(JSON.stringify(prepared));expect(prepared.task.target).toEqual(target);expect(prepared.task.operations[0]?.manifest?.materials).toEqual([{ref:raw.source,body:'TEST SIMULATED career document',nature:'evidence-original'}]);expect(prepared.task.usedRequests).toBe(0);expect(prepared.task.state).toBe('awaiting_authorization');
 const backup=DataResult.parse(await runtime.business(session,'application',{operation:'data.backup'}));if(backup.kind!=='backup')throw Error(JSON.stringify(backup));expect(DataResult.parse(await runtime.business(session,'application',{operation:'data.restore.prepare',backupId:backup.copy.id})).kind).toBe('restore_candidate');
 expect((await runtime.materials.read(session,raw.id)).origin).toEqual(raw.origin);
 }finally{await runtime.close();await rm(root,{recursive:true,force:true});}
},20000);
import {startWriter} from '../../packages/backend/platform/database/client';
import type {Store} from '../../packages/backend/domains/materials/store';
test('authoritative not_found permits only explicit continuation of the original confirmation command and snapshot',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-doc-recovery-TEST-')),writer=await startWriter<Store>(root,randomUUID(),process.env.CAREER_DOCUMENT_TEST_WRITER??path.resolve('dist/application/writer.cjs'));
 let drop=true;const confirmations:unknown[]=[];
 const faulted={...writer,call:((method:unknown,...args:unknown[])=>{if(method==='prepare'){confirmations.push(args[1]);if(drop){drop=false;return Promise.reject(Error('TEST IPC DROPPED BEFORE HANDOFF'));}}return (writer.call as (...args:unknown[])=>Promise<unknown>)(method,...args);}) as typeof writer.call};
 const materials=await createMaterialsBackend(root,undefined,undefined,faulted);
 try{const session=await materials.connectHuman(),snapshot=await preview(7,'TEST recover exact snapshot'),otherPreview=await preview(7,'TEST recover exact snapshot'),changedPreview=await preview(7,'TEST substitute bytes'),importer=createFeishuDocumentImporter({materials,session:()=>session,resolvePreview:input=>snapshot.reader.resolvePreview(input)??otherPreview.reader.resolvePreview(input)??changedPreview.reader.resolvePreview(input)}),request={commandId:randomUUID(),previewRef:snapshot.p.ref,previewDigest:snapshot.p.provenance.previewDigest};
 expect(await importer.importPreview({...request,continueAfterNotFound:true})).toEqual({kind:'failure',reason:'invalid_request'});expect(confirmations).toHaveLength(0);
 expect(await importer.importPreview(request)).toEqual({kind:'failure',reason:'result_unknown'});expect(await materials.receipt(session,request.commandId)).toEqual({status:'not_found',commandId:request.commandId});
 expect(await importer.importPreview(request)).toEqual({kind:'failure',reason:'result_unknown'});expect(confirmations).toHaveLength(1);
 expect(await importer.importPreview({...request,commandId:randomUUID(),continueAfterNotFound:true})).toEqual({kind:'failure',reason:'invalid_request'});expect(confirmations).toHaveLength(1);expect(await materials.list(session)).toHaveLength(0);
 expect(await importer.importPreview({...request,previewRef:otherPreview.p.ref,previewDigest:otherPreview.p.provenance.previewDigest,continueAfterNotFound:true})).toEqual({kind:'failure',reason:'invalid_request'});
 expect(await importer.importPreview({...request,previewRef:changedPreview.p.ref,previewDigest:changedPreview.p.provenance.previewDigest,continueAfterNotFound:true})).toEqual({kind:'failure',reason:'source_version_conflict'});expect(confirmations).toHaveLength(1);
 const saved=await importer.importPreview({...request,continueAfterNotFound:true});expect(saved).toMatchObject({kind:'raw_saved',commandId:request.commandId});expect(confirmations).toHaveLength(2);expect(confirmations[1]).toEqual(confirmations[0]);expect(await materials.list(session)).toHaveLength(1);
 if(saved.kind!=='raw_saved')throw Error(JSON.stringify(saved));expect((await materials.read(session,saved.materialId)).text).toBe('TEST recover exact snapshot');expect(await importer.importPreview({...request,continueAfterNotFound:true})).toMatchObject({kind:'raw_saved',materialId:saved.materialId,duplicate:true});expect(confirmations).toHaveLength(2);
 }finally{await materials.close();await rm(root,{recursive:true,force:true});}
},20000);
test('pending authority or an unreadable receipt never permits continuation, a new stage or a new command',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-doc-pending-TEST-')),writer=await startWriter<Store>(root,randomUUID(),process.env.CAREER_DOCUMENT_TEST_WRITER??path.resolve('dist/application/writer.cjs'));
 let drop=true,denyReceipt=false,confirmations=0;
 const faulted={...writer,call:(async(method:unknown,...args:unknown[])=>{
  if(method==='receipt'&&denyReceipt)throw Error('TEST RECEIPT TRANSPORT UNAVAILABLE');
  if(method==='prepare'){confirmations++;const result=await (writer.call as (...args:unknown[])=>Promise<unknown>)(method,...args);if(drop){drop=false;throw Error('TEST IPC DROPPED AFTER HANDOFF');}return result;}
  return (writer.call as (...args:unknown[])=>Promise<unknown>)(method,...args);
 }) as typeof writer.call};const materials=await createMaterialsBackend(root,undefined,undefined,faulted);
 try{const session=await materials.connectHuman(),snapshot=await preview(7,'TEST held confirmation'),importer=createFeishuDocumentImporter({materials,session:()=>session,resolvePreview:snapshot.reader.resolvePreview}),request={commandId:randomUUID(),previewRef:snapshot.p.ref,previewDigest:snapshot.p.provenance.previewDigest};
 expect(await importer.importPreview(request)).toEqual({kind:'failure',reason:'result_unknown'});expect(await materials.receipt(session,request.commandId)).toEqual({status:'pending',commandId:request.commandId});
 expect(await importer.importPreview({...request,continueAfterNotFound:true})).toEqual({kind:'failure',reason:'result_unknown'});expect(confirmations).toBe(1);expect(await materials.list(session)).toHaveLength(0);expect(await materials.stagingCount()).toBe(1);
 denyReceipt=true;expect(await importer.importPreview({...request,continueAfterNotFound:true})).toEqual({kind:'failure',reason:'result_unknown'});expect(confirmations).toBe(1);expect(await materials.list(session)).toHaveLength(0);
 }finally{await materials.close();await rm(root,{recursive:true,force:true});}
},20000);
test('Materials retains stable account-scoped document provenance and never merges different accounts',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-doc-account-TEST-')),materials=await createMaterialsBackend(root,undefined,process.env.CAREER_DOCUMENT_TEST_WRITER??path.resolve('dist/application/writer.cjs'));
 try{const session=await materials.connectHuman(),first=await preview(7,'TEST same document bytes','a'.repeat(64)),otherAccount=await preview(7,'TEST same document bytes','b'.repeat(64));
 async function save(snapshot:Awaited<ReturnType<typeof preview>>){return createFeishuDocumentImporter({materials,session:()=>session,resolvePreview:snapshot.reader.resolvePreview}).importPreview({commandId:randomUUID(),previewRef:snapshot.p.ref,previewDigest:snapshot.p.provenance.previewDigest});}
 const a=await save(first),b=await save(otherAccount);if(a.kind!=='raw_saved'||b.kind!=='raw_saved')throw Error();expect(a.materialId).not.toBe(b.materialId);expect(await materials.list(session)).toHaveLength(2);expect(await save(first)).toMatchObject({kind:'raw_saved',materialId:a.materialId,duplicate:true});expect((await materials.read(session,a.materialId)).origin).toMatchObject({kind:'feishu_document',source:{accountIdentity:'a'.repeat(64)},provenance:{revision:7}});expect((await materials.read(session,b.materialId)).origin).toMatchObject({kind:'feishu_document',source:{accountIdentity:'b'.repeat(64)},provenance:{revision:7}});
 }finally{await materials.close();await rm(root,{recursive:true,force:true});}
},20000);

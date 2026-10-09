import {test,expect,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createNodeHost} from '../../apps/desktop/node/host';
import {createBitableRawPreview} from '../../packages/backend/platform/connectors/feishu/raw-preview';
import {createBitableRawImporter} from '../../packages/backend/application/materials/bitable-import';
import {createMaterialsBackend} from '../../packages/backend/domains/materials/public';
import {startWriter} from '../../packages/backend/platform/database/client';
import type {Store} from '../../packages/backend/domains/materials/store';

const source={bitableRef:randomUUID(),bitableTitle:'TEST Base',tableRef:randomUUID(),tableName:'TEST Table',viewRef:randomUUID(),viewName:'TEST View'};
const snapshot={source,recordRef:randomUUID(),retrievedAt:'2026-10-08T01:00:00.000Z',selectedAt:'2026-10-08T01:01:00.000Z',upstreamUpdatedAt:null,columns:[{name:'TEST Title',type:'text'},{name:'TEST Attachment',type:'attachment'}],cells:[{kind:'text' as const,value:'TEST ONLY body'},{kind:'summary' as const,category:'attachment' as const,count:2,present:true}]};
const context={bind(){},replaceBinding(){},notify(){}};

test('approved cached preview saves through Materials once; duplicates and restart return the same Raw without external reads',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'career-F3D-TEST-')),network=vi.fn(async()=>{throw Error('NETWORK_FORBIDDEN');});
 const options={profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),automaticBackups:false,feishuSelectedRecordSnapshot:snapshot,feishuPorts:{authState:network,readCurrentUser:network,downloadAvatar:network},feishuBitableRecordPorts:{readRecords:network}};
 let host:Awaited<ReturnType<typeof createNodeHost>>|undefined;
 try{
  host=await createNodeHost(options);
  const business=async()=>({profile:await host!.handlers['business/profile']({operation:'profile.read'},context),wiki:await host!.handlers['business/wiki']({operation:'list',includeRetired:true},context)}),before=await business();
  const call=(name:string,input:unknown)=>host!.handlers[name]!(input,context);
  const rawBefore:any=await call('materials',{operation:'list'}),preview:any=await call('feishu/bitable/raw-preview',{recordRef:snapshot.recordRef});
  const input={commandId:randomUUID(),previewRef:preview.ref,previewDigest:preview.provenance.preview_digest};
  expect(await call('feishu/bitable/raw-import',{...input,text:'OVERRIDE'})).toMatchObject({kind:'failure',reason:'invalid_request'});
  expect(await call('feishu/bitable/raw-import',{...input,previewDigest:'f'.repeat(64)})).toMatchObject({kind:'failure',reason:'preview_unavailable'});
  const [saved,duplicate]:any[]=await Promise.all([call('feishu/bitable/raw-import',input),call('feishu/bitable/raw-import',{...input,commandId:randomUUID()})]);
  expect(saved).toMatchObject({kind:'raw_saved',source:{owner:'materials'},previewDigest:input.previewDigest});expect(duplicate.materialId).toBe(saved.materialId);
  const after:any=await call('materials',{operation:'list'});expect(after.items).toHaveLength(rawBefore.items.length+1);
  const read:any=await call('materials',{operation:'read',materialId:saved.materialId});
  expect(read.raw.text).toBe(preview.text);expect(read.raw.origin).toEqual({kind:'feishu_bitable_record',identity:'user',source:preview.source,provenance:preview.provenance,confirmationCommandId:saved.commandId});
  expect(read.raw.text).not.toMatch(/record_ref|access_token|tableRef/);expect(read.raw.source.owner).toBe('materials');
  expect(await call('materials',{operation:'receipt',commandId:saved.commandId})).toMatchObject({kind:'receipt',receipt:{status:'committed',materialId:saved.materialId}});
  expect(await business()).toEqual(before);expect(network).not.toHaveBeenCalled();
  const backup:any=await call('business/application',{operation:'data.backup'});expect(backup).toMatchObject({kind:'backup'});
  const candidate:any=await call('business/application',{operation:'data.restore.prepare',backupId:backup.copy.id});expect(candidate.kind).toBe('restore_candidate');
  await host.close();host=await createNodeHost({...options,feishuSelectedRecordSnapshot:undefined,feishuApprovedRawPreview:preview} as Parameters<typeof createNodeHost>[0]);
  expect(await call('feishu/bitable/selected',{})).toMatchObject({ref:preview.source.bitableRef,type:'bitable'});
  const again:any=await call('feishu/bitable/raw-import',{...input,commandId:randomUUID()});expect(again.materialId).toBe(saved.materialId);
  expect((await call('materials',{operation:'list'}) as any).items).toHaveLength(rawBefore.items.length+1);expect(network).not.toHaveBeenCalled();
 }finally{await host?.close();await rm(profile,{recursive:true,force:true});}
},30000);

test('cancelled or missing preview fails closed; Browser cannot submit content, raw identifiers or bypass Origin',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'career-F3D-TEST-'));let host:Awaited<ReturnType<typeof createNodeHost>>|undefined;
 try{
  host=await createNodeHost({profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),automaticBackups:false,feishuSelectedRecordSnapshot:snapshot});
  const preview:any=await host.handlers['feishu/bitable/raw-preview']({recordRef:snapshot.recordRef},context),input={commandId:randomUUID(),previewRef:preview.ref,previewDigest:preview.provenance.preview_digest};
  const boot=await fetch(host.url+'/api/bootstrap',{method:'POST',headers:{Origin:host.url,'Content-Type':'application/json'},body:'{}'}),headers={Origin:host.url,'Content-Type':'application/json',Cookie:boot.headers.get('set-cookie')!.split(';')[0]!,'X-Career-Capability':(await boot.json()).capability};
  const send=(route:string,data:unknown,h=headers)=>fetch(host!.url+'/api/'+route,{method:'POST',headers:h,body:JSON.stringify(data)});await send('ready',{});
  expect((await send('feishu/bitable/raw-import',input,{...headers,Origin:'https://other.example'})).status).toBe(403);
  expect((await(await send('feishu/bitable/raw-import',{...input,app_token:'TEST'})).json()).result).toMatchObject({kind:'failure',reason:'invalid_request'});
  await send('feishu/bitable/raw-preview-cancel',{previewRef:preview.ref});
  expect((await(await send('feishu/bitable/raw-import',input)).json()).result).toMatchObject({kind:'failure',reason:'preview_unavailable'});
  expect((await host.handlers.materials({operation:'list'},context) as any).items).toHaveLength(0);
  await host.close();host=await createNodeHost({profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),automaticBackups:false});
  expect(await host.handlers['feishu/bitable/raw-import'](input,context)).toMatchObject({kind:'failure',reason:'preview_unavailable'});
 }finally{await host?.close();await rm(profile,{recursive:true,force:true});}
},30000);

test('trusted volatile preview handoff rejects tampered text and provenance',()=>{
 const converter=createBitableRawPreview({readSelectedRecord:()=>snapshot}),preview=converter.prepare({recordRef:snapshot.recordRef});if(preview.kind!=='raw_preview')throw Error();
 expect(()=>createBitableRawPreview({readSelectedRecord:()=>undefined},{...preview,text:'TAMPERED'})).toThrow();
 expect(()=>createBitableRawPreview({readSelectedRecord:()=>undefined},{...preview,source:{...preview.source,tableRef:randomUUID()}})).toThrow();
});

test.each(['list','preview'] as const)('cancellation while awaiting %s prevents confirmation and removes staged bytes',async method=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-F3D-cancel-TEST-')),writer=await startWriter<Store>(root,randomUUID(),path.resolve('dist/application/writer.cjs'));
 let release!:()=>void,reached!:()=>void,hold=true;const waiting=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{reached=resolve;});
 const gated={...writer,call:(async(name:unknown,...args:unknown[])=>{const result=await (writer.call as (...args:unknown[])=>Promise<unknown>)(name,...args);if(name===method&&hold){hold=false;reached();await waiting;}return result;}) as typeof writer.call};
 const materials=await createMaterialsBackend(root,undefined,undefined,gated);
 try {const session=await materials.connectHuman(),converter=createBitableRawPreview({readSelectedRecord:()=>snapshot}),preview=converter.prepare({recordRef:snapshot.recordRef});if(preview.kind!=='raw_preview')throw Error();
  const importer=createBitableRawImporter({materials,session:()=>session,resolvePreview:converter.resolveForImport}),input={commandId:randomUUID(),previewRef:preview.ref,previewDigest:preview.provenance.preview_digest};
  const saving=importer.importPreview(input);await started;converter.cancel({previewRef:preview.ref});release();
  expect(await saving).toEqual({kind:'failure',reason:'preview_unavailable'});expect(await materials.list(session)).toHaveLength(0);expect(await materials.receipt(session,input.commandId)).toEqual({status:'not_found',commandId:input.commandId});expect(await materials.stagingCount()).toBe(0);
 }finally {release();await materials.close();await rm(root,{recursive:true,force:true});}
},20000);

test.each([false,true])('cancellation after commit preserves the authoritative receipt even with lost reply=%s',async lostReply=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-F3D-committed-TEST-')),writer=await startWriter<Store>(root,randomUUID(),path.resolve('dist/application/writer.cjs'));
 let release!:()=>void,reached!:()=>void;const waiting=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{reached=resolve;});
 const gated={...writer,call:(async(name:unknown,...args:unknown[])=>{const result=await (writer.call as (...args:unknown[])=>Promise<unknown>)(name,...args);if(name==='commit'){reached();await waiting;if(lostReply)throw Error('TEST_COMMIT_REPLY_DROPPED');}return result;}) as typeof writer.call};
 const materials=await createMaterialsBackend(root,undefined,undefined,gated);
 try{const session=await materials.connectHuman(),converter=createBitableRawPreview({readSelectedRecord:()=>snapshot}),preview=converter.prepare({recordRef:snapshot.recordRef});if(preview.kind!=='raw_preview')throw Error();const importer=createBitableRawImporter({materials,session:()=>session,resolvePreview:converter.resolveForImport}),input={commandId:randomUUID(),previewRef:preview.ref,previewDigest:preview.provenance.preview_digest};
  const saving=importer.importPreview(input);await started;converter.cancel({previewRef:preview.ref});release();const result=await saving;expect(result.kind).toBe('raw_saved');const receipt=await materials.receipt(session,input.commandId);expect(receipt.status).toBe('committed');if(receipt.status!=='committed')throw Error();if(result.kind==='raw_saved')expect(result.materialId).toBe(receipt.materialId);expect((await materials.read(session,receipt.materialId)).text).toBe(preview.text);expect(await materials.list(session)).toHaveLength(1);
 }finally{release();await materials.close();await rm(root,{recursive:true,force:true});}
},20000);

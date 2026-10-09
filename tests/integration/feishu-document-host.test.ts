import {test,expect,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createNodeHost,type NodeHostOptions} from '../../apps/desktop/node/host';
import {Result as MaterialsResult} from '../../packages/contracts/materials/schema';
import {FeishuSearchResult} from '../../packages/contracts/platform/feishu-discovery';
import {FeishuDocumentResult,FeishuDocumentImportResult} from '../../packages/contracts/platform/feishu-document';

const context={bind(){},replaceBinding(){},notify(){}};

test('selected Feishu document needs explicit confirmation, saves one Materials Raw, and survives host restart without changing Profile or Wiki',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'career-document-host-TEST-'));
 const token='TESTDocumentToken12345',title='TEST SIMULATED 云文档',body='TEST DATA：隔离云文档正文，不代表真实外部资料。';
 const credentialSentinel='TEST_ACCESS_TOKEN_DO_NOT_EXPOSE';
 const forbiddenNetwork=vi.fn(async()=>{throw Error('REAL_NETWORK_FORBIDDEN');});
 const readCurrentUser=vi.fn(async()=>({displayName:'TEST SIMULATED nickname',access_token:credentialSentinel,open_id:'TEST_PRIVATE_USER_ID'}));
 const searchDocuments=vi.fn(async(query:string)=>{
  expect(query).toBe('TEST');
  return {hasMore:false,items:[{documentId:token,title,type:'docx' as const,updatedAt:null,url:'https://test.feishu.cn/docx/'+token}]};
 });
 const readMetadata=vi.fn(async(documentToken:string,signal:AbortSignal)=>{
  signal.throwIfAborted();expect(documentToken).toBe(token);
  return {documentToken:token,title,revision:7};
 });
 const readBlocks=vi.fn(async(documentToken:string,revision:number,pageToken:string|undefined,signal:AbortSignal)=>{
  signal.throwIfAborted();expect(documentToken).toBe(token);expect(revision).toBe(7);expect(pageToken).toBeUndefined();
  return {items:[{id:token,parentId:'',type:1,children:['TESTHeadingBlock','TESTBodyBlock'],text:''},{id:'TESTHeadingBlock',parentId:token,type:3,children:[],text:'TEST 复盘标题'},{id:'TESTBodyBlock',parentId:token,type:2,children:[],text:body}],hasMore:false};
 });
 const options:NodeHostOptions={profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false,
  feishuPorts:{authState:async()=>'ready',readCurrentUser,downloadAvatar:forbiddenNetwork},
  feishuDiscoveryPorts:{searchDocuments},feishuDocumentPorts:{readMetadata,readBlocks},providerTransport:forbiddenNetwork,tavilyTransport:forbiddenNetwork};
 let host:Awaited<ReturnType<typeof createNodeHost>>|undefined;
 const call=(name:string,input:unknown)=>host!.handlers[name]!(input,context);
 const materials=async(input:unknown)=>MaterialsResult.parse(await call('materials',input));
 const list=async()=>{const result=await materials({operation:'list'});if(result.kind!=='list')throw Error('expected_materials_list');return result.items;};
 const business=async()=>({profile:await call('business/profile',{operation:'profile.read'}),wiki:await call('business/wiki',{operation:'list',includeRetired:true})});
 const reads=()=>({metadata:readMetadata.mock.calls.length,blocks:readBlocks.mock.calls.length});
 const select=async()=>{
  const result=FeishuSearchResult.parse(await call('feishu/search',{searchId:randomUUID(),query:'TEST'}));
  if(result.kind!=='results')throw Error('expected_metadata_results');
  expect(result.items).toHaveLength(1);const selected=result.items[0]!;
  expect(selected).toMatchObject({title,type:'docx'});expect(selected.ref).not.toBe(token);
  expect(Object.keys(selected).sort()).toEqual(['ref','title','type','updatedAt','url']);return selected.ref;
 };
 const preview=async(selectedRef:string)=>{
  const result=FeishuDocumentResult.parse(await call('feishu/document/preview',{requestId:randomUUID(),selectedRef}));
  if(result.kind!=='document_preview')throw Error('expected_document_preview');
  expect(result.text).toBe('# TEST 复盘标题\n'+body);expect(result.provenance).toMatchObject({revision:7,complete:true});
  expect(result.readBoundary.requestsMade).toBe(3);return result;
 };
 try{
  host=await createNodeHost(options);const before=await business();expect(await list()).toHaveLength(0);
  expect(await call('feishu/search',{searchId:randomUUID(),query:'TEST'})).toEqual({kind:'failure',reason:'not_connected'});
  expect(searchDocuments).not.toHaveBeenCalled();
  expect(await call('feishu/connect',{})).toEqual({provider:'feishu',state:'connected'});expect(readCurrentUser).toHaveBeenCalledTimes(1);
  const selectedRef=await select();expect(reads()).toEqual({metadata:0,blocks:0});
  expect(await call('feishu/document/preview',{requestId:randomUUID(),selectedRef:token})).toEqual({kind:'failure',reason:'invalid_request'});
  expect(await call('feishu/document/preview',{requestId:randomUUID(),selectedRef:randomUUID()})).toEqual({kind:'failure',reason:'reference_unavailable'});
  expect(await call('feishu/document/preview',{requestId:randomUUID(),selectedRef,documentToken:token})).toEqual({kind:'failure',reason:'invalid_request'});
  expect(reads()).toEqual({metadata:0,blocks:0});

  const cancelled=await preview(selectedRef),afterPreviewReads=reads();
  expect(await call('feishu/document/cached-preview',{selectedRef})).toEqual(cancelled);expect(reads()).toEqual(afterPreviewReads);
  expect(await list()).toHaveLength(0);
  expect(await call('feishu/document/cancel',{previewRef:cancelled.ref})).toEqual({kind:'cancelled'});
  expect(await call('feishu/document/cached-preview',{selectedRef})).toEqual({kind:'failure',reason:'preview_unavailable'});
  expect(await call('feishu/document/import',{commandId:randomUUID(),previewRef:cancelled.ref,previewDigest:cancelled.provenance.previewDigest})).toEqual({kind:'failure',reason:'preview_unavailable'});
  expect(await list()).toHaveLength(0);expect(await business()).toEqual(before);

  const ready=await preview(selectedRef),readyReads=reads();
  expect(await call('feishu/document/cached-preview',{selectedRef})).toEqual(ready);expect(reads()).toEqual(readyReads);
  const confirmation={commandId:randomUUID(),previewRef:ready.ref,previewDigest:ready.provenance.previewDigest};
  expect(await call('feishu/document/import',{...confirmation,text:'BROWSER_OVERRIDE'})).toEqual({kind:'failure',reason:'invalid_request'});
  expect(await call('feishu/document/import',{...confirmation,previewRef:randomUUID()})).toEqual({kind:'failure',reason:'preview_unavailable'});
  expect(await call('feishu/document/import',{...confirmation,previewDigest:'f'.repeat(64)})).toEqual({kind:'failure',reason:'preview_unavailable'});
  expect(await list()).toHaveLength(0);
  const saved=FeishuDocumentImportResult.parse(await call('feishu/document/import',confirmation));
  if(saved.kind!=='raw_saved')throw Error('expected_confirmed_raw');
  expect(saved).toMatchObject({commandId:confirmation.commandId,duplicate:false,source:{owner:'materials'},previewDigest:confirmation.previewDigest});
  const repeated=FeishuDocumentImportResult.parse(await call('feishu/document/import',confirmation));
  const newConfirmation=FeishuDocumentImportResult.parse(await call('feishu/document/import',{...confirmation,commandId:randomUUID()}));
  expect(repeated).toMatchObject({kind:'raw_saved',materialId:saved.materialId,commandId:confirmation.commandId,duplicate:true});
  expect(newConfirmation).toMatchObject({kind:'raw_saved',materialId:saved.materialId,commandId:confirmation.commandId,duplicate:true});
  expect((await list()).map(item=>item.id)).toEqual([saved.materialId]);expect(reads()).toEqual(readyReads);
  const readback=await materials({operation:'read',materialId:saved.materialId});
  if(readback.kind!=='raw')throw Error('expected_formal_raw_readback');
  expect(readback.raw.text).toBe('# TEST 复盘标题\n'+body);
  expect(readback.raw.origin).toEqual({kind:'feishu_document',identity:'user',source:ready.source,provenance:ready.provenance,limitations:ready.limitations,readBoundary:ready.readBoundary,confirmationCommandId:confirmation.commandId});
  expect(await materials({operation:'receipt',commandId:confirmation.commandId})).toMatchObject({kind:'receipt',receipt:{status:'committed',materialId:saved.materialId}});
  const exposed=JSON.stringify([await call('feishu/identity',{}),await call('feishu/document/cached-preview',{selectedRef}),readback,await list()]);
  expect(exposed).not.toMatch(/TEST_ACCESS_TOKEN_DO_NOT_EXPOSE|TEST_PRIVATE_USER_ID|"access_token"|"refresh_token"|"open_id"|"documentToken"/);
  expect(readback.raw.text).not.toContain(token);expect(await business()).toEqual(before);

  await host.close();host=await createNodeHost(options);
  expect(await materials({operation:'read',materialId:saved.materialId})).toEqual(readback);
  expect((await list()).map(item=>item.id)).toEqual([saved.materialId]);expect(await business()).toEqual(before);
  expect(await call('feishu/document/cached-preview',{selectedRef})).toEqual({kind:'failure',reason:'preview_unavailable'});
  expect(await call('feishu/document/preview',{requestId:randomUUID(),selectedRef})).toEqual({kind:'failure',reason:'reference_unavailable'});
  expect(await call('feishu/document/import',confirmation)).toEqual({kind:'failure',reason:'preview_unavailable'});expect(reads()).toEqual(readyReads);
  const renewedSelection=await select(),renewedPreview=await preview(renewedSelection);
  expect(await call('feishu/document/import',{commandId:randomUUID(),previewRef:renewedPreview.ref,previewDigest:renewedPreview.provenance.previewDigest})).toMatchObject({kind:'raw_saved',materialId:saved.materialId,commandId:confirmation.commandId,duplicate:true});
  expect((await list()).map(item=>item.id)).toEqual([saved.materialId]);expect(await business()).toEqual(before);
  expect(readCurrentUser).toHaveBeenCalledTimes(1);expect(forbiddenNetwork).not.toHaveBeenCalled();
 }finally{await host?.close();await rm(profile,{recursive:true,force:true});}
},30000);

test('a known account switch revokes cached document read and import capabilities without any new body read',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'career-document-account-TEST-'));let host:Awaited<ReturnType<typeof createNodeHost>>|undefined,account='a'.repeat(64),reads=0;
 const token='TESTAccountDocument12345';
 try{host=await createNodeHost({profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),automaticBackups:false,port:0,feishuPorts:{authState:async()=>'ready',currentAccountIdentity:()=>account,readCurrentUser:async()=>({displayName:'TEST Nickname'}),downloadAvatar:async()=>({bytes:Buffer.alloc(0),mime:'image/png'})},feishuDiscoveryPorts:{searchDocuments:async()=>({hasMore:false,items:[{documentId:token,title:'TEST account-bound document',type:'docx',url:null,updatedAt:null}]})},feishuDocumentPorts:{readMetadata:async()=>({documentToken:token,title:'TEST account-bound document',revision:1}),readBlocks:async()=>{reads++;return {items:[{id:token,parentId:'',type:1,children:['body'],text:''},{id:'body',parentId:token,type:2,children:[],text:'TEST account-bound text'}],hasMore:false};}}});
  await host.handlers['feishu/connect']({},context);const results:any=await host.handlers['feishu/search']({searchId:randomUUID(),query:'TEST'},context),selectedRef=results.items[0].ref;
  const preview:any=await host.handlers['feishu/document/preview']({requestId:randomUUID(),selectedRef},context);expect(preview.kind).toBe('document_preview');expect(preview.source.accountIdentity).toBe('a'.repeat(64));account='b'.repeat(64);
  expect(await host.handlers['feishu/document/import']({commandId:randomUUID(),previewRef:preview.ref,previewDigest:preview.provenance.previewDigest},context)).toEqual({kind:'failure',reason:'preview_unavailable'});
  expect(await host.handlers['feishu/document/cached-preview']({selectedRef},context)).toEqual({kind:'failure',reason:'preview_unavailable'});expect(reads).toBe(1);expect(await host.handlers.materials({operation:'list'},context)).toMatchObject({kind:'list',items:[]});
 }finally{await host?.close();await rm(profile,{recursive:true,force:true});}
});

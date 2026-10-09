import {test,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createFeishuDocumentReader} from '../packages/backend/platform/connectors/feishu/document';
const token='TESTDocumentToken12345', selectedRef=randomUUID();
const block=(id:string,text:string)=>({id,parentId:token,type:2,children:[],text});
const status=async()=>({provider:'feishu' as const,state:'connected' as const});
test('selected opaque docx reference produces a bounded versioned preview across pages',async()=>{
 const reader=createFeishuDocumentReader({getConnectionStatus:status,resolveDocument:ref=>ref===selectedRef?{token,type:'docx',url:null,title:'TEST selected'}:undefined,readMetadata:async()=>({documentToken:token,title:'TEST Document',revision:7}),readBlocks:async(_token,revision,page)=>{expect(revision).toBe(7);return page?{items:[block('TESTb','TEST body')],hasMore:false}:{items:[{id:token,parentId:'',type:1,children:['TESTa','TESTb'],text:''},block('TESTa','TEST heading')],hasMore:true,pageToken:'TESTpage'};}});
 const result=await reader.preview({requestId:randomUUID(),selectedRef});
 expect(result).toMatchObject({kind:'document_preview',title:'TEST Document',text:'TEST heading\nTEST body',provenance:{revision:7,complete:true}});
 if(result.kind!=='document_preview')throw Error();expect(reader.resolvePreview({previewRef:result.ref,previewDigest:result.provenance.previewDigest})).toEqual(result);
 expect(JSON.stringify(result)).not.toContain(token);
});
test('headings, lists and table cells remain readable while media and links are explicit unexpanded placeholders',async()=>{
 const items=[{id:token,parentId:'',type:1,children:['h','list','table','img','file','link'],text:''},{...block('h','TEST Heading'),type:3},{...block('list','TEST item'),type:12},{...block('table',''),type:31,children:['cell']},{...block('cell',''),parentId:'table',type:32,children:['p']},{...block('p','TEST cell'),parentId:'cell'},{...block('img','PRIVATE_IMAGE'),type:27},{...block('file','PRIVATE_FILE'),type:23},{...block('link','PRIVATE_LINK'),type:46,children:['FOREIGN']}];
 const reader=createFeishuDocumentReader({getConnectionStatus:status,resolveDocument:()=>({token,type:'docx',url:null,title:'TEST'}),readMetadata:async()=>({documentToken:token,title:'TEST',revision:3}),readBlocks:async()=>({items,hasMore:false})});
 const result=await reader.preview({requestId:randomUUID(),selectedRef});expect(result).toMatchObject({kind:'document_preview',text:'# TEST Heading\n- TEST item\n[表格]\n[单元格]\nTEST cell\n[图片未下载]\n[附件未下载]\n[关联内容未展开]'});
 expect(JSON.stringify(result)).not.toMatch(/PRIVATE|FOREIGN/);
});
test('cancel aborts the in-flight request and never exposes a late preview or automatic retry',async()=>{
 let entered!:()=>void;const reached=new Promise<void>(r=>entered=r);let signal:AbortSignal|undefined;
 const reader=createFeishuDocumentReader({getConnectionStatus:status,resolveDocument:()=>({token,type:'docx',url:null,title:'TEST'}),readMetadata:async()=>({documentToken:token,title:'TEST',revision:1}),readBlocks:async(_t,_r,_p,s)=>{signal=s;entered();await new Promise<void>(resolve=>s.addEventListener('abort',()=>resolve(),{once:true}));return {items:[],hasMore:false};}});
 const requestId=randomUUID(),request={requestId,selectedRef};const pending=reader.preview(request);await reached;expect(reader.cancel({requestId})).toEqual({kind:'cancelled'});expect(signal?.aborted).toBe(true);expect(await pending).toEqual({kind:'failure',reason:'cancelled'});expect(await reader.preview(request)).toEqual({kind:'failure',reason:'cancelled'});
});
test('source revision drift, broken pagination, bounds and unauthorized failures never yield a saveable preview',async()=>{
 const base={getConnectionStatus:status,resolveDocument:()=>({token,type:'docx' as const,url:null,title:'TEST'}),readMetadata:async()=>({documentToken:token,title:'TEST',revision:1}),readBlocks:async()=>({items:[{id:token,parentId:'',type:1,children:['a'],text:''},block('a','TEST')],hasMore:false})};
 let count=0;expect(await createFeishuDocumentReader({...base,readMetadata:async()=>({documentToken:token,title:'TEST',revision:++count})}).preview({requestId:randomUUID(),selectedRef})).toEqual({kind:'failure',reason:'version_changed'});
 expect(await createFeishuDocumentReader({...base,readBlocks:async()=>({items:[],hasMore:true,pageToken:'TESTsame'})}).preview({requestId:randomUUID(),selectedRef})).toEqual({kind:'failure',reason:'read_failed'});
 let pages=0;expect(await createFeishuDocumentReader({...base,readBlocks:async()=>({items:[],hasMore:true,pageToken:'TEST'+(++pages)})}).preview({requestId:randomUUID(),selectedRef})).toEqual({kind:'failure',reason:'limit_exceeded'});
 expect(await createFeishuDocumentReader({...base,readBlocks:async()=>({items:[{id:token,parentId:'',type:1,children:['a'],text:''},block('a','中'.repeat(70000))],hasMore:false})}).preview({requestId:randomUUID(),selectedRef})).toEqual({kind:'failure',reason:'limit_exceeded'});
 expect(await createFeishuDocumentReader({...base,readBlocks:async()=>{throw Error('feishu_document_permission_required');}}).preview({requestId:randomUUID(),selectedRef})).toEqual({kind:'failure',reason:'permission_required'});
});
test('wiki routes to the actual docx identity; legacy docs with no existing upgraded identity remain unsupported',async()=>{
 const base={getConnectionStatus:status,resolveDocument:()=>({token:'TESTWikiNodeToken12345',type:'wiki' as const,url:'https://test.feishu.cn/wiki/TESTWikiNodeToken12345',title:'TEST'}),resolveWiki:async()=>({documentToken:token,type:'docx',title:'TEST'}),readMetadata:async()=>({documentToken:token,title:'TEST',revision:1}),readBlocks:async()=>({items:[{id:token,parentId:'',type:1,children:['a'],text:''},block('a','TEST')],hasMore:false})};
 expect(await createFeishuDocumentReader(base).preview({requestId:randomUUID(),selectedRef})).toMatchObject({kind:'document_preview',source:{sourceUrl:base.resolveDocument().url,accountIdentity:null},limitations:['connection_identity_unavailable']});
 expect(await createFeishuDocumentReader({...base,resolveWiki:async()=>({documentToken:token,type:'bitable',title:'TEST'})}).preview({requestId:randomUUID(),selectedRef})).toEqual({kind:'failure',reason:'unsupported_type'});
 expect(await createFeishuDocumentReader({...base,resolveDocument:()=>({...base.resolveDocument(),type:'doc' as const}),resolveLegacy:async()=>undefined}).preview({requestId:randomUUID(),selectedRef})).toEqual({kind:'failure',reason:'unsupported_type'});
});
test('oversized first page stops before reading another page or producing any import handle',async()=>{
 let calls=0;const reader=createFeishuDocumentReader({getConnectionStatus:status,resolveDocument:()=>({token,type:'docx',url:null,title:'TEST'}),readMetadata:async()=>({documentToken:token,title:'TEST',revision:1}),readBlocks:async()=>{calls++;return {items:[{id:token,parentId:'',type:1,children:['a'],text:''},block('a','中'.repeat(70000))],hasMore:true,pageToken:'TESTnext'};}});
 expect(await reader.preview({requestId:randomUUID(),selectedRef})).toEqual({kind:'failure',reason:'limit_exceeded'});expect(calls).toBe(1);
});
test('cached preview reopens the same complete snapshot without contacting any port; cancel and dispose remove it',async()=>{
 let externalCalls=0;const requestId=randomUUID();const reader=createFeishuDocumentReader({getConnectionStatus:async()=>{externalCalls++;return status();},resolveDocument:()=>{externalCalls++;return {token,type:'docx',url:null,title:'TEST'};},readMetadata:async()=>{externalCalls++;return {documentToken:token,title:'TEST',revision:1};},readBlocks:async()=>{externalCalls++;return {items:[{id:token,parentId:'',type:1,children:['a'],text:''},block('a','TEST cached')],hasMore:false};}});
 expect(reader.cachedPreview({selectedRef})).toEqual({kind:'failure',reason:'preview_unavailable'});expect(externalCalls).toBe(0);
 const preview=await reader.preview({requestId,selectedRef}),count=externalCalls;expect(reader.cachedPreview({selectedRef})).toEqual(preview);const copy=reader.cachedPreview({selectedRef});if(copy.kind!=='document_preview')throw Error();copy.text='TEST MUTATED';expect(reader.cachedPreview({selectedRef})).toMatchObject({text:'TEST cached'});
 expect(reader.cachedPreview({selectedRef,token})).toEqual({kind:'failure',reason:'invalid_request'});expect(reader.cachedPreview({selectedRef:randomUUID()})).toEqual({kind:'failure',reason:'preview_unavailable'});expect(externalCalls).toBe(count);
 reader.cancel({requestId});expect(reader.cachedPreview({selectedRef})).toEqual({kind:'failure',reason:'preview_unavailable'});
 const again=await reader.preview({requestId:randomUUID(),selectedRef});if(again.kind!=='document_preview')throw Error();reader.cancel({previewRef:again.ref});expect(reader.cachedPreview({selectedRef})).toEqual({kind:'failure',reason:'preview_unavailable'});
 await reader.preview({requestId:randomUUID(),selectedRef});const after=externalCalls;reader.dispose();expect(reader.cachedPreview({selectedRef})).toEqual({kind:'failure',reason:'preview_unavailable'});expect(externalCalls).toBe(after);
});
test('cancel by original request removes cached preview even after the attempt dedup window expires',async()=>{
 let fail=false;const requestId=randomUUID(),reader=createFeishuDocumentReader({getConnectionStatus:status,resolveDocument:()=>({token,type:'docx',url:null,title:'TEST'}),readMetadata:async()=>{if(fail)throw Error('TEST read failure');return {documentToken:token,title:'TEST',revision:1};},readBlocks:async()=>({items:[{id:token,parentId:'',type:1,children:['a'],text:''},block('a','TEST cache survives failed reads')],hasMore:false})});
 expect((await reader.preview({requestId,selectedRef})).kind).toBe('document_preview');fail=true;for(let i=0;i<101;i++)await reader.preview({requestId:randomUUID(),selectedRef});expect(reader.cachedPreview({selectedRef}).kind).toBe('document_preview');reader.cancel({requestId});expect(reader.cachedPreview({selectedRef})).toEqual({kind:'failure',reason:'preview_unavailable'});
});
test('todo completion reflects the official state and missing state is explicit rather than fabricated',async()=>{
 const reader=createFeishuDocumentReader({getConnectionStatus:status,resolveDocument:()=>({token,type:'docx',url:null,title:'TEST'}),readMetadata:async()=>({documentToken:token,title:'TEST',revision:1}),readBlocks:async()=>({items:[{id:token,parentId:'',type:1,children:['a','b','c'],text:''},{...block('a','TEST completed'),type:17,done:true},{...block('b','TEST open'),type:17,done:false},{...block('c','TEST missing state'),type:17}],hasMore:false})});const result=await reader.preview({requestId:randomUUID(),selectedRef});expect(result).toMatchObject({kind:'document_preview',text:'- [x] TEST completed\n- [ ] TEST open\n[状态未提供] TEST missing state',blocks:[{kind:'todo',done:true},{kind:'todo',done:false},{kind:'todo',done:null}]});
});
test('current backend account scope is captured before body reads and separates the same document across accounts',async()=>{
 async function read(account:string){let checked=false,captured=false;const reader=createFeishuDocumentReader({getConnectionStatus:async()=>{checked=true;return status();},getAccountIdentity:async()=>{expect(checked).toBe(true);captured=true;return account;},resolveDocument:()=>({token,type:'docx',url:null,title:'TEST'}),readMetadata:async()=>{expect(captured).toBe(true);return {documentToken:token,title:'TEST',revision:1};},readBlocks:async()=>({items:[{id:token,parentId:'',type:1,children:['a'],text:''},block('a','TEST account-scoped body')],hasMore:false})});return reader.preview({requestId:randomUUID(),selectedRef});}
 const first=await read('a'.repeat(64)),second=await read('b'.repeat(64));expect(first).toMatchObject({kind:'document_preview',source:{accountIdentity:'a'.repeat(64)},limitations:[]});expect(second).toMatchObject({kind:'document_preview',source:{accountIdentity:'b'.repeat(64)},limitations:[]});if(first.kind!=='document_preview'||second.kind!=='document_preview')throw Error();expect(first.source.documentIdentity).not.toBe(second.source.documentIdentity);
});
test('account drift including unavailable-to-current transition discards body and creates no cached preview',async()=>{
 for(const initial of ['a'.repeat(64),null]){let statuses=0;const reader=createFeishuDocumentReader({getConnectionStatus:async()=>{statuses++;return status();},getAccountIdentity:async()=>statuses===1?initial:'b'.repeat(64),resolveDocument:()=>({token,type:'docx',url:null,title:'TEST'}),readMetadata:async()=>({documentToken:token,title:'TEST',revision:1}),readBlocks:async()=>({items:[{id:token,parentId:'',type:1,children:['a'],text:''},block('a','TEST must discard on account change')],hasMore:false})});expect(await reader.preview({requestId:randomUUID(),selectedRef})).toEqual({kind:'failure',reason:'account_changed'});expect(reader.cachedPreview({selectedRef})).toEqual({kind:'failure',reason:'preview_unavailable'});}
});

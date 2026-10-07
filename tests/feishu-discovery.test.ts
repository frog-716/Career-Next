import {expect,test,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createLarkCliDiscoveryPorts,feishuMetadataProjection} from '../packages/backend/platform/connectors/feishu/lark-cli';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {createFeishuDiscovery} from '../packages/backend/platform/connectors/feishu/discovery';

test('one title-only user search projects only document metadata without fetching or returning content',async()=>{
 const run=vi.fn(async(_args:string[])=>({code:0,stdout:JSON.stringify({ok:true,data:{has_more:true,results:[{title:'TEST 项目复盘',type:'DOCX',updatedAt:'2026-10-01T12:00:00Z',url:'https://test.feishu.cn/docx/TEST',documentId:'TEST-reference'}]}})}));
 const result=await createLarkCliDiscoveryPorts(run).searchDocuments('项目复盘');
 expect(result).toEqual({hasMore:true,items:[{documentId:'TEST-reference',title:'TEST 项目复盘',type:'docx',updatedAt:'2026-10-01T12:00:00.000Z',url:'https://test.feishu.cn/docx/TEST'}]});
 expect(run).toHaveBeenCalledTimes(1);
 expect(run.mock.calls[0]?.[0]).toEqual(expect.arrayContaining(['drive','+search','--only-title','--as','user','--query','项目复盘']));
});

test('the installed CLI projects official string doc_types using only an offline synthetic dry-run',async()=>{
 const envelope={ok:true,data:{has_more:false,results:[{title_highlighted:'<hb>TEST</hb> Plan',result_meta:{doc_types:'DOCX',update_time:1790856000,url:'https://test.feishu.cn/docx/TEST',token:'TEST-document',owner_id:'NEVER EXPOSE',summary_highlighted:'NEVER READ'},summary_highlighted:'NEVER READ'}]}};
 const {stdout}=await promisify(execFile)('lark-cli',['drive','+search','--query','F2 TEST','--only-title','--as','user','--dry-run','--json','--jq',JSON.stringify(envelope)+' | '+feishuMetadataProjection],{encoding:'utf8',timeout:10000});
 expect(JSON.parse(stdout)).toEqual({ok:true,data:{has_more:false,results:[{documentId:'TEST-document',title:'<hb>TEST</hb> Plan',type:'DOCX',updatedAt:1790856000,url:'https://test.feishu.cn/docx/TEST'}]}});expect(stdout).not.toMatch(/NEVER EXPOSE|NEVER READ|owner_id|summary/);
});

test('a duplicated human search has one attempt, opaque refs and no raw identity or content fields',async()=>{
 const searchDocuments=vi.fn(async()=>({hasMore:false,items:[{documentId:'private-file-token',title:'TEST Review',type:'docx' as const,updatedAt:null,url:null,body:'NEVER RETURN',token:'NEVER RETURN'}]}));
 const discovery=createFeishuDiscovery({getConnectionStatus:async()=>({provider:'feishu',state:'connected'}),searchDocuments});
 const input={searchId:randomUUID(),query:'Review'},one=await discovery.searchDocuments(input),two=await discovery.searchDocuments(input);
 expect(one).toEqual(two);expect(searchDocuments).toHaveBeenCalledTimes(1);expect(one.kind).toBe('results');
 if(one.kind!=='results')throw Error();expect(Object.keys(one.items[0]!)).toEqual(['ref','title','type','updatedAt','url']);expect(one.items[0]?.ref).toMatch(/^[a-f0-9-]{36}$/);expect(JSON.stringify(one)).not.toMatch(/private-file-token|NEVER RETURN|body|token/);
});

test('empty, overlong or extra input is rejected locally; disconnected user cannot search',async()=>{
 const searchDocuments=vi.fn(async()=>({hasMore:false,items:[]})),discovery=createFeishuDiscovery({getConnectionStatus:async()=>({provider:'feishu',state:'reauthorization_required'}),searchDocuments});
 for(const input of [{searchId:randomUUID(),query:''},{searchId:randomUUID(),query:'文'.repeat(31)},{searchId:randomUUID(),query:'TEST',path:'/documents/body'}])expect(await discovery.searchDocuments(input)).toEqual({kind:'failure',reason:'invalid_request'});
 expect(await discovery.searchDocuments({searchId:randomUUID(),query:'TEST'})).toEqual({kind:'failure',reason:'reauthorization_required'});expect(searchDocuments).not.toHaveBeenCalled();
});

test('zero results and failed requests are not automatically retried or replaced with a different search',async()=>{
 const searchDocuments=vi.fn(async()=>({hasMore:false,items:[]})),discovery=createFeishuDiscovery({getConnectionStatus:async()=>({provider:'feishu',state:'connected'}),searchDocuments});
 expect(await discovery.searchDocuments({searchId:randomUUID(),query:'TEST'})).toEqual({kind:'results',items:[],hasMore:false});
 searchDocuments.mockRejectedValueOnce(Error('PRIVATE RESPONSE'));
 const input={searchId:randomUUID(),query:'TEST failure'};
 expect(await discovery.searchDocuments(input)).toEqual({kind:'failure',reason:'search_failed'});expect(await discovery.searchDocuments(input)).toEqual({kind:'failure',reason:'search_failed'});expect(searchDocuments).toHaveBeenCalledTimes(2);
});

test('search projection rejects unsolicited body fields and sanitizes metadata time and URL without a follow-up request',async()=>{
 const run=vi.fn(async()=>({code:0,stdout:JSON.stringify({ok:true,data:{has_more:false,results:[{documentId:'TEST',title:'<hb>TEST</hb> Review',type:'SHEET',updatedAt:1790856000,url:'https://test.feishu.cn/sheets/TEST'}]}})}));
 const ports=createLarkCliDiscoveryPorts(run),result=await ports.searchDocuments('TEST');expect(result.items[0]).toMatchObject({title:'TEST Review',type:'sheet',updatedAt:'2026-10-01T12:00:00.000Z'});
 run.mockResolvedValueOnce({code:0,stdout:JSON.stringify({ok:true,data:{has_more:false,results:[{documentId:'TEST',title:'TEST',type:'DOCX',updatedAt:null,url:null,summary:'FORBIDDEN CONTENT'}]}})});
 await expect(ports.searchDocuments('TEST')).rejects.toThrow();expect(run).toHaveBeenCalledTimes(2);
});

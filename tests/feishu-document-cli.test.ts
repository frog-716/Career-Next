import {test,expect,vi} from 'vitest';
import {createLarkCliDocumentPorts} from '../packages/backend/platform/connectors/feishu/document-cli';
test('document reader adapter only issues bounded user GET metadata and version-pinned blocks',async()=>{
 const run=vi.fn(async(args:string[])=>({code:0,stdout:JSON.stringify(args[2]?.endsWith('/blocks')?{ok:true,data:{items:[{id:'TESTblock',parentId:'TESTDocumentToken12345',type:2,children:[],text:'TEST text'}],hasMore:false,pageToken:null}}:{ok:true,data:{documentToken:'TESTDocumentToken12345',title:'TEST title',revision:4}})}));
 const ports=createLarkCliDocumentPorts(run),signal=new AbortController().signal;
 expect(await ports.readMetadata('TESTDocumentToken12345',signal)).toEqual({documentToken:'TESTDocumentToken12345',title:'TEST title',revision:4});
 expect(await ports.readBlocks('TESTDocumentToken12345',4,undefined,signal)).toMatchObject({hasMore:false,items:[{text:'TEST text'}]});
 const args=run.mock.calls[1]![0];expect(args.slice(0,4)).toEqual(['api','GET','/open-apis/docx/v1/documents/TESTDocumentToken12345/blocks','--params']);expect(args.join(' ')).toContain('"document_revision_id":4');expect(args.join(' ')).toContain('"page_size":100');expect(args.join(' ')).toContain('--as user');expect(args.join(' ')).not.toMatch(/page-all|output|raw_content|POST|PATCH/);
});
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {documentProjections} from '../packages/backend/platform/connectors/feishu/document-cli';
test('offline CLI projection preserves plain text and drops metadata, credentials, URLs and linked/media payloads',async()=>{
 const token='TESTDocumentToken12345',data={items:[{block_id:token,parent_id:'',block_type:1,children:['TESTtext','TESTimage']},{block_id:'TESTtext',parent_id:token,block_type:2,text:{elements:[{text_run:{content:'TEST plain',text_element_style:{link:{url:'PRIVATE_URL'}}}},{mention_user:{user_id:'PRIVATE_USER'}},{mention_doc:{token:'PRIVATE_DOCUMENT',url:'PRIVATE_LINK'}}]}},{block_id:'TESTimage',parent_id:token,block_type:27,image:{token:'PRIVATE_IMAGE',width:2}}],has_more:false};
 const {stdout}=await promisify(execFile)('/usr/bin/jq',['-n',JSON.stringify({ok:true,data})+' | '+documentProjections.blocks],{encoding:'utf8',timeout:10000,env:{...process.env,LARKSUITE_CLI_NO_UPDATE_NOTIFIER:'1',LARKSUITE_CLI_NO_SKILLS_NOTIFIER:'1'}});
 expect(stdout).not.toMatch(/PRIVATE|user_id|url|Authorization/);expect(JSON.parse(stdout)).toMatchObject({ok:true,data:{hasMore:false,items:[{type:1,text:''},{type:2,text:'TEST plain[提及用户未展开][关联文档未展开]'},{type:27,text:''}]}});
});
test('invalid source, envelope failure and permission failures return controlled failure without retry',async()=>{
 const signal=new AbortController().signal,run=vi.fn(async()=>({code:1,stdout:'PRIVATE RAW',failure:'permission' as const}));await expect(createLarkCliDocumentPorts(run).readMetadata('TESTDocumentToken12345',signal)).rejects.toThrow('feishu_document_permission_required');expect(run).toHaveBeenCalledTimes(1);
 await expect(createLarkCliDocumentPorts(run).readMetadata('../secrets',signal)).rejects.toThrow();expect(run).toHaveBeenCalledTimes(1);
 const malformed=async()=>({code:0,stdout:'{"ok":false,"data":{}}'});await expect(createLarkCliDocumentPorts(malformed).readMetadata('TESTDocumentToken12345',signal)).rejects.toThrow('feishu_document_response_invalid');
 const cancelled=new AbortController();cancelled.abort();await expect(createLarkCliDocumentPorts(run).readMetadata('TESTDocumentToken12345',cancelled.signal)).rejects.toThrow();expect(run).toHaveBeenCalledTimes(1);
});
test('official todo style.done survives projection as true, false and unavailable without any CLI call',async()=>{
 const token='TESTDocumentToken12345',raw={ok:true,data:{has_more:false,items:[{block_id:'a',parent_id:token,block_type:17,todo:{style:{done:true},elements:[{text_run:{content:'TEST done'}}]}},{block_id:'b',parent_id:token,block_type:17,todo:{style:{done:false},elements:[]}},{block_id:'c',parent_id:token,block_type:17,todo:{elements:[]}}]}};
 const projected=await promisify(execFile)('/usr/bin/jq',['-n',JSON.stringify(raw)+' | '+documentProjections.blocks],{encoding:'utf8'}),run=vi.fn(async()=>({code:0,stdout:projected.stdout}));const result=await createLarkCliDocumentPorts(run).readBlocks(token,1,undefined,new AbortController().signal);expect(result.items).toMatchObject([{done:true},{done:false},{done:null}]);
});

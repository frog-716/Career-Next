import {test,expect,vi} from 'vitest';
import {createLarkCliRecordPreviewPorts,bitableRecordProjection} from '../packages/backend/platform/connectors/feishu/lark-cli';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
test('one fixed user read uses view + page-size 5, offset zero and never fetches or saves another page',async()=>{
 const run=vi.fn(async(_args:string[])=>({code:0,stdout:JSON.stringify({ok:true,data:{columns:[{name:'TEST Title',type:'text'}],rows:[[{kind:'text',value:'TEST'}]],hasMore:true}})}));
 const result=await createLarkCliRecordPreviewPorts(run).readRecords('TESTBitableIdentity12345','tblTEST','vewTEST');expect(result.hasMore).toBe(true);expect(run).toHaveBeenCalledTimes(1);expect(run.mock.calls[0]![0]).toEqual(['base','+record-list','--base-token','TESTBitableIdentity12345','--table-id','tblTEST','--view-id','vewTEST','--limit','5','--offset','0','--as','user','--json','--jq',bitableRecordProjection]);expect(run.mock.calls[0]![0].join(' ')).not.toMatch(/page-all|page-token|output|ndjson/);
});
test('offline projection preserves simple cells but removes attachment, link, user and formula payloads',async()=>{
 const data={fields:['TEST Title','TEST Number','TEST Date','TEST Choice','TEST Attachment','TEST Linked','TEST User','TEST Formula','TEST Rich'],field_type_list:['text','number','created_at','select','attachment','link','user','formula','text'],data:[['TEST',4,'2026-01-01T00:00:00Z',['TEST Option'],[{file_token:'PRIVATE_FILE',name:'PRIVATE_IMAGE'}],[{id:'PRIVATE_LINK'}],[{id:'PRIVATE_USER',name:'PRIVATE_NAME'}],'PRIVATE_FORMULA',[{text:'PRIVATE_RICH'}]]],record_id_list:['PRIVATE_RECORD'],has_more:true};
 const {stdout}=await promisify(execFile)('lark-cli',['base','+record-list','--base-token','TESTBitableIdentity12345','--table-id','tblTEST','--view-id','vewTEST','--limit','5','--as','user','--dry-run','--json','--jq',JSON.stringify({ok:true,data})+' | '+bitableRecordProjection],{encoding:'utf8',timeout:10000});
 const result=JSON.parse(stdout);expect(result.data.rows[0]).toEqual([{kind:'text',value:'TEST'},{kind:'number',value:4},{kind:'date',value:'2026-01-01T00:00:00Z'},{kind:'choice',value:['TEST Option']},{kind:'summary',category:'attachment',count:1,present:true},{kind:'summary',category:'linked_record',count:1,present:true},{kind:'summary',category:'user',present:true},{kind:'summary',category:'formula',present:true},{kind:'summary',category:'rich_content',present:true}]);expect(stdout).not.toMatch(/PRIVATE|record_id|file_token|open_id|Authorization/);
});
test('permission, expired auth and parse failures never echo stdout or retry',async()=>{
 const run=vi.fn(async()=>({code:1,stdout:'PRIVATE',failure:'permission' as const}));await expect(createLarkCliRecordPreviewPorts(run).readRecords('TESTBitableIdentity12345','tblTEST','vewTEST')).rejects.toThrow('feishu_record_permission_required');expect(run).toHaveBeenCalledTimes(1);
});

import {test,expect,vi} from 'vitest';
import {createLarkCliBitablePorts,bitableProjections} from '../packages/backend/platform/connectors/feishu/lark-cli';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
test('fixed user CLI operations project only table/view names and field types, never record/formula/attachment data',async()=>{
 const run=vi.fn(async(args:string[])=>({code:0,stdout:JSON.stringify({ok:true,data:args.includes('+table-list')?{total:1,tables:[{id:'tblTEST',name:'TEST Table'}]}:args.includes('+view-list')?{total:1,views:[{id:'vewTEST',name:'TEST All',type:'grid'}]}:{total:2,fields:[{name:'TEST Title',type:'text'},{name:'TEST Formula',type:'formula'}]}})}));
 const ports=createLarkCliBitablePorts(run);
 expect(await ports.listTables('TESTBitableIdentity12345')).toEqual({items:[{id:'tblTEST',name:'TEST Table'}],hasMore:false});
 expect(await ports.listViews('TESTBitableIdentity12345','tblTEST')).toEqual({items:[{id:'vewTEST',name:'TEST All',type:'grid'}],hasMore:false});
 expect(await ports.listFields('TESTBitableIdentity12345','tblTEST')).toEqual({items:[{name:'TEST Title',type:'text'},{name:'TEST Formula',type:'formula'}],hasMore:false});
 expect(run.mock.calls.map(x=>x[0][1])).toEqual(['+table-list','+view-list','+field-list']);
 for(const [args]of run.mock.calls){expect(args).toEqual(expect.arrayContaining(['--as','user','--jq']));expect(args.join(' ')).not.toMatch(/record|comment|attachment|workflow|inspect/);}
});
test('installed CLI offline projection removes formula configuration, field options, raw context and records',async()=>{
 const envelope={ok:true,data:{total:1,fields:[{id:'fldPRIVATE',name:'TEST Formula',type:'formula',formula:'PRIVATE CONFIGURATION',options:['PRIVATE OPTION'],records:[{cell:'PRIVATE VALUE'}]}]},context:{user_open_id:'PRIVATE ID'}};
 const {stdout}=await promisify(execFile)('lark-cli',['base','+field-list','--base-token','TESTBitableIdentity12345','--table-id','tblTEST','--as','user','--dry-run','--json','--jq',JSON.stringify(envelope)+' | '+bitableProjections.fields],{encoding:'utf8',timeout:10000});
 expect(JSON.parse(stdout)).toEqual({ok:true,data:{total:1,fields:[{name:'TEST Formula',type:'formula'}]}});expect(stdout).not.toMatch(/PRIVATE|fldPRIVATE|user_open_id|records|options/);
});
test('wrong raw coordinates are rejected before CLI; permission and auth failures never retry or leak stderr',async()=>{
 const run=vi.fn(async()=>({code:1,stdout:'',failure:'permission' as const}));const ports=createLarkCliBitablePorts(run);
 await expect(ports.listViews('TESTBitableIdentity12345','wkfNO_TABLE')).rejects.toThrow('feishu_structure_reference_invalid');expect(run).not.toHaveBeenCalled();
 await expect(ports.listTables('TESTBitableIdentity12345')).rejects.toThrow('feishu_structure_permission_required');expect(run).toHaveBeenCalledTimes(1);
});

import {expect,test,vi} from 'vitest';
import {createFeishuDiscovery} from '../packages/backend/platform/connectors/feishu/discovery';
import {createFeishuBitableStructure} from '../packages/backend/platform/connectors/feishu/bitable';
const link='https://test.feishu.cn/base/TESTBitableIdentity12345?table=wkfIGNORE';
function fixture(state='connected'){
 const discovery=createFeishuDiscovery({getConnectionStatus:async()=>({provider:'feishu',state:'connected'}),searchDocuments:async()=>({hasMore:false,items:[]})});
 const selected=discovery.registerSelectedBitable({title:'TEST Bitable',url:link});
 const ports={getConnectionStatus:async()=>({provider:'feishu' as const,state:state as 'connected'}),resolveBitable:discovery.resolveBitable,
  listTables:vi.fn(async()=>({items:[{id:'tblTESTone',name:'TEST Products'},{id:'tblTESTtwo',name:'TEST Tasks'}],hasMore:false})),
  listViews:vi.fn(async()=>({items:[{id:'vewTEST',name:'TEST All',type:'grid'}],hasMore:false})),
  listFields:vi.fn(async()=>({items:[{name:'TEST Title',type:'text'},{name:'TEST Formula',type:'formula'}],hasMore:false}))};
 return{selected,ports,structure:createFeishuBitableStructure(ports)};
}
test('only registered Bitable metadata can reveal tables, then views and field schema via opaque refs',async()=>{
 const {selected,ports,structure}=fixture();const tables=await structure.listBitableTables({selectedRef:selected.ref});
 expect(tables.kind).toBe('tables');if(tables.kind!=='tables')throw Error();expect(tables.items.map(x=>x.name)).toEqual(['TEST Products','TEST Tasks']);
 expect(await structure.listBitableViews({tableRef:tables.items[0]!.ref})).toMatchObject({kind:'views',items:[{name:'TEST All',type:'grid'}]});
 expect(await structure.listBitableFields({tableRef:tables.items[0]!.ref})).toEqual({kind:'fields',items:[{name:'TEST Title',type:'text'},{name:'TEST Formula',type:'formula'}],hasMore:false});
 expect(JSON.stringify(tables)).not.toMatch(/tblTEST|TESTBitableIdentity|wkfIGNORE/);expect(ports.listTables).toHaveBeenCalledWith('TESTBitableIdentity12345');
 expect(await structure.listBitableTables({selectedRef:selected.ref})).toEqual(tables);expect(ports.listTables).toHaveBeenCalledTimes(1);
 expect(await structure.listBitableViews({tableRef:tables.items[0]!.ref})).toMatchObject({kind:'views'});expect(ports.listViews).toHaveBeenCalledTimes(1);
});
test('arbitrary IDs, foreign references and extra record parameters fail locally; disconnected identity performs no structure request',async()=>{
 const {ports,structure}=fixture('reauthorization_required');
 expect(await structure.listBitableTables({selectedRef:'tblARBITRARY'})).toEqual({kind:'failure',reason:'invalid_request'});
 expect(await structure.listBitableViews({tableRef:crypto.randomUUID()})).toEqual({kind:'failure',reason:'reference_unavailable'});
 expect(await structure.listBitableFields({tableRef:crypto.randomUUID(),recordId:'FORBIDDEN'})).toEqual({kind:'failure',reason:'invalid_request'});
 const f=fixture('reauthorization_required');expect(await f.structure.listBitableTables({selectedRef:f.selected.ref})).toEqual({kind:'failure',reason:'reauthorization_required'});
 expect(ports.listTables).not.toHaveBeenCalled();expect(f.ports.listTables).not.toHaveBeenCalled();
});
test('zero tables is a valid result; missing permission is cached without retry or body capability',async()=>{
 const {selected,ports,structure}=fixture();ports.listTables.mockResolvedValueOnce({items:[],hasMore:false});
 expect(await structure.listBitableTables({selectedRef:selected.ref})).toEqual({kind:'tables',title:'TEST Bitable',items:[],hasMore:false});
 const f=fixture();f.ports.listTables.mockRejectedValueOnce(Error('feishu_structure_permission_required'));
 expect(await f.structure.listBitableTables({selectedRef:f.selected.ref})).toEqual({kind:'failure',reason:'permission_required'});
 expect(await f.structure.listBitableTables({selectedRef:f.selected.ref})).toEqual({kind:'failure',reason:'permission_required'});expect(f.ports.listTables).toHaveBeenCalledTimes(1);
 expect(Object.keys(structure).sort()).toEqual(['listBitableFields','listBitableTables','listBitableViews','resolveView']);
});
test('a cloud document cannot be treated as a Bitable; disconnected and invalid connections make no structure calls',async()=>{
 const discovery=createFeishuDiscovery({getConnectionStatus:async()=>({provider:'feishu',state:'connected'}),searchDocuments:async()=>({hasMore:false,items:[{documentId:'TEST DOC',title:'TEST Cloud',type:'docx',updatedAt:null,url:link},{documentId:'TEST BASE',title:'TEST Base',type:'bitable',updatedAt:null,url:link}]})});
 const result=await discovery.searchDocuments({searchId:crypto.randomUUID(),query:'TEST'});if(result.kind!=='results')throw Error();expect(discovery.resolveBitable(result.items[0]!.ref)).toBeUndefined();expect(discovery.resolveBitable(result.items[1]!.ref)).toMatchObject({title:'TEST Base'});expect(result.items[1]!.url).toBeNull();expect(JSON.stringify(result.items[1])).not.toContain('TESTBitableIdentity');
 for(const state of ['not_connected','connection_invalid']){const f=fixture(state);expect(await f.structure.listBitableTables({selectedRef:f.selected.ref})).toEqual({kind:'failure',reason:state});expect(f.ports.listTables).not.toHaveBeenCalled();}
});

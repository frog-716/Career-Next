import {test,expect,vi} from 'vitest';
import {createBitableRecordPreview} from '../packages/backend/platform/connectors/feishu/record-preview';
const tableRef='11111111-1111-4111-8111-111111111111',viewRef='22222222-2222-4222-8222-222222222222';
function fixture(){const ports={getConnectionStatus:async()=>({provider:'feishu' as const,state:'connected' as const}),resolveView:(t:string,v:string)=>t===tableRef&&v===viewRef?{appToken:'TESTBitableIdentity12345',tableId:'tblTEST',viewId:'vewTEST',tableName:'TEST Table',viewName:'TEST View',bitableRef:'55555555-5555-4555-8555-555555555555',bitableTitle:'TEST Base'}:undefined,readRecords:vi.fn(async()=>({columns:[{name:'TEST Title',type:'text'}],rows:[[{kind:'text' as const,value:'TEST record'}]],hasMore:false}))};return{ports,preview:createBitableRecordPreview(ports)};}
test('confirmed opaque selection permits exactly one bounded preview; repeated and concurrent calls reuse it',async()=>{
 const {ports,preview}=fixture();expect(await preview.select({tableRef,viewRef})).toMatchObject({kind:'selection',table:{ref:tableRef},view:{ref:viewRef}});
 const results=await Promise.all([preview.preview({tableRef,viewRef,limit:5}),preview.preview({tableRef,viewRef,limit:5})]);expect(results[0]).toMatchObject({kind:'records',items:[{cells:[{kind:'text',value:'TEST record'}]}],hasMore:false});expect(results[1]).toEqual(results[0]);expect(ports.readRecords).toHaveBeenCalledTimes(1);expect(ports.readRecords).toHaveBeenCalledWith('TESTBitableIdentity12345','tblTEST','vewTEST');expect(JSON.stringify(results)).not.toMatch(/tblTEST|vewTEST|TESTBitableIdentity/);
});
test('no arbitrary coordinates, pagination, modified limit or different view can dispatch; selecting is local only',async()=>{
 const {ports,preview}=fixture();expect(await preview.preview({tableRef,viewRef,limit:5})).toMatchObject({reason:'selection_required'});await preview.select({tableRef,viewRef});
 for(const input of [{tableRef,viewRef,limit:6},{tableRef,viewRef,limit:5,pageToken:'NEXT'},{appToken:'x',tableRef,viewRef,limit:5},{tableRef,viewRef:crypto.randomUUID(),limit:5}])expect((await preview.preview(input)).kind).toBe('failure');expect(ports.readRecords).not.toHaveBeenCalled();
});
test('zero, one and five records with hasMore are valid; no next-page request or unsafe response leakage',async()=>{
 for(const count of [0,1,5]){const {ports,preview}=fixture();ports.readRecords.mockResolvedValueOnce({columns:[{name:'TEST Title',type:'text'}],rows:Array.from({length:count},()=>[{kind:'text' as const,value:'TEST'}]),hasMore:count===5});await preview.select({tableRef,viewRef});expect(await preview.preview({tableRef,viewRef,limit:5})).toMatchObject({kind:'records',items:expect.any(Array),hasMore:count===5});expect((await preview.preview({tableRef,viewRef,limit:5}) as any).items).toHaveLength(count);expect(ports.readRecords).toHaveBeenCalledTimes(1);}
});
test('permission failure is consumed without retry; revoked connection never reads; malformed values fail without echo',async()=>{
 const f=fixture();f.ports.readRecords.mockRejectedValueOnce(Error('feishu_record_permission_required'));await f.preview.select({tableRef,viewRef});expect(await f.preview.preview({tableRef,viewRef,limit:5})).toMatchObject({reason:'permission_required'});await f.preview.preview({tableRef,viewRef,limit:5});expect(f.ports.readRecords).toHaveBeenCalledTimes(1);
 const g=fixture();g.ports.getConnectionStatus=async()=>({provider:'feishu',state:'connection_invalid' as any});await g.preview.select({tableRef,viewRef});expect(await g.preview.preview({tableRef,viewRef,limit:5})).toMatchObject({reason:'connection_invalid'});expect(g.ports.readRecords).not.toHaveBeenCalled();
});

test('an oversized or malformed preview fails closed and does not permit a second target',async()=>{
 const f=fixture();await f.preview.select({tableRef,viewRef});f.ports.readRecords.mockResolvedValueOnce({columns:[{name:'TEST Title',type:'text'}],rows:Array.from({length:6},()=>[{kind:'text',value:'TEST'}]),hasMore:true});expect(await f.preview.preview({tableRef,viewRef,limit:5})).toMatchObject({reason:'preview_failed'});expect(await f.preview.select({tableRef,viewRef:crypto.randomUUID()})).toMatchObject({reason:'selection_locked'});await f.preview.preview({tableRef,viewRef,limit:5});expect(f.ports.readRecords).toHaveBeenCalledTimes(1);
});

test('record selection is cached-only and returns an immutable source snapshot without another reader call',async()=>{
 const f=fixture();expect(f.preview.getSelectedRecordMetadata()).toMatchObject({reason:'selected_snapshot_unavailable'});expect(f.preview.selectRecord({recordRef:crypto.randomUUID()})).toMatchObject({reason:'selected_snapshot_unavailable'});
 await f.preview.select({tableRef,viewRef});const page=await f.preview.preview({tableRef,viewRef,limit:5});if(page.kind!=='records')throw Error();expect(f.preview.selectRecord({recordRef:page.items[0]!.ref})).toMatchObject({kind:'selected_record',recordRef:page.items[0]!.ref});const snapshot=f.preview.readSelectedRecord();expect(snapshot).toMatchObject({recordRef:page.items[0]!.ref,source:{tableRef,viewRef},cells:[{kind:'text',value:'TEST record'}]});snapshot!.cells[0]={kind:'text',value:'MUTATED'};expect(f.preview.readSelectedRecord()!.cells[0]).toEqual({kind:'text',value:'TEST record'});expect(f.ports.readRecords).toHaveBeenCalledTimes(1);
});

test('disposing a record session removes selected records and rejects an in-flight late page',async()=>{
 const f=fixture();await f.preview.select({tableRef,viewRef});
 let release!:()=>void;let reached!:()=>void;const waiting=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{reached=resolve;});
 f.ports.readRecords.mockImplementationOnce(async()=>{reached();await waiting;return {columns:[{name:'TEST Title',type:'text'}],rows:[[{kind:'text',value:'TEST stale record'}]],hasMore:false};});
 const reading=f.preview.preview({tableRef,viewRef,limit:5});await started;f.preview.dispose();release();
 expect(await reading).toEqual({kind:'failure',reason:'reference_unavailable'});expect(f.preview.readSelectedRecord()).toBeUndefined();expect(f.preview.getSelectedRecordMetadata()).toMatchObject({reason:'selected_snapshot_unavailable'});
 await f.preview.select({tableRef,viewRef});const fresh=await f.preview.preview({tableRef,viewRef,limit:5});if(fresh.kind!=='records')throw Error();f.preview.selectRecord({recordRef:fresh.items[0]!.ref});const snapshot=f.preview.readSelectedRecord()!;
 const restored=createBitableRecordPreview(f.ports,snapshot);restored.dispose();expect(restored.selectRecord({recordRef:snapshot.recordRef})).toMatchObject({reason:'selected_snapshot_unavailable'});expect(restored.readSelectedRecord()).toBeUndefined();
});

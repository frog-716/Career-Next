import {randomUUID} from 'node:crypto';
import {BitableTablesRequest,BitableTableRequest,BitableTablesResult,BitableViewsResult,BitableFieldsResult,type BitableFailure} from '../../../../contracts/platform/feishu-bitable';
import type {FeishuConnectionStatus} from './connector';

export type StructurePage<T>={items:T[];hasMore:boolean};
export type FeishuBitableReadPorts={
 listTables(appToken:string):Promise<StructurePage<{id:string;name:string}>>;
 listViews(appToken:string,tableId:string):Promise<StructurePage<{id:string;name:string;type:string}>>;
 listFields(appToken:string,tableId:string):Promise<StructurePage<{name:string;type:string}>>;
};
export type FeishuBitablePorts=FeishuBitableReadPorts&{
 getConnectionStatus():Promise<FeishuConnectionStatus>;
 resolveBitable(ref:string):{appToken:string;title:string}|undefined;
};
const failed=(reason:BitableFailure['reason']):BitableFailure=>({kind:'failure',reason});
/** Session-only structure capability. No record port, business DB or raw ID input. */
export function createFeishuBitableStructure(ports:FeishuBitablePorts){
 let generation=0;
 const views=new Map<string,{tableRef:string;viewId:string;viewName:string}>();
 const tables=new Map<string,{appToken:string;tableId:string;tableName:string;bitableRef:string;bitableTitle:string}>(),tableResults=new Map<string,Promise<BitableTablesResult>>(),viewResults=new Map<string,Promise<BitableViewsResult>>(),fieldResults=new Map<string,Promise<BitableFieldsResult>>();
 async function status(){try{const s=await ports.getConnectionStatus();return s.state==='connected'?undefined:failed(s.state);}catch{return failed('connection_invalid');}}
 async function attempt<T>(work:()=>Promise<T>):Promise<T|BitableFailure>{try{return await work();}catch(error){const reason=error instanceof Error?error.message:'';return failed(reason==='feishu_structure_permission_required'?'permission_required':reason==='feishu_authorization_required'?'reauthorization_required':'structure_failed');}}
 return {
  dispose(){generation++;views.clear();tables.clear();tableResults.clear();viewResults.clear();fieldResults.clear();},
  resolveView(tableRef:string,viewRef:string){const table=tables.get(tableRef),view=views.get(viewRef);return table&&view&&view.tableRef===tableRef?{...table,viewId:view.viewId,viewName:view.viewName}:undefined;},
  async listBitableTables(input:unknown):Promise<BitableTablesResult>{
   const request=BitableTablesRequest.safeParse(input);if(!request.success)return failed('invalid_request');const started=generation;const selected=ports.resolveBitable(request.data.selectedRef);if(!selected)return failed('reference_unavailable');const unavailable=await status();if(started!==generation)return failed('reference_unavailable');if(unavailable)return unavailable;
   const key=request.data.selectedRef;if(tableResults.has(key))return tableResults.get(key)!;
   const result=attempt(async()=>{const page=await ports.listTables(selected.appToken);if(started!==generation)return failed('reference_unavailable');const refs=page.items.map(item=>({ref:randomUUID(),name:item.name}));const projected=BitableTablesResult.parse({kind:'tables',title:selected.title,items:refs,hasMore:page.hasMore});if(projected.kind!=='tables')throw Error();projected.items.forEach((item,index)=>tables.set(item.ref,{appToken:selected.appToken,tableId:page.items[index]!.id,tableName:item.name,bitableRef:key,bitableTitle:selected.title}));return projected;});tableResults.set(key,result);return result;
  },
  async listBitableViews(input:unknown):Promise<BitableViewsResult>{
   const request=BitableTableRequest.safeParse(input);if(!request.success)return failed('invalid_request');const started=generation;const table=tables.get(request.data.tableRef);if(!table)return failed('reference_unavailable');const unavailable=await status();if(started!==generation)return failed('reference_unavailable');if(unavailable)return unavailable;
   const key=request.data.tableRef;if(viewResults.has(key))return viewResults.get(key)!;
   const result=attempt(async()=>{const page=await ports.listViews(table.appToken,table.tableId);if(started!==generation)return failed('reference_unavailable');const projected=BitableViewsResult.parse({kind:'views',items:page.items.map(item=>({ref:randomUUID(),name:item.name,type:item.type})),hasMore:page.hasMore});if(projected.kind==='views')projected.items.forEach((item,index)=>views.set(item.ref,{tableRef:key,viewId:page.items[index]!.id,viewName:item.name}));return projected;});viewResults.set(key,result);return result;
  },
  async listBitableFields(input:unknown):Promise<BitableFieldsResult>{
   const request=BitableTableRequest.safeParse(input);if(!request.success)return failed('invalid_request');const started=generation;const table=tables.get(request.data.tableRef);if(!table)return failed('reference_unavailable');const unavailable=await status();if(started!==generation)return failed('reference_unavailable');if(unavailable)return unavailable;
   const key=request.data.tableRef;if(fieldResults.has(key))return fieldResults.get(key)!;
   const result=attempt(async()=>{const page=await ports.listFields(table.appToken,table.tableId);if(started!==generation)return failed('reference_unavailable');return BitableFieldsResult.parse({kind:'fields',items:page.items.map(item=>({name:item.name,type:item.type})),hasMore:page.hasMore});});fieldResults.set(key,result);return result;
  },
 };
}

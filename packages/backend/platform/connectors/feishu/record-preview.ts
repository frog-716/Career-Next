import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {BitablePreviewSelectionRequest,BitablePreviewRequest,BitablePreviewResult,PreviewColumn,PreviewCell,type BitablePreviewSelectionResult} from '../../../../contracts/platform/feishu-bitable-preview';
import type {FeishuConnectionStatus} from './connector';
export type BitableRecordTarget={appToken:string;tableId:string;viewId:string;tableName:string;viewName:string};
export type BitableRecordPage={columns:z.infer<typeof PreviewColumn>[];rows:z.infer<typeof PreviewCell>[][];hasMore:boolean};
export type BitableRecordReadPorts={readRecords(appToken:string,tableId:string,viewId:string):Promise<BitableRecordPage>};
export type BitableRecordPreviewPorts=BitableRecordReadPorts&{getConnectionStatus():Promise<FeishuConnectionStatus>;resolveView(tableRef:string,viewRef:string):BitableRecordTarget|undefined};
const fail=(reason:Extract<BitablePreviewResult,{kind:'failure'}>['reason'])=>({kind:'failure' as const,reason});
/** One confirmed view per process/session; no next page, retry, IDs, DB or import capability. */
export function createBitableRecordPreview(ports:BitableRecordPreviewPorts){
 let selection:{tableRef:string;viewRef:string;target:BitableRecordTarget}|undefined,attempt:Promise<BitablePreviewResult>|undefined;
 return {
  async select(input:unknown):Promise<BitablePreviewSelectionResult>{
   const request=BitablePreviewSelectionRequest.safeParse(input);if(!request.success)return fail('invalid_request');
   const {tableRef,viewRef}=request.data;if(attempt&&(selection?.tableRef!==tableRef||selection.viewRef!==viewRef))return fail('selection_locked');
   const target=ports.resolveView(tableRef,viewRef);if(!target)return fail('reference_unavailable');selection={tableRef,viewRef,target};return {kind:'selection',table:{ref:tableRef,name:target.tableName},view:{ref:viewRef,name:target.viewName}};
  },
  async preview(input:unknown):Promise<BitablePreviewResult>{
   const request=BitablePreviewRequest.safeParse(input);if(!request.success)return fail('invalid_request');
   if(!selection||selection.tableRef!==request.data.tableRef||selection.viewRef!==request.data.viewRef)return fail('selection_required');
   if(attempt)return attempt;const target=selection.target;
   attempt=(async():Promise<BitablePreviewResult>=>{try{
    const status=await ports.getConnectionStatus();if(status.state!=='connected')return fail(status.state);
    const page=await ports.readRecords(target.appToken,target.tableId,target.viewId);
    const parsed=BitablePreviewResult.parse({kind:'records',columns:page.columns,items:page.rows.map(cells=>({ref:randomUUID(),cells})),hasMore:page.hasMore});
    if(parsed.kind!=='records'||parsed.items.some(item=>item.cells.length!==parsed.columns.length))return fail('preview_failed');return parsed;
   }catch(error){const message=error instanceof Error?error.message:'';return fail(message==='feishu_record_permission_required'?'permission_required':message==='feishu_authorization_required'?'reauthorization_required':'preview_failed');}})();return attempt;
  },
 };
}

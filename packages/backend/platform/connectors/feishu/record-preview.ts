import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {BitablePreviewSelectionRequest,BitablePreviewRequest,BitablePreviewResult,PreviewColumn,PreviewCell,type BitablePreviewSelectionResult} from '../../../../contracts/platform/feishu-bitable-preview';
import {BitableRecordSelectionRequest} from '../../../../contracts/platform/feishu-bitable-raw-preview';
import {SelectedRecordSnapshot,selectedRecordMetadata} from './record-snapshot';
import type {FeishuConnectionStatus} from './connector';
export type BitableRecordTarget={appToken:string;tableId:string;viewId:string;tableName:string;viewName:string;bitableRef:string;bitableTitle:string};
export type BitableRecordPage={columns:z.infer<typeof PreviewColumn>[];rows:z.infer<typeof PreviewCell>[][];hasMore:boolean};
export type BitableRecordReadPorts={readRecords(appToken:string,tableId:string,viewId:string):Promise<BitableRecordPage>};
export type BitableRecordPreviewPorts=BitableRecordReadPorts&{getConnectionStatus():Promise<FeishuConnectionStatus>;resolveView(tableRef:string,viewRef:string):BitableRecordTarget|undefined};
const fail=(reason:Extract<BitablePreviewResult,{kind:'failure'}>['reason'])=>({kind:'failure' as const,reason});
/** One confirmed view per process/session; no next page, retry, IDs, DB or import capability. */
export function createBitableRecordPreview(ports:BitableRecordPreviewPorts,restoredSnapshot?:SelectedRecordSnapshot){
 let generation=0;
 let selection:{tableRef:string;viewRef:string;target:BitableRecordTarget}|undefined,attempt:Promise<BitablePreviewResult>|undefined;
 let cachedRecords:Extract<BitablePreviewResult,{kind:'records'}>|undefined,retrievedAt:string|undefined;let selectedSnapshot=restoredSnapshot?SelectedRecordSnapshot.parse(restoredSnapshot):undefined;
 const unavailable=()=>({kind:'failure' as const,reason:'selected_snapshot_unavailable' as const});
 return {
  invalidateRecordSnapshots(recordRefs:readonly string[],sources:readonly {tableRef:string;viewRef:string}[]=[]){const refs=new Set(recordRefs),affectedSources=[...sources];for(const snapshot of [selectedSnapshot,restoredSnapshot])if(snapshot&&refs.has(snapshot.recordRef))affectedSources.push({tableRef:snapshot.source.tableRef,viewRef:snapshot.source.viewRef});if(selectedSnapshot&&refs.has(selectedSnapshot.recordRef))selectedSnapshot=undefined;if(restoredSnapshot&&refs.has(restoredSnapshot.recordRef))restoredSnapshot=undefined;if(cachedRecords){cachedRecords={...cachedRecords,items:cachedRecords.items.filter(item=>!refs.has(item.ref))};attempt=Promise.resolve(structuredClone(cachedRecords));}else if(selection&&affectedSources.some(source=>source.tableRef===selection!.tableRef&&source.viewRef===selection!.viewRef)){generation++;attempt=Promise.resolve(fail('reference_unavailable'));}return {recordRefs:[...refs]};},
  dispose(){const recordRefs=[...new Set([...(cachedRecords?.items.map(item=>item.ref)??[]),selectedSnapshot?.recordRef,restoredSnapshot?.recordRef].filter((ref):ref is string=>!!ref))];generation++;selection=undefined;attempt=undefined;cachedRecords=undefined;retrievedAt=undefined;selectedSnapshot=undefined;restoredSnapshot=undefined;return {recordRefs};},
  readSelectedRecord(){return selectedSnapshot?structuredClone(selectedSnapshot):undefined;},
  getSelectedRecordMetadata(){return selectedSnapshot?selectedRecordMetadata(selectedSnapshot):unavailable();},
  selectRecord(input:unknown){
   const request=BitableRecordSelectionRequest.safeParse(input);if(!request.success)return {kind:'failure' as const,reason:'invalid_request' as const};
   if(restoredSnapshot&&request.data.recordRef===selectedSnapshot?.recordRef)return selectedRecordMetadata(selectedSnapshot);
   const item=cachedRecords?.items.find(r=>r.ref===request.data.recordRef);if(!item||!selection||!retrievedAt)return unavailable();
   const t=selection.target;selectedSnapshot=SelectedRecordSnapshot.parse({source:{bitableRef:t.bitableRef,bitableTitle:t.bitableTitle,tableRef:selection.tableRef,tableName:t.tableName,viewRef:selection.viewRef,viewName:t.viewName},recordRef:item.ref,columns:cachedRecords!.columns,cells:item.cells,retrievedAt,selectedAt:new Date().toISOString(),upstreamUpdatedAt:null});return selectedRecordMetadata(selectedSnapshot);
  },
  async select(input:unknown):Promise<BitablePreviewSelectionResult>{
   const request=BitablePreviewSelectionRequest.safeParse(input);if(!request.success)return fail('invalid_request');
   const {tableRef,viewRef}=request.data;if(attempt&&(selection?.tableRef!==tableRef||selection.viewRef!==viewRef))return fail('selection_locked');
   const target=ports.resolveView(tableRef,viewRef);if(!target)return fail('reference_unavailable');selection={tableRef,viewRef,target};return {kind:'selection',table:{ref:tableRef,name:target.tableName},view:{ref:viewRef,name:target.viewName}};
  },
  async preview(input:unknown):Promise<BitablePreviewResult>{
   const request=BitablePreviewRequest.safeParse(input);if(!request.success)return fail('invalid_request');
   if(!selection||selection.tableRef!==request.data.tableRef||selection.viewRef!==request.data.viewRef)return fail('selection_required');
   if(attempt)return attempt;const target=selection.target,started=generation;
   attempt=(async():Promise<BitablePreviewResult>=>{try{
    const status=await ports.getConnectionStatus();if(started!==generation)return fail('reference_unavailable');if(status.state!=='connected')return fail(status.state);
    const page=await ports.readRecords(target.appToken,target.tableId,target.viewId);
    if(started!==generation)return fail('reference_unavailable');
    const parsed=BitablePreviewResult.parse({kind:'records',columns:page.columns,items:page.rows.map(cells=>({ref:randomUUID(),cells})),hasMore:page.hasMore});
    if(parsed.kind!=='records'||parsed.items.some(item=>item.cells.length!==parsed.columns.length))return fail('preview_failed');cachedRecords=structuredClone(parsed);retrievedAt=new Date().toISOString();return parsed;
   }catch(error){if(started!==generation)return fail('reference_unavailable');const message=error instanceof Error?error.message:'';return fail(message==='feishu_record_permission_required'?'permission_required':message==='feishu_authorization_required'?'reauthorization_required':'preview_failed');}})();return attempt;
  },
 };
}

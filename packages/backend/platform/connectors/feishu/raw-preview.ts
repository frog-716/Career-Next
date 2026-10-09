import {createHash,randomUUID} from 'node:crypto';
import {BitableRecordSelectionRequest,BitableRawPreview,BitableRawPreviewRefRequest,BitableRawPreviewReadyRequest,type BitableRawPreviewResult,type BitableRawPreview as Preview,type IncludedField,type ExcludedComplexField,type IgnoredField} from '../../../../contracts/platform/feishu-bitable-raw-preview';
import {SelectedRecordSnapshot,selectedRecordMetadata} from './record-snapshot';
import {z} from 'zod';
const fail=(reason:'invalid_request'|'selected_snapshot_unavailable'|'preview_unavailable')=>({kind:'failure' as const,reason});
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const technical=new Set(['token','accesstoken','refreshtoken','authorization','openid','apptoken','tableid','viewid','recordid','opaqueref','apiendpoint','connectorstatus']);
/** A pure local converter over one selected, already-read snapshot. No external, DB or Raw owner ports. */
export function createBitableRawPreview(ports:{readSelectedRecord():unknown},restoredPreview?:Preview){
 let cached:{snapshotHash:string;preview:Preview}|undefined;
 const previewSources=new Map<string,{recordRef:string;tableRef:string;viewRef:string}>(),savedMaterials=new Map<string,{recordRef:string;tableRef:string;viewRef:string}>(),revokedRecords=new Set<string>();
 const remember=(preview:Preview)=>previewSources.set(preview.ref,{recordRef:preview.provenance.record_ref,tableRef:preview.source.tableRef,viewRef:preview.source.viewRef});
 // Trusted volatile host handoff only. It is never accepted from a Browser DTO or persisted as a cache.
 let restored=restoredPreview?BitableRawPreview.parse(structuredClone(restoredPreview)):undefined;
 if(restored){const {preview_digest,...provenance}=restored.provenance;if(hash({text:restored.text,provenance})!==preview_digest||restored.source.bitableRef!==provenance.bitable_ref||restored.source.tableRef!==provenance.table_ref||restored.source.viewRef!==provenance.view_ref||JSON.stringify(restored.includedFields)!==JSON.stringify(provenance.included_fields)||JSON.stringify(restored.excludedComplexFields)!==JSON.stringify(provenance.excluded_complex_fields))throw Error('invalid_preview_handoff');remember(restored);}
 function current(){try{const parsed=SelectedRecordSnapshot.safeParse(ports.readSelectedRecord());return parsed.success&&!revokedRecords.has(parsed.data.recordRef)?parsed.data:undefined;}catch{return;}}
 function sameCurrent(){const snapshot=current();return snapshot&&cached&&hash(snapshot)===cached.snapshotHash?snapshot:undefined;}
 function resolve(input:unknown){const request=BitableRawPreviewReadyRequest.safeParse(input);if(!request.success)return;const preview=sameCurrent()?cached?.preview:!current()?restored:undefined;return preview&&preview.ref===request.data.previewRef&&preview.provenance.preview_digest===request.data.previewDigest?structuredClone(preview):undefined;}
 return {
  bindSavedMaterial(previewRef:string,materialId:string){const source=previewSources.get(previewRef);if(!source||revokedRecords.has(source.recordRef)||!z.uuid().safeParse(materialId).success)return false;savedMaterials.set(materialId,source);return true;},
  purgeSavedMaterials(materialIds:readonly string[]){const trackedMaterialIds=[...new Set(materialIds)].filter(id=>savedMaterials.has(id)),matched=trackedMaterialIds.map(id=>savedMaterials.get(id)!),recordRefs=[...new Set(matched.map(source=>source.recordRef))],records=new Set(recordRefs),invalidatedPreviewRefs:string[]=[];for(const ref of recordRefs)revokedRecords.add(ref);if(cached&&records.has(cached.preview.provenance.record_ref)){invalidatedPreviewRefs.push(cached.preview.ref);cached=undefined;}if(restored&&records.has(restored.provenance.record_ref)){invalidatedPreviewRefs.push(restored.ref);restored=undefined;}const sources=[...new Map(matched.map(source=>[source.tableRef+'/'+source.viewRef,{tableRef:source.tableRef,viewRef:source.viewRef}])).values()];return {trackedMaterialIds,invalidatedPreviewRefs:[...new Set(invalidatedPreviewRefs)],recordRefs,sources};},
  dispose(){const invalidatedPreviewRefs=[...new Set([cached?.preview.ref,restored?.ref].filter((ref):ref is string=>!!ref))];cached=undefined;restored=undefined;previewSources.clear();savedMaterials.clear();return {invalidatedPreviewRefs};},
  resolveForImport:resolve,
  restoredMetadata(){return !current()&&restored?{kind:'selected_record' as const,recordRef:restored.provenance.record_ref,source:structuredClone(restored.source),title:restored.title}:undefined;},
  prepare(input:unknown):BitableRawPreviewResult{
   const request=BitableRecordSelectionRequest.safeParse(input);if(!request.success)return fail('invalid_request');const snapshot=current();if(!snapshot){return restored&&restored.provenance.record_ref===request.data.recordRef?structuredClone(restored):fail('selected_snapshot_unavailable');}if(snapshot.recordRef!==request.data.recordRef)return fail('selected_snapshot_unavailable');restored=undefined;
   const snapshotHash=hash(snapshot);if(cached?.snapshotHash===snapshotHash)return structuredClone(cached.preview);
   const included:z.infer<typeof IncludedField>[]=[],excluded:z.infer<typeof ExcludedComplexField>[]=[],ignored:z.infer<typeof IgnoredField>[]=[],lines:string[]=[];
   snapshot.columns.forEach((column,index)=>{const cell=snapshot.cells[index]!;const label=column.name;
    if(technical.has(label.toLowerCase().replace(/[\s_-]/g,''))){ignored.push({name:label,reason:'technical_field'});return;}
    let value:string|undefined,mode:'value'|'count_placeholder'='value';
    if(cell.kind==='empty'||cell.kind==='text'&&!cell.value.trim()||cell.kind==='choice'&&cell.value.length===0){ignored.push({name:label,reason:'empty'});return;}
    if(cell.kind==='text')value=cell.value;else if(cell.kind==='number')value=String(cell.value);else if(cell.kind==='choice')value=cell.value.join('、');else if(cell.kind==='boolean')value=cell.value?'是':'否';else if(cell.kind==='date'){const date=new Date(cell.value);value=Number.isNaN(date.getTime())?String(cell.value):date.toISOString();}
    else if(cell.kind==='summary'){
     if(cell.category==='attachment'||cell.category==='linked_record'){mode='count_placeholder';const attachment=cell.category==='attachment';value=(attachment?'附件：':'关联记录：')+(cell.count!==undefined?cell.count+(attachment?' 个':' 项'):cell.present?'已设置':'未设置')+(attachment?'（未读取）':'（未展开）');excluded.push({name:label,type:column.type,reason:attachment?'content_not_read':'not_expanded'});}
     else{const reason=['user','formula','lookup'].includes(cell.category)?'display_not_available' as const:'unsupported' as const;excluded.push({name:label,type:column.type,reason});ignored.push({name:label,reason});return;}
    }
    if(value===undefined){ignored.push({name:label,reason:'unsupported'});return;}included.push({name:label,type:column.type,mode});lines.push(label+'：'+value);
   });
   const text=['来源：飞书多维表格','多维表格：'+snapshot.source.bitableTitle,'表：'+snapshot.source.tableName,'视图：'+snapshot.source.viewName,'',...lines].join('\n');
   const provenance={source_type:'feishu_bitable_record' as const,bitable_ref:snapshot.source.bitableRef,table_ref:snapshot.source.tableRef,view_ref:snapshot.source.viewRef,record_ref:snapshot.recordRef,selected_at:snapshot.selectedAt,retrieved_at:snapshot.retrievedAt,upstream_updated_at:snapshot.upstreamUpdatedAt,included_fields:included,excluded_complex_fields:excluded};
   const preview=BitableRawPreview.parse({kind:'raw_preview',ref:randomUUID(),source:snapshot.source,title:selectedRecordMetadata(snapshot).title,text,includedFields:included,excludedComplexFields:excluded,ignoredFields:ignored,provenance:{...provenance,preview_digest:hash({text,provenance})}});remember(preview);cached={snapshotHash,preview};return structuredClone(preview);
  },
  cancel(input:unknown){const request=BitableRawPreviewRefRequest.safeParse(input);if(!request.success)return fail('invalid_request');if(request.data.previewRef!==cached?.preview.ref&&request.data.previewRef!==restored?.ref)return fail('preview_unavailable');cached=undefined;restored=undefined;return {kind:'cancelled' as const};},
  ready(input:unknown){const request=BitableRawPreviewReadyRequest.safeParse(input);if(!request.success)return fail('invalid_request');const preview=resolve(request.data);if(!preview)return fail(!current()&&!restored?'selected_snapshot_unavailable':'preview_unavailable');return {kind:'ready_for_import_confirmation' as const,previewRef:preview.ref,previewDigest:preview.provenance.preview_digest};},
 };
}

import {z} from 'zod';
import {BitableRecordSource,SelectedBitableRecordMetadata} from '../../../../contracts/platform/feishu-bitable-raw-preview';
import {PreviewColumn,PreviewCell} from '../../../../contracts/platform/feishu-bitable-preview';
export const SelectedRecordSnapshot=z.strictObject({source:BitableRecordSource,recordRef:z.uuid(),columns:z.array(PreviewColumn).max(64),cells:z.array(PreviewCell).max(64),retrievedAt:z.iso.datetime().nullable(),selectedAt:z.iso.datetime(),upstreamUpdatedAt:z.iso.datetime().nullable()}).refine(s=>s.columns.length===s.cells.length);
export type SelectedRecordSnapshot=z.infer<typeof SelectedRecordSnapshot>;
export function selectedRecordMetadata(snapshot:SelectedRecordSnapshot){
 const preferred=snapshot.columns.findIndex(c=>c.name==='任务名称'&&c.type==='text'),first=snapshot.columns.findIndex(c=>c.type==='text');const cell=snapshot.cells[preferred>=0?preferred:first];
 return SelectedBitableRecordMetadata.parse({kind:'selected_record',recordRef:snapshot.recordRef,source:snapshot.source,title:cell?.kind==='text'&&cell.value.trim()?cell.value:'已选择的记录'});
}

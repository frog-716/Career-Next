import {useRef,useState,useEffect} from 'react';
import {BitableRawImportPreview} from './BitableRawImportPreview';
import {SelectedBitableRecordResult,type SelectedBitableRecordMetadata} from '../../../contracts/platform/feishu-bitable-raw-preview';
import {BitableRecordPreview} from './BitableRecordPreview';
import {BitableTablesResult,BitableViewsResult,BitableFieldsResult,type FeishuBitableBridge,type BitableFailure} from '../../../contracts/platform/feishu-bitable';
import type {FeishuDocumentMetadata} from '../../../contracts/platform/feishu-discovery';
import {useFeishuCacheEviction} from './feishu-cache-eviction';
type Table=Extract<BitableTablesResult,{kind:'tables'}>['items'][number];
type Views=Extract<BitableViewsResult,{kind:'views'}>['items'];
type Fields=Extract<BitableFieldsResult,{kind:'fields'}>['items'];
const errors:Record<BitableFailure['reason'],string>={invalid_request:'结构请求无效，未读取资料。',reference_unavailable:'这次资料选择已失效，请重新指定同一份多维表格。',not_connected:'请先连接飞书。',connection_invalid:'飞书连接暂不可用，请到设置检查连接。',reauthorization_required:'飞书授权已失效，请先重新授权。',permission_required:'读取表格结构需要只读权限，请先检查飞书授权。',structure_failed:'这次结构读取没有完成，没有自动重试。'};
const fieldTypes:Record<string,string>={text:'文本',number:'数字',select:'选择',single_select:'单选',multi_select:'多选',datetime:'日期',date:'日期',checkbox:'复选框',user:'人员',url:'链接',attachment:'附件',formula:'公式',lookup:'查找引用',link:'关联',button:'按钮',created_at:'创建时间',updated_at:'更新时间',auto_number:'自动编号'};
export function BitableStructurePicker({selected,bridge=window.careerFeishuBitable}:{selected:FeishuDocumentMetadata;bridge?:FeishuBitableBridge}){
 const [tables,setTables]=useState<Table[]>([]),[details,setDetails]=useState<Record<string,{views:Views;fields:Fields;hasMore:boolean}>>({}),[table,setTable]=useState<Table>(),[view,setView]=useState<Views[number]>(),[busy,setBusy]=useState(false),[attempted,setAttempted]=useState(false),[message,setMessage]=useState(''),[complete,setComplete]=useState(false),[partial,setPartial]=useState(false);
 const [restoredRecord,setRestoredRecord]=useState<SelectedBitableRecordMetadata>();
 const recordGeneration=useRef(0),restoring=useRef(false);
 useFeishuCacheEviction(notice=>{if(!notice.all&&!notice.recordRefs.includes(restoredRecord?.recordRef??'')&&!(restoring.current&&notice.recordRefs.length>0))return;recordGeneration.current++;restoring.current=false;setRestoredRecord(undefined);setMessage('相关记录已永久清除，旧会话快照已关闭。');});
 useEffect(()=>{let active=true;const started=recordGeneration.current,raw=window.careerFeishuBitableRawPreview;restoring.current=!!raw;if(raw)void raw.getSelectedRecord().then(value=>{const result=SelectedBitableRecordResult.parse(value);if(active&&started===recordGeneration.current&&result.kind==='selected_record'&&result.source.bitableRef===selected.ref){setRestoredRecord(result);setTable({ref:result.source.tableRef,name:result.source.tableName});setView({ref:result.source.viewRef,name:result.source.viewName,type:'cached'});setPreviewLocked(true);setAttempted(true);}}).catch(()=>{}).finally(()=>{if(active&&started===recordGeneration.current)restoring.current=false;});return()=>{active=false;recordGeneration.current++;};},[selected.ref]);
 const inFlight=useRef(false);const [previewLocked,setPreviewLocked]=useState(false);
 async function load(){
  if(!bridge||inFlight.current||attempted)return;inFlight.current=true;setAttempted(true);setBusy(true);setMessage('');
  try{
   const result=BitableTablesResult.parse(await bridge.listBitableTables({selectedRef:selected.ref}));if(result.kind==='failure'){setMessage(errors[result.reason]);return;}setTables(result.items);setPartial(result.hasMore);
   for(const item of result.items){
    const views=BitableViewsResult.parse(await bridge.listBitableViews({tableRef:item.ref}));if(views.kind==='failure'){setMessage(errors[views.reason]);return;}
    const fields=BitableFieldsResult.parse(await bridge.listBitableFields({tableRef:item.ref}));if(fields.kind==='failure'){setMessage(errors[fields.reason]);return;}
    setDetails(current=>({...current,[item.ref]:{views:views.items,fields:fields.items,hasMore:views.hasMore||fields.hasMore}}));if(views.hasMore||fields.hasMore)setPartial(true);
   }setComplete(true);
  }catch{setMessage(errors.structure_failed);}finally{inFlight.current=false;setBusy(false);}
 }
 return <section className="bitable-structure" aria-label="多维表格结构"><div className="bitable-structure-heading"><h3>表格结构</h3><button className="button" disabled={!bridge||busy||attempted} onClick={()=>void load()}>{busy?'正在读取结构…':restoredRecord?'已使用会话快照':attempted?complete?'结构已读取':'读取未完成':'查看表格结构'}</button></div><p className="muted">只查看表、视图和字段名称；不读取任何记录内容。</p>
  {message&&<p role="alert">{message}</p>}{complete&&tables.length===0&&<p>这份多维表格没有可用的数据表。</p>}{partial&&<p role="alert">结构较多，当前只显示一页；尚有结构未列出。</p>}
  <div className="bitable-tables">{tables.map(item=><section className="bitable-table" key={item.ref}><header><button className="bitable-table-choice" aria-label={'选择表：'+item.name} aria-pressed={table?.ref===item.ref} disabled={previewLocked} onClick={()=>{setTable(item);setView(undefined);}}><span aria-hidden="true">{table?.ref===item.ref?'●':'○'}</span><strong>{item.name}</strong></button></header>{details[item.ref]?<><div className="bitable-schema-row"><span>视图</span><div className="bitable-views">{details[item.ref]!.views.length?details[item.ref]!.views.map(entry=><button className="text-button" key={entry.ref} aria-label={'选择视图：'+entry.name} aria-pressed={view?.ref===entry.ref} disabled={previewLocked||table?.ref!==item.ref} onClick={()=>setView(entry)}>{entry.name}</button>):<span className="muted">无可用视图</span>}</div></div><div className="bitable-schema-row"><span>字段</span><ul>{details[item.ref]!.fields.map((field,index)=><li key={index}><span>{field.name}</span><small>{fieldTypes[field.type]??field.type}</small></li>)}</ul></div></>:<p className="muted">{busy?'正在读取该表的结构…':'该表结构尚未完整读取。'}</p>}</section>)}</div>
  {table&&<div className="bitable-selection" role="status"><strong>已选择表：{table.name}</strong>{view&&<span>视图：{view.name}<button className="text-button" disabled={previewLocked} onClick={()=>setView(undefined)}>不限定视图</button></span>}<p>{previewLocked?'本轮预览范围已固定；读取结果见下方。尚未保存到 Career。':'尚未读取记录，也没有保存到 Career。'}</p></div>}
  {!restoredRecord&&table&&view&&window.careerFeishuBitablePreview&&<BitableRecordPreview key={table.ref+view.ref} table={table} view={view} onAttempt={()=>setPreviewLocked(true)}/>}
  {restoredRecord&&<><p role="status">已选择记录：{restoredRecord.title}（当前会话快照）</p><BitableRawImportPreview key={restoredRecord.recordRef} record={restoredRecord}/></>}
 </section>;
}

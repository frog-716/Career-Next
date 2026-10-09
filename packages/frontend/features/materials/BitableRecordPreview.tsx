import {useEffect,useState,useRef} from 'react';
import {BitablePreviewResult,BitablePreviewSelectionResult,type PreviewCell,type PreviewColumn,type FeishuBitablePreviewBridge} from '../../../contracts/platform/feishu-bitable-preview';
import {SelectedBitableRecordResult,type SelectedBitableRecordMetadata} from '../../../contracts/platform/feishu-bitable-raw-preview';
import {BitableRawImportPreview} from './BitableRawImportPreview';
import {useFeishuCacheEviction} from './feishu-cache-eviction';
type Ref={ref:string;name:string};
const messages={invalid_request:'预览请求无效，未读取记录。',reference_unavailable:'这次表或视图选择已失效。',selection_required:'请先确认一张表和一个视图。',selection_locked:'本轮预览范围已经固定，不能换表或视图继续读取。',not_connected:'请先连接飞书。',connection_invalid:'飞书连接暂不可用，请到设置检查连接。',reauthorization_required:'飞书需要重新授权，尚未读取记录。',permission_required:'预览记录需要只读权限，请先检查飞书授权。',preview_failed:'这次记录预览没有完成，没有自动重试。'};
const priorities=['任务名称','任务状态','创建时间','渠道','场景','风格','目标图片数量'];
function display(cell:PreviewCell):string{
 if(cell.kind==='empty')return '—';if(cell.kind==='choice')return cell.value.join('、')||'—';if(cell.kind==='boolean')return cell.value?'是':'否';
 if(cell.kind==='summary'){const labels={attachment:'附件',linked_record:'关联记录',user:'用户字段',formula:'公式',lookup:'引用字段',rich_content:'复杂内容',other:'其他字段'};return labels[cell.category]+(cell.count!==undefined?'：'+cell.count+(cell.category==='attachment'?' 个':' 项'):cell.present?'：已设置':'：未设置');}
 if(cell.kind==='date'){const date=new Date(cell.value);return Number.isNaN(date.getTime())?String(cell.value):date.toLocaleString('zh-CN');}return String(cell.value);
}
export function BitableRecordPreview({table,view,onAttempt,bridge=window.careerFeishuBitablePreview}:{table:Ref;view:Ref;onAttempt:()=>void;bridge?:FeishuBitablePreviewBridge}){
 const [result,setResult]=useState<Extract<BitablePreviewResult,{kind:'records'}>>(),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[attempted,setAttempted]=useState(false),[selected,setSelected]=useState<string>(),inFlight=useRef(false);
 const [selectedRecord,setSelectedRecord]=useState<SelectedBitableRecordMetadata>();
 const generation=useRef(0),choosing=useRef<string|undefined>(undefined);
 useEffect(()=>()=>{generation.current++;},[]);
 useFeishuCacheEviction(notice=>{if(!notice.all&&!notice.recordRefs.includes(choosing.current??selected??'')&&!result?.items.some(item=>notice.recordRefs.includes(item.ref))&&!(inFlight.current&&notice.recordRefs.length>0))return;generation.current++;choosing.current=undefined;inFlight.current=false;setResult(undefined);setSelected(undefined);setSelectedRecord(undefined);setBusy(false);setAttempted(true);setMessage('相关内容已永久清除，旧记录预览已关闭。');});
 async function choose(recordRef:string){const started=generation.current;choosing.current=recordRef;const raw=window.careerFeishuBitableRawPreview;if(!raw){setSelected(recordRef);return;}try{const result=SelectedBitableRecordResult.parse(await raw.selectRecord({recordRef}));if(started!==generation.current)return;if(result.kind==='failure'){setMessage('已读快照不可用，没有重新读取飞书。');return;}setSelected(recordRef);setSelectedRecord(result);}catch{if(started===generation.current)setMessage('本地选择未完成，没有重新读取飞书。');}finally{if(started===generation.current)choosing.current=undefined;}}
 async function preview(){if(!bridge||inFlight.current||attempted)return;const started=generation.current;inFlight.current=true;setAttempted(true);setBusy(true);onAttempt();try{
  const choice=BitablePreviewSelectionResult.parse(await bridge.selectBitablePreview({tableRef:table.ref,viewRef:view.ref}));if(started!==generation.current)return;if(choice.kind==='failure'){setMessage(messages[choice.reason]);return;}
  const response=BitablePreviewResult.parse(await bridge.previewBitableRecords({tableRef:table.ref,viewRef:view.ref,limit:5}));if(started!==generation.current)return;if(response.kind==='failure'){setMessage(messages[response.reason]);return;}setResult(response);
 }catch{if(started===generation.current)setMessage(messages.preview_failed);}finally{if(started===generation.current){setBusy(false);inFlight.current=false;}}}
 const columns=result?.columns??[];
 const order=columns.map((column,index)=>({column,index})).sort((a,b)=>{const p=(c:PreviewColumn)=>{const i=priorities.indexOf(c.name);return i<0?100:i;};return p(a.column)-p(b.column)||a.index-b.index;});
 const visible=order.filter(x=>!['formula','lookup','button'].includes(x.column.type)).slice(0,8);
 const titleIndex=columns.findIndex(x=>x.name==='任务名称'&&x.type==='text')>=0?columns.findIndex(x=>x.name==='任务名称'&&x.type==='text'):columns.findIndex(x=>x.type==='text');
 const title=(cells:PreviewCell[],index:number)=>{const cell=cells[titleIndex];return cell?.kind==='text'&&cell.value.trim()?cell.value:'记录 '+(index+1);};
 const selectedIndex=result?.items.findIndex(x=>x.ref===selected)??-1;
 return <section className="bitable-record-preview" aria-label="记录预览"><div className="bitable-structure-heading"><h3>记录预览</h3><button className="button" disabled={!bridge||busy||attempted} onClick={()=>void preview()}>{busy?'正在读取记录…':'预览最多 5 条记录'}</button></div><p className="muted">仅当前视图，最多 5 条；不会继续翻页、导入或展开附件和关联资料。</p>{message&&<p role="alert">{message}</p>}
 {result&&<>{result.items.length===0?<p>这个视图暂时没有记录。</p>:<div className="bitable-preview-grid" role="table" aria-label="有限记录预览"><div className="bitable-preview-header" role="row">{visible.map(({column,index})=><span role="columnheader" key={index}>{column.name}</span>)}</div>{result.items.map((item,index)=><button className="bitable-preview-row" role="button" aria-label={'选择记录：'+title(item.cells,index)} aria-pressed={selected===item.ref} key={item.ref} onClick={()=>void choose(item.ref)}>{visible.map(x=><span key={x.index} data-field-type={x.column.type}>{display(item.cells[x.index]!)}</span>)}</button>)}</div>}{visible.length<columns.length&&<details className="bitable-preview-extra"><summary>其他字段</summary>{result.items.map((item,i)=><div key={item.ref}><strong>{title(item.cells,i)}</strong>{order.filter(x=>!visible.includes(x)).map(({column,index})=><p key={index}><span>{column.name}</span>：<span data-field-type={column.type}>{display(item.cells[index]!)}</span></p>)}</div>)}</details>}
 {result.hasMore&&<p className="muted">还有其他记录，本轮不继续读取。</p>}{selectedIndex>=0&&<div role="status"><strong>已选择记录：{title(result.items[selectedIndex]!.cells,selectedIndex)}</strong><p>仅当前会话选择，尚未导入或保存。</p></div>}</>}
  {selectedRecord&&<details className="bitable-optional-import"><summary>将这一条保存为资料（可选）</summary><BitableRawImportPreview key={selectedRecord.recordRef} record={selectedRecord}/></details>}
 </section>;
}

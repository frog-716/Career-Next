import { useEffect, useRef, useState } from 'react';
import { Identity, Result } from '../../../contracts/materials/schema';
import type { Preview, Raw, RawSummary } from '../../../contracts/materials/schema';
import { saveRaw, verifyReceipt } from './save';
import type { SaveState } from './save';
const errors: Record<string,string>={unsupported_file:'当前只支持 256 KiB 以内的 UTF-8 TXT 或 Markdown 文本，不能导入此文件。',file_failed:'读取或暂存文件失败，未保存资料。请检查文件后重新选择。',storage_failed:'文件发布失败，未保存资料。可检查磁盘后重新确认。',db_failed:'数据库未完成保存，请检查磁盘空间后重新确认。',invalid_capability:'预览或连接已失效。保留当前预览，请重新选择文件。',conflict:'当前预览与保存意图不一致，未覆盖资料。保留当前预览，请重新选择或取消。',content_unavailable:'已保存的原件暂时无法读取，请重试。',disconnected:'后端连接断开，请重新连接。'};
export function RawImport() {
  const [preview,setPreview]=useState<Preview>();
  const [previewInvalid,setPreviewInvalid]=useState(false);
  const [raw,setRaw]=useState<Raw>();
  const [items,setItems]=useState<RawSummary[]>([]);
  const [status,setStatus]=useState('正在打开资料库');
  const [busy,setBusy]=useState(false),[connected,setConnected]=useState(false);
  const [save,setSave]=useState<SaveState>();
  const sequence=useRef(0);
  const bridge=window.careerMaterials;
  async function refreshList() { const result=Result.parse(await bridge.request({operation:'list'}));if(result.kind==='list')setItems(result.items); }
  useEffect(()=>{ let active=true; void bridge.ready().then(value=>{Identity.parse(value);if(active){setConnected(true);setStatus('请选择个人原始材料');void refreshList().catch(()=>setStatus('资料列表读取失败，可重新连接。'));}}).catch(()=>{if(active)setStatus('连接失败，请重新连接。');});return()=>{active=false;}; },[]);
  function apply(state: SaveState) {
    setSave(state);
    if(state.code==='invalid_capability')setPreviewInvalid(true);
    const labels={saved:'已保存，以下内容从正式资料回读',saved_unread:'已保存，暂时未刷新；请重新读取，不要重复保存。',not_recorded:'尚未查到原命令记录。可手动继续原保存，仍使用同一命令；不会自动重试。',outcome_unknown:'保存结果待核对，请查询原保存结果，不要重新保存。',failed:'保存失败，未创建正式资料。',conflict:errors.conflict};
    setStatus(labels[state.phase]+(state.code?' '+(errors[state.code]??'操作未完成。'):''));
    if(state.raw){setRaw(state.raw);setPreview(undefined);}
    void refreshList().catch(()=>undefined);
  }
  async function select() {
    const ticket=++sequence.current;setBusy(true);
    try {
      const result=Result.parse(await bridge.request({operation:'select'}));if(ticket!==sequence.current)return;
      if(result.kind==='preview'){setPreviewInvalid(false);setPreview(result.preview);setRaw(undefined);setSave(undefined);setStatus('尚未保存');}
      else if(result.kind==='failure')setStatus(errors[result.code]??'选择失败，未保存。');
    }catch{setStatus('选择失败，请检查连接后重新选择。');}finally{setBusy(false);}
  }
  async function cancel() {
    if(!preview)return;
    if(previewInvalid){setPreview(undefined);setPreviewInvalid(false);setSave(undefined);setStatus('已丢弃失效预览，没有创建正式资料。');return;}
    const ticket=++sequence.current;setBusy(true);
    try{const result=Result.parse(await bridge.request({operation:'cancel',importId:preview.importId}));if(ticket!==sequence.current)return;if(result.kind==='cancelled'){setPreview(undefined);setSave(undefined);setStatus('已取消，没有创建正式资料。');}else if(result.kind==='failure')setStatus(errors[result.code]??'取消失败，可重新连接。');}catch{setStatus('取消结果待确认，请重新连接。');}finally{setBusy(false);}
  }
  async function confirm() {
    if(!preview)return;const ticket=++sequence.current;setBusy(true);setStatus('保存中');
    const command=save?.phase==='not_recorded'?save.command:{commandId:crypto.randomUUID(),importId:preview.importId,expectedRevision:preview.revision,digest:preview.digest};
    const state=await saveRaw(bridge,command);if(ticket===sequence.current)apply(state);setBusy(false);
  }
  async function verify() {
    if(!save)return;const ticket=++sequence.current;setBusy(true);
    const state=await verifyReceipt(bridge,save.command);if(ticket===sequence.current)apply(state);setBusy(false);
  }
  async function reconnect() {
    setBusy(true);setStatus('正在重新连接');try{Identity.parse(await bridge.reconnect());setConnected(true);setPreviewInvalid(Boolean(preview));if(save)apply(await verifyReceipt(bridge,save.command));else {setStatus(preview?'连接已重建，旧预览不可再保存；请重新选择或取消。':'连接已重建，请选择材料。');setPreviewInvalid(Boolean(preview));}await refreshList();}catch{setStatus('连接尚不可用，请稍后重试。');}finally{setBusy(false);}
  }
  async function read(id: string) {
    const ticket=++sequence.current;setBusy(true);
    try{const result=Result.parse(await bridge.request({operation:'read',materialId:id}));if(ticket!==sequence.current)return;if(result.kind==='raw'){setRaw(result.raw);setPreview(undefined);setSave(undefined);setStatus('已保存，以下内容从正式资料回读');}else if(result.kind==='failure')setStatus(errors[result.code]??'读取失败，可重试。');}catch{setStatus('读取失败，请重新连接；不会重复保存。');}finally{setBusy(false);}
  }
  const unresolved=save?.phase==='outcome_unknown'||save?.phase==='saved_unread';
  return <main>
    <h1>个人原始材料</h1>
    <p>从本地选择文本，预览后由你确认保存。保存为证据型原件，不提供原地编辑，也不保证原文事实真实。</p>
    <p>仅支持 UTF-8 TXT / Markdown，最大 256 KiB。不调用 AI，不向外部发送。</p>
    <div className="actions"><button disabled={!connected||busy||unresolved||Boolean(preview)} onClick={()=>void select()}>选择本地文本材料</button><button disabled={busy} onClick={()=>void reconnect()}>重新连接</button></div>
    <p id="status" role="status" aria-live="polite">{status}</p>
    {preview&&<section aria-label="尚未保存的预览"><h2>尚未保存</h2><p>{preview.name} · {preview.size} 字节 · 个人范围</p><pre id="preview-text">{preview.text}</pre><div className="actions"><button disabled={busy||unresolved||previewInvalid} onClick={()=>void confirm()}>{save?.phase==='not_recorded'?'继续原保存':save?.phase==='failed'||save?.phase==='conflict'?'重新确认保存':'确认保存原件'}</button><button disabled={busy||unresolved} onClick={()=>void cancel()}>取消导入</button></div></section>}
    {unresolved&&<button disabled={busy} onClick={()=>void verify()}>{save.phase==='saved_unread'?'重新读取已保存材料':'核对保存结果'}</button>}
    {raw&&<section aria-label="正式材料回读"><h2>{raw.name}</h2><p>个人范围 · 已保存的原件 · 来源：本材料</p><pre id="saved-text">{raw.text}</pre><button disabled={busy} onClick={()=>void read(raw.id)}>重新读取原件</button></section>}
    <section aria-label="已保存材料"><h2>已保存材料</h2>{items.length===0?<p>尚无已保存材料。</p>:<ul>{items.map(item=><li key={item.id}><button disabled={busy||Boolean(preview)||unresolved} onClick={()=>void read(item.id)}>{item.name}</button></li>)}</ul>}</section>
  </main>;
}

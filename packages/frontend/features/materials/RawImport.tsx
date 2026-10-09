import {wasPurged,type PurgeNotice} from '../../design-system/purge-notice';
import { useEffect, useRef, useState } from 'react';
import { Identity, Result,type ImportTarget } from '../../../contracts/materials/schema';
import type { Preview, Raw, RawSummary } from '../../../contracts/materials/schema';
import { saveRaw, verifyReceipt } from './save';
import type { SaveState } from './save';
const errors: Record<string,string>={unsupported_file:'当前只支持 256 KiB 以内的 UTF-8 TXT 或 Markdown 文本，不能导入此文件。',file_failed:'读取或暂存文件失败，未保存资料。请检查文件后重新选择。',storage_failed:'文件发布失败，未保存资料。可检查磁盘后重新确认。',db_failed:'数据库未完成保存，请检查磁盘空间后重新确认。',invalid_capability:'预览或连接已失效。保留当前预览，请重新选择文件。',conflict:'当前预览与保存意图不一致，未覆盖资料。保留当前预览，请重新选择或取消。',content_unavailable:'已保存的原件暂时无法读取，请重试。',disconnected:'后端连接断开，请重新连接。'};
export function RawImport({purgeNotice,diagnostics=false,onUse}:{purgeNotice?:PurgeNotice;diagnostics?:boolean;onUse?:(raw:Raw)=>void}={}) {
  const [target,setTarget]=useState<ImportTarget>({kind:'personal'}),[targets,setTargets]=useState<{target:ImportTarget;label:string}[]>([{target:{kind:'personal'},label:'个人独立材料'}]),[candidates,setCandidates]=useState<{id:string;title:string;url:string}[]>([]);
  const [preview,setPreview]=useState<Preview>();
  const [previewInvalid,setPreviewInvalid]=useState(false);
  const [raw,setRaw]=useState<Raw>();
  const [items,setItems]=useState<RawSummary[]>([]);
  const [status,setStatus]=useState('正在打开资料库');
  const [busy,setBusy]=useState(false),[connected,setConnected]=useState(false);
  const [save,setSave]=useState<SaveState>();
  const sequence=useRef(0);
  const bridge=window.careerMaterials;
  async function loadTargets(){try{const {Result}=await import('../../../contracts/application/schema');const result=Result.parse(await window.career.request('application',{operation:'data.targets'}));if(result.kind==='data_targets')setTargets([{target:{kind:'personal'},label:'个人独立材料'},...result.targets.filter(item=>['company','opportunity','project','employment','person'].includes(item.owner)).map(item=>({target:{kind:item.owner as Exclude<ImportTarget['kind'],'personal'>,id:item.objectId},label:item.label}))]);}catch{/* Personal imports still work; no guessed object binding. */}}
  useEffect(()=>{void loadTargets();},[purgeNotice?.sequence]);
  async function fixtureCandidates(){if(busy||preview||unresolved)return;setBusy(true);try{const value=Result.parse(await bridge.request({operation:'fixture-candidates',target}));if(value.kind==='fixture-candidates'){setCandidates(value.candidates);setStatus('受控飞书形状候选已发现，尚未选择正文；没有网络连接。');}}catch{setStatus('候选读取失败。');}finally{setBusy(false);}}
  async function selectFixture(candidateId:string){const ticket=++sequence.current;setBusy(true);try{const value=Result.parse(await bridge.request({operation:'fixture-body',target,candidateId}));if(ticket!==sequence.current)return;if(value.kind==='preview'){setPreview(value.preview);setRaw(undefined);setSave(undefined);setPreviewInvalid(false);setCandidates([]);setStatus('所选受控候选的正文尚未保存，保存和后续 AI 是独立动作。');}else setStatus('正文读取失败，尚未保存。');}catch{setStatus('正文读取失败，当前选择保留。');}finally{setBusy(false);}}
  async function refreshList() { const result=Result.parse(await bridge.request({operation:'list'}));if(result.kind==='list')setItems(result.items); }
  useEffect(()=>{ let active=true; void bridge.ready().then(value=>{Identity.parse(value);if(active){setConnected(true);setStatus('请选择个人原始材料');void refreshList().catch(()=>setStatus('资料列表读取失败，可重新连接。'));}}).catch(()=>{if(active)setStatus('连接失败，请重新连接。');});return()=>{active=false;}; },[]);
  useEffect(()=>{if(!purgeNotice)return;const matchesRaw=wasPurged(purgeNotice,'materials',raw?.id)||wasPurged(purgeNotice,'materials',save?.raw?.id);const matchesImport=wasPurged(purgeNotice,'import',preview?.importId);if(matchesRaw||matchesImport){sequence.current++;setRaw(undefined);setSave(undefined);if(matchesImport)setPreview(undefined);setBusy(false);setStatus('选定内容已永久清除，旧预览和回执正文已关闭。');}setItems(old=>old.filter(item=>!wasPurged(purgeNotice,'materials',item.id)));void refreshList().catch(()=>{});},[purgeNotice?.sequence]);
  function apply(state: SaveState) {
    setSave(state);
    if(state.code==='invalid_capability')setPreviewInvalid(true);
    const labels={saved:'已保存原始材料',saved_unread:'已保存，暂时未刷新；请重新读取，不要重复保存。',not_recorded:'已经确认这次保存尚未完成，可以继续保存。不会自动重试。',outcome_unknown:'暂时无法确认是否保存。你的预览还在，请先检查保存结果。',failed:'保存失败，未创建正式资料。',conflict:errors.conflict};
    setStatus(labels[state.phase]+(state.code?' '+(errors[state.code]??'操作未完成。'):''));
    if(state.raw){setRaw(state.raw);setPreview(undefined);}
    void refreshList().catch(()=>undefined);
  }
  async function select() {
    const ticket=++sequence.current;setBusy(true);
    try {
      const result=Result.parse(await bridge.request({operation:'select',target}));if(ticket!==sequence.current)return;
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
    <h2>导入原始材料</h2><label>先选择材料归属<select aria-label="材料归属对象" disabled={busy||Boolean(preview)||unresolved} value={JSON.stringify(target)} onChange={event=>{setTarget(JSON.parse(event.target.value));setCandidates([]);}}>{targets.map(item=><option key={JSON.stringify(item.target)} value={JSON.stringify(item.target)}>{item.label}</option>)}</select></label><button disabled={busy||Boolean(preview)||unresolved} onClick={()=>void loadTargets()}>刷新归属对象</button>
    <p>从本地选择文本，预览后由你确认保存。保存为证据型原件，不提供原地编辑，也不保证原文事实真实。</p>
    <p>仅支持 UTF-8 TXT / Markdown，最大 256 KiB。不调用 AI，不向外部发送。</p>
    <div className="actions"><button disabled={!connected||busy||unresolved||Boolean(preview)} onClick={()=>void select()}>选择本地文本材料</button><button disabled={busy} onClick={()=>void reconnect()}>重新连接</button></div>
    {diagnostics&&<button disabled={!connected||busy||Boolean(preview)||unresolved} onClick={()=>void fixtureCandidates()}>发现受控飞书形状候选（无网络）</button>}{candidates.length>0&&<section aria-label="受控导入候选"><p>仅本地 fixture，不代表真实 Feishu 连接已通过。</p>{candidates.map(item=><button key={item.id} disabled={busy} onClick={()=>void selectFixture(item.id)}>选择正文：{item.title}</button>)}</section>}
    <p id="status" role="status" aria-live="polite">{status}</p>
    {preview&&<section aria-label="尚未保存的预览"><h2>尚未保存</h2><p>{preview.name} · {preview.size} 字节 · {preview.target?.kind??'personal'} 范围</p><pre id="preview-text">{preview.text}</pre><div className="actions"><button disabled={busy||unresolved||previewInvalid} onClick={()=>void confirm()}>{save?.phase==='not_recorded'?'继续保存':save?.phase==='failed'||save?.phase==='conflict'?'重新确认保存':'确认保存原件'}</button><button disabled={busy||unresolved} onClick={()=>void cancel()}>取消导入</button></div></section>}
    {unresolved&&<button disabled={busy} onClick={()=>void verify()}>{save.phase==='saved_unread'?'查看已保存材料':'检查是否已保存'}</button>}
    {raw&&<section aria-label="正式材料回读"><h2>{raw.name}</h2><p>{raw.scope} 范围 · 已保存的原件 · 来源：{raw.origin?'飞书（用户身份，只读导入）':'本材料'}</p>{raw.origin&&<details><summary>查看来源详情</summary>{raw.origin.kind==='feishu'?<><p>原文版本：{raw.origin.revisionId}<br/>{raw.origin.url}</p><details><summary>查看技术详情</summary>{raw.origin.documentId}</details></>:raw.origin.kind==='feishu_document'?<p>飞书云文档 · {raw.origin.source.displayTitle}<br/>来源版本：{raw.origin.provenance.revision}<br/>读取时间：{raw.origin.provenance.retrievedAt}{raw.origin.source.sourceUrl&&<><br/><a href={raw.origin.source.sourceUrl} target="_blank" rel="noreferrer">查看飞书来源</a></>}</p>:<p>飞书多维表格 · {raw.origin.source.bitableTitle}<br/>{raw.origin.source.tableName} → {raw.origin.source.viewName}<br/>读取时间：{raw.origin.provenance.retrieved_at??'未记录'}</p>}</details>}<details><summary>查看</summary><pre id="saved-text">{raw.text}</pre></details>{onUse&&<button onClick={()=>onUse(raw)}>用于记录知识</button>}<button disabled={busy} onClick={()=>void read(raw.id)}>刷新原件</button></section>}
    <section aria-label="已保存材料"><h2>已保存材料</h2>{items.length===0?<p>尚无已保存材料。</p>:<ul>{items.map(item=><li key={item.id}><button disabled={busy||Boolean(preview)||unresolved} onClick={()=>void read(item.id)}>{item.name}</button></li>)}</ul>}</section>
  </main>;
}

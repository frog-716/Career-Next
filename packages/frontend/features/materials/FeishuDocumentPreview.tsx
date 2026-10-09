import {useEffect,useRef,useState} from 'react';
import {FeishuDocumentResult,FeishuDocumentImportResult,type FeishuDocumentPreview as DocumentPreview,type FeishuDocumentBridge,type FeishuContentBlock} from '../../../contracts/platform/feishu-document';
import {Result,type Raw} from '../../../contracts/materials/schema';
import type {FeishuDocumentMetadata} from '../../../contracts/platform/feishu-discovery';
import {useFeishuCacheEviction} from './feishu-cache-eviction';

const messages:Record<string,string>={account_changed:'飞书账号已变化，未保存内容。请重新选择资料。',not_connected:'请先连接飞书。',reauthorization_required:'飞书需要重新授权，请到设置重新连接。',connection_invalid:'飞书暂时无法连接，请检查连接。',permission_required:'读取这份资料需要只读权限，请到设置检查授权。',reference_unavailable:'这次资料选择已失效，请重新选择。',unsupported_type:'这类资料暂不支持正文读取，未保存任何内容。',read_failed:'这次内容没有读完整，请检查连接。没有自动重试。',read_busy:'另一份资料正在读取，请等它完成或取消。',cancelled:'已取消读取，未保存资料。',limit_exceeded:'这份资料超出一次读取范围，未保存不完整内容。',version_changed:'资料在读取过程中发生变化，未保存。请重新查看最新内容。',preview_unavailable:'这份预览已失效，请重新选择资料后查看。',source_version_conflict:'同一来源版本已有不同内容，未覆盖已保存的资料。',save_failed:'保存没有完成，预览仍在。',invalid_request:'这次操作无效，未保存资料。'};
const pendingKey=(ref:string)=>'career-document-save:'+ref;
function blockText(block:FeishuContentBlock){return block.text.replace(block.kind==='heading'?/^#+\s*/:block.kind==='bullet'?/^-\s*/:block.kind==='ordered'?/^1\.\s*/:block.kind==='quote'?/^>\s*/:/^$/,'');}
function Content({preview}:{preview:DocumentPreview}){
 return <article className="feishu-document-content" aria-label="资料内容">{preview.blocks.map((block,i)=>{
  const text=blockText(block),style={paddingInlineStart:Math.min(block.depth,5)*12};
  if(block.kind==='heading')return <h4 key={i} style={style}>{text}</h4>;
  if(block.kind==='divider')return <hr key={i}/>;
  if(block.kind==='code')return <pre key={i} style={style}>{block.text.replace(/^```\n|\n```$/g,'')}</pre>;
  if(block.kind==='quote')return <blockquote key={i}>{text}</blockquote>;
  if(block.kind==='bullet'||block.kind==='ordered'||block.kind==='todo')return <p className="document-list-line" key={i} style={style}>{block.kind==='bullet'?'• ':block.kind==='ordered'?'1. ':''}{text}</p>;
  if(!text)return null;
  return <p className={['image','attachment','linked_content','unsupported','table','cell'].includes(block.kind)?'document-boundary-note':undefined} key={i} style={style}>{text}</p>;
 })}</article>;
}
/** Preview is a volatile connector snapshot. Saving and task use are separate human actions. */
export function FeishuDocumentPreview({selected,bridge=window.careerFeishuDocument,onUse}:{selected:FeishuDocumentMetadata;bridge?:FeishuDocumentBridge;onUse?:(raw:Raw)=>void}){
 const [preview,setPreview]=useState<DocumentPreview>(),[raw,setRaw]=useState<Raw>(),[busy,setBusy]=useState<'read'|'save'|'check'>(),[message,setMessage]=useState(''),[unknown,setUnknown]=useState(false),[notRecorded,setNotRecorded]=useState(false);
 const flight=useRef(false),requestId=useRef<string|undefined>(undefined),reading=useRef(false),command=useRef<string|undefined>(undefined),savedMaterial=useRef<string|undefined>(undefined),alive=useRef(true),generation=useRef(0),cachedReading=useRef(false);
 const current=(value:number)=>alive.current&&generation.current===value;
 useFeishuCacheEviction(notice=>{if(!notice.all&&!notice.previewRefs.includes(preview?.ref??'')&&!notice.materialIds.includes(savedMaterial.current??raw?.id??'')&&!((cachedReading.current||reading.current)&&notice.previewRefs.length>0))return;generation.current++;if(requestId.current&&reading.current)void bridge?.cancel({requestId:requestId.current}).catch(()=>{});else if(preview)void bridge?.cancel({previewRef:preview.ref}).catch(()=>{});requestId.current=undefined;reading.current=false;cachedReading.current=false;flight.current=false;command.current=undefined;savedMaterial.current=undefined;sessionStorage.removeItem(pendingKey(selected.ref));setPreview(undefined);setRaw(undefined);setUnknown(false);setNotRecorded(false);setBusy(undefined);setMessage('相关内容已永久清除，旧预览已关闭。');});
 useEffect(()=>{alive.current=true;const value=sessionStorage.getItem(pendingKey(selected.ref));if(value){try{const pending=JSON.parse(value);if(typeof pending.commandId==='string'){command.current=pending.commandId;setUnknown(true);}}catch{/* A damaged local hint never authorizes a save. */}}
  const cached=(bridge as FeishuDocumentBridge&{cachedPreview?:(input:{selectedRef:string})=>Promise<unknown>})?.cachedPreview;
  const started=generation.current;cachedReading.current=!!cached;if(cached)void cached({selectedRef:selected.ref}).then(value=>{const result=FeishuDocumentResult.parse(value);if(current(started)&&result.kind==='document_preview')setPreview(result);}).catch(()=>{}).finally(()=>{if(current(started))cachedReading.current=false;});
  return()=>{alive.current=false;generation.current++;if(requestId.current&&reading.current)void bridge?.cancel({requestId:requestId.current}).catch(()=>{});};
 },[selected.ref,bridge]);
 async function read(){if(!bridge||flight.current||unknown)return;const started=generation.current;flight.current=true;reading.current=true;setBusy('read');setMessage('');requestId.current=crypto.randomUUID();try{const result=FeishuDocumentResult.parse(await bridge.preview({requestId:requestId.current,selectedRef:selected.ref}));if(!current(started))return;if(result.kind==='document_preview'){setPreview(result);setRaw(undefined);}else setMessage(messages[result.reason]??'读取未完成。');}catch{if(current(started))setMessage(messages.read_failed);}finally{if(current(started)){flight.current=false;reading.current=false;setBusy(undefined);}}}
 async function cancel(){if(!bridge)return;const started=generation.current,input=busy==='read'&&requestId.current?{requestId:requestId.current}:preview?{previewRef:preview.ref}:undefined;if(!input)return;try{await bridge.cancel(input);if(!current(started))return;generation.current++;flight.current=false;reading.current=false;setBusy(undefined);setPreview(undefined);setMessage('已取消，未保存资料。');}catch{if(current(started))setMessage('取消尚未确认，请先等待。');}}
 async function readback(materialId:string,started:number){if(!current(started))return;savedMaterial.current=materialId;const result=Result.parse(await window.careerMaterials.request({operation:'read',materialId}));if(!current(started))return;if(result.kind!=='raw')throw Error('readback');if(preview&&(result.raw.text!==preview.text||result.raw.digest!==preview.provenance.contentDigest))throw Error('content_mismatch');setRaw(result.raw);setUnknown(false);setNotRecorded(false);sessionStorage.removeItem(pendingKey(selected.ref));setMessage(preview?'已保存，内容与预览一致。':'已保存，可以查看正式资料。');}
 async function save(){if(!preview||!bridge||flight.current||raw||unknown&&!notRecorded)return;const started=generation.current;flight.current=true;setBusy('save');command.current??=crypto.randomUUID();sessionStorage.setItem(pendingKey(selected.ref),JSON.stringify({commandId:command.current}));try{
  const input={commandId:command.current,previewRef:preview.ref,previewDigest:preview.provenance.previewDigest,...(notRecorded?{continueAfterNotFound:true as const}:{})};
  const result=FeishuDocumentImportResult.parse(await bridge.importPreview(input));if(!current(started))return;if(result.kind==='raw_saved'){await readback(result.materialId,started);return;}
  if(result.reason==='result_unknown'){setUnknown(true);setNotRecorded(false);setMessage('暂时无法确认是否已保存。请先检查结果，不要重新导入。');}else{sessionStorage.removeItem(pendingKey(selected.ref));setMessage(messages[result.reason]);}
 }catch{if(current(started)){setUnknown(true);setNotRecorded(false);setMessage(savedMaterial.current?'已保存，但暂时无法回读。请检查保存结果。':'暂时无法确认是否已保存。请先检查结果，不要重新导入。');}}finally{if(current(started)){flight.current=false;setBusy(undefined);}}}
 async function check(){if(!command.current||flight.current)return;const started=generation.current;flight.current=true;setBusy('check');try{const result=Result.parse(await window.careerMaterials.request({operation:'receipt',commandId:command.current}));if(!current(started))return;if(result.kind!=='receipt')throw Error('receipt');if(result.receipt.status==='committed')await readback(result.receipt.materialId,started);else if(result.receipt.status==='not_found'){setNotRecorded(true);setMessage(preview?'已确认尚未保存。你可以继续这次保存。':'已确认尚未保存，但原预览已失效。请重新选择资料查看。');}else if(result.receipt.status==='failed'){setUnknown(false);setNotRecorded(false);sessionStorage.removeItem(pendingKey(selected.ref));setMessage('这次保存未成功，预览仍在。');}else setMessage('保存仍在处理中，请稍后检查。没有自动重试。');}catch{if(current(started))setMessage('仍无法确认保存结果。请检查后台连接后再检查。');}finally{if(current(started)){flight.current=false;setBusy(undefined);}}}
 return <section className="feishu-document-preview" aria-label="飞书内容预览">
  {!preview&&!raw&&<><p className="muted">查看内容后再决定是否保存。图片和附件不会下载。</p><button className="button primary" disabled={!bridge||!!busy||unknown} onClick={()=>void read()}>{busy==='read'?'正在读取…':'查看内容'}</button></>}
  {busy==='read'&&<button className="text-button" onClick={()=>void cancel()}>取消读取</button>}
  {message&&<p role={unknown?'alert':'status'}>{message}</p>}
  {preview&&<><div className="document-preview-heading"><h3>{preview.title}</h3><span>飞书 · 版本 {preview.provenance.revision}</span></div><Content preview={preview}/>
   {preview.limitations.some(x=>x!=='connection_identity_unavailable')&&<p className="document-boundary-note">图片、附件和关联内容只保留占位说明，未读取其内容。</p>}
   <details className="document-source-details"><summary>来源详情</summary><p>来源版本：{preview.provenance.revision}<br/>读取时间：{new Date(preview.provenance.retrievedAt).toLocaleString('zh-CN')}<br/>完整文字预览 · {preview.blocks.length} 个内容块</p>{preview.source.sourceUrl&&<a href={preview.source.sourceUrl} target="_blank" rel="noreferrer">查看飞书来源</a>}{preview.limitations.includes('connection_identity_unavailable')&&<p>本次来源未提供稳定的连接账号标识，文档来源与版本已保留。</p>}</details>
   {!raw&&<div className="document-preview-actions"><button className="text-button" disabled={!!busy||unknown} onClick={()=>void cancel()}>取消</button>{!unknown&&<button className="button primary" disabled={!!busy} onClick={()=>void save()}>{busy==='save'?'正在保存…':'保存资料'}</button>}{notRecorded&&<button className="button primary" disabled={!!busy} onClick={()=>void save()}>继续这次保存</button>}</div>}
  </>}
  {unknown&&<button className="button" disabled={!!busy} onClick={()=>void check()}>检查是否已保存</button>}
  {raw&&<div className="document-saved"><strong>资料已保存</strong>{!preview&&<pre aria-label="已保存的资料内容">{raw.text}</pre>}<p>原始资料已保留；整理知识或交给 AI 仍需另行选择和确认。</p>{onUse&&<button className="button" onClick={()=>onUse(raw)}>用这份资料整理知识</button>}</div>}
 </section>;
}

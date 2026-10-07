import {useEffect,useRef,useState} from 'react';
import {NavigationIcon} from '../../design-system/NavigationIcon';
import {FeishuSearchResult,type FeishuDocumentMetadata,type FeishuDiscoveryBridge} from '../../../contracts/platform/feishu-discovery';
import type {FeishuConnectionState} from '../../../contracts/platform/feishu-identity';
import './feishu-materials.css';

const types:Record<FeishuDocumentMetadata['type'],string>={doc:'文档',docx:'云文档',wiki:'知识库',sheet:'电子表格',bitable:'多维表格',mindnote:'思维笔记',file:'文件',folder:'文件夹',catalog:'目录',slides:'演示文稿',shortcut:'快捷方式',other:'资料'};
const failures={not_connected:'请先在设置中连接飞书。',reauthorization_required:'飞书连接已失效，请到设置重新授权。',connection_invalid:'飞书连接暂不可用，请到设置检查连接。',permission_required:'飞书搜索需要只读权限，请到设置检查授权。',search_failed:'这次搜索没有完成，没有自动重试。请检查连接后再搜索。',search_busy:'另一次飞书搜索仍在进行，请稍后再试。',invalid_request:'请输入1至30字的标题关键词。'};
export function FeishuMaterialsPicker({bridge=window.careerFeishuDiscovery}:{bridge?:FeishuDiscoveryBridge}){
 const [connection,setConnection]=useState<FeishuConnectionState>('not_connected'),[query,setQuery]=useState(''),[items,setItems]=useState<FeishuDocumentMetadata[]>([]),[selected,setSelected]=useState<FeishuDocumentMetadata>(),[busy,setBusy]=useState(false),[searched,setSearched]=useState(false),[hasMore,setHasMore]=useState(false),[message,setMessage]=useState('');
 const inFlight=useRef(false),generation=useRef(0);
 useEffect(()=>{let alive=true;void window.careerFeishu?.getConnectionStatus().then(value=>{if(alive)setConnection(value.state);}).catch(()=>{if(alive)setConnection('connection_invalid');});return()=>{alive=false;generation.current++;};},[]);
 async function search(){
  if(inFlight.current)return;
  if(!query.trim()||Array.from(query).length>30){setMessage(failures.invalid_request);return;}
  if(!bridge){setMessage(failures.connection_invalid);return;}
  const current=++generation.current;inFlight.current=true;setBusy(true);setMessage('');setSelected(undefined);setItems([]);setSearched(false);setHasMore(false);
  try{
   const result=FeishuSearchResult.parse(await bridge.searchDocuments({searchId:crypto.randomUUID(),query}));if(current!==generation.current)return;
   if(result.kind==='failure'){setMessage(failures[result.reason]);if(['not_connected','reauthorization_required','connection_invalid'].includes(result.reason))setConnection(result.reason as FeishuConnectionState);return;}
   setItems(result.items);setHasMore(result.hasMore);setSearched(true);
  }catch{if(current===generation.current)setMessage(failures.search_failed);}finally{inFlight.current=false;if(current===generation.current)setBusy(false);}
 }
 return <section className="feishu-material-picker" aria-label="飞书资料"><h2>飞书资料</h2><p className="muted">按标题查找，选中后再决定是否读取。</p>
  {connection!=='connected'&&<p role="alert">{connection==='reauthorization_required'?failures.reauthorization_required:connection==='connection_invalid'?failures.connection_invalid:failures.not_connected}</p>}
  <div className="feishu-search-bar"><label className="search"><NavigationIcon name="search"/><span className="sr-only">搜索飞书资料标题</span><input aria-label="搜索飞书资料标题" placeholder="输入资料标题关键词" value={query} disabled={busy} onChange={event=>{setQuery(event.target.value);setMessage('');}}/></label><button className="button primary" disabled={busy||connection!=='connected'} onClick={()=>void search()}>{busy?'搜索中…':'搜索'}</button></div>
  {message&&<p role="alert">{message}</p>}
  {searched&&items.length===0&&<p>没有找到匹配标题。可以换一个更短的关键词再搜。</p>}
  {items.length>0&&<ul className="feishu-metadata-rows" aria-label="飞书搜索结果">{items.map(item=><li key={item.ref}><button className="feishu-metadata-row" aria-pressed={selected?.ref===item.ref} onClick={()=>setSelected(item)}><span className="row-icon"><NavigationIcon name={item.type==='folder'?'project':item.type==='wiki'?'wiki':'paper'}/></span><span className="feishu-result-title">{item.title}</span><span className="feishu-result-type">{types[item.type]}</span><time dateTime={item.updatedAt??undefined}>{item.updatedAt?new Date(item.updatedAt).toLocaleDateString('zh-CN'):'更新时间未知'}</time></button></li>)}</ul>}
  {hasMore&&<p className="muted">这里只显示前20条，请用更具体的标题缩小范围。</p>}
  {selected&&<div className="feishu-selected" role="status"><strong>已选择：{selected.title}</strong><span>{types[selected.type]} · 飞书</span><p>尚未读取正文，也没有保存到 Career。</p><button className="button" disabled>读取这份资料</button></div>}
 </section>;
}

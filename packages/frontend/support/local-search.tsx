import {useEffect,useRef,useState} from 'react';
import {LocalSearchResult,type LocalSearchBridge,type LocalSearchOwner,type LocalSearchRequest} from '../../contracts/application/local-search';
import type {PurgeNotice} from '../design-system/purge-notice';
import type {z} from 'zod';
export function LocalSearch({bridge,purgeNotice,onOpenOpportunity}:{bridge:LocalSearchBridge;purgeNotice?:PurgeNotice;onOpenOpportunity?:(id:string)=>void}){
 const [owner,setOwner]=useState<z.infer<typeof LocalSearchOwner>>('wiki'),[query,setQuery]=useState(''),[scope,setScope]=useState<'personal'|'cognition'>('personal'),[includeInactive,setIncludeInactive]=useState(false);
 const [result,setResult]=useState<LocalSearchResult>(),[busy,setBusy]=useState(false);const sequence=useRef(0);
 useEffect(()=>{sequence.current++;setResult(undefined);setBusy(false);},[purgeNotice?.sequence]);
 async function search(cursor?:LocalSearchRequest['cursor']){
  const current=++sequence.current;setBusy(true);
  try{const response=LocalSearchResult.parse(await bridge.request({operation:'local-search.query',owner,query,includeInactive,...owner==='wiki'?{scope}:{},...cursor?{cursor}:{}}));if(current===sequence.current)setResult(response);}
  catch{if(current===sequence.current)setResult({kind:'local-search.failure',code:'disconnected',partial:true,notice:'结果未完整检索'});}
  finally{if(current===sequence.current)setBusy(false);}
 }
 const change=()=>{sequence.current++;setResult(undefined);setBusy(false);};
 return <section aria-label="本地资料检索"><h3>本地资料检索</h3><label>查找范围<select value={owner} onChange={e=>{setOwner(e.target.value as typeof owner);change();}}><option value="wiki">知识</option><option value="opportunity">机会</option><option value="project">项目</option></select></label>{owner==='wiki'&&<label>知识范围<select value={scope} onChange={e=>{setScope(e.target.value as typeof scope);change();}}><option value="personal">个人知识</option><option value="cognition">长期认知</option></select></label>}<label>查找内容<input maxLength={64} value={query} onChange={e=>{setQuery(e.target.value);change();}}/></label><label><input type="checkbox" checked={includeInactive} onChange={e=>{setIncludeInactive(e.target.checked);change();}}/>包括已结束或退役资料</label><button disabled={busy||!query.trim()} onClick={()=>void search()}>查找本地资料</button>{busy&&<p role="status">检索中，其他操作仍可使用</p>}{result&&<><p role="status">{result.notice}{result.partial?'；可以继续或缩小范围。':''}</p>{result.kind==='local-search.results'&&<><ul>{result.items.map(item=><li key={item.owner+item.id}>{item.owner==='opportunity'&&onOpenOpportunity?<button onClick={()=>onOpenOpportunity(item.id)}>{item.title}</button>:<strong>{item.title}</strong>}<p>{item.snippet}</p></li>)}</ul>{!result.partial&&result.items.length===0&&<p>在选定范围内没有匹配资料</p>}{result.partial&&<button disabled={busy} onClick={()=>void search(result.cursor)}>{result.cursor?'继续检索':'重新核对索引并检索'}</button>}</>}</>}</section>;
}

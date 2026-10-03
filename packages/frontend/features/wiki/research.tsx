import {wasPurged,type PurgeNotice} from '../../design-system/purge-notice';
import {useEffect,useRef,useState} from 'react';
import {Result as OpportunityResult,type Request as OpportunityRequest,type OpportunityView} from '../../../contracts/opportunity/schema';
import {Result as ResearchResult,type Request as ResearchRequest,type Resolution} from '../../../contracts/opportunity/research/schema';

/** Read-only navigation into Research's public owner; Wiki stores no research body. */
export function WikiResearchReferences({purgeNotice,opportunityRequest,researchRequest,onOpenOwner}:{purgeNotice?:PurgeNotice;opportunityRequest:(input:OpportunityRequest)=>Promise<OpportunityResult>;researchRequest:(input:ResearchRequest)=>Promise<ResearchResult>;onOpenOwner:(id:string)=>void}){
 const [opportunities,setOpportunities]=useState<OpportunityView[]>([]),[selected,setSelected]=useState(''),[items,setItems]=useState<Resolution[]>([]),[status,setStatus]=useState('');
 const epoch=useRef(0);
 async function list(){try{const result=OpportunityResult.parse(await opportunityRequest({operation:'list'}));if(result.kind!=='opportunities')throw Error();setOpportunities(result.items);}catch{setStatus('读取机会失败，可重新刷新。');}}
 useEffect(()=>{void list();},[]);
 async function read(id:string){const generation=++epoch.current;setItems([]);if(!id)return;setStatus('正在读取研究引用…');try{
  const opportunity=OpportunityResult.parse(await opportunityRequest({operation:'read',id}));if(opportunity.kind!=='opportunity')throw Error();
  const owner={kind:'opportunity' as const,id};
  const documents=await Promise.all([researchRequest({operation:'read',owner}),researchRequest({operation:'read',owner:{kind:'company',id:opportunity.opportunity.companyId}})]);
  const unique=new Map<string,Resolution>();
  for(const value of documents){const result=ResearchResult.parse(value);if(result.kind!=='document')throw Error();for(const item of result.items)unique.set(item.item.id,item);for(const ref of result.references){const resolved=ResearchResult.parse(await researchRequest({operation:'resolve',id:ref.itemId,viewer:owner}));if(resolved.kind==='resolution')unique.set(resolved.resolution.item.id,resolved.resolution);}}
  if(generation!==epoch.current)return;setItems([...unique.values()]);setStatus(unique.size?'只读引用；修改请进入研究所属机会。':'这个机会目前没有可显示的研究。');
 }catch{if(generation===epoch.current)setStatus('研究引用暂不可读取，可重新刷新。');}}
 useEffect(()=>{if(!purgeNotice)return;epoch.current++;setItems(old=>old.filter(value=>!wasPurged(purgeNotice,'research',value.item.id)&&!wasPurged(purgeNotice,value.item.owner.kind,value.item.owner.id)));setOpportunities(old=>old.filter(value=>!wasPurged(purgeNotice,'opportunity',value.id)));if(wasPurged(purgeNotice,'opportunity',selected)){setSelected('');setItems([]);}else if(selected)void read(selected);void list();},[purgeNotice?.sequence]);
 return <section aria-label="Wiki 研究引用"><h2>研究引用</h2><p>正文由 CompanyResearch 或 OpportunityResearch 唯一维护。</p><button onClick={()=>void list()}>刷新研究机会</button><label>查看哪个机会的研究引用<select value={selected} onChange={event=>{setSelected(event.target.value);void read(event.target.value);}}><option value="">选择机会</option>{opportunities.map(item=><option key={item.id} value={item.id}>{item.companyName} · {item.role}</option>)}</select></label><button disabled={!selected} onClick={()=>void read(selected)}>刷新研究引用</button><p role="status">{status}</p>{items.map(({item,reviewRequired})=><article key={item.id}><h3>{item.title}</h3><p><span>{item.owner.kind==='company'?'公司研究（唯一正文）':'机会研究（唯一正文）'}</span> · {item.active?'有效':'已撤回'}{reviewRequired?' · 来源需要复核':''}</p><pre>{item.body}</pre></article>)}{selected&&<button onClick={()=>onOpenOwner(selected)}>到所属机会编辑研究正本</button>}</section>;
}

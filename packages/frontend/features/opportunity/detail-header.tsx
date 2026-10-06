import {useLayoutEffect,useRef,useState} from 'react';
import type {OpportunityView} from '../../../contracts/opportunity/schema';
import {NavigationIcon} from '../../design-system/NavigationIcon';
import './opportunity.css';
export const sections=[['overview','概览'],['resume','简历'],['research','情报'],['communication','沟通'],['interview','面试'],['offer','Offer']] as const;
export type {OpportunitySection} from '../../shell/routes';
import type {OpportunitySection} from '../../shell/routes';
export const phaseLabel={preparation:'投递准备',submitted:'已投递',interview:'面试',offer:'Offer'};
export const resultLabel={active:'进行中',accepted:'接受 Offer',withdrawn:'用户退出',recruiter_ended:'招聘方终止'};
export const nextStepLabel={preparation:'修改岗位简历',submitted:'查看投递与沟通',interview:'查看面试安排',offer:'核对 Offer 条件'};
export function OpportunityHeader({opportunity,section,onSection,onList,onMore}:{opportunity:OpportunityView;section:OpportunitySection;onSection(section:OpportunitySection):void;onList():void;onMore?:()=>void}){
 const tabs=useRef<HTMLDivElement>(null),[indicator,setIndicator]=useState({left:0,width:28});
 useLayoutEffect(()=>{const measure=()=>{const selected=tabs.current?.querySelector<HTMLElement>('[aria-selected=true]');if(selected)setIndicator({left:selected.offsetLeft,width:selected.offsetWidth});};measure();const observer=new ResizeObserver(measure);if(tabs.current)observer.observe(tabs.current);return()=>observer.disconnect();},[section]);
 return <header className="opportunity-header">
  <button className="text-button link-back" onClick={onList}><NavigationIcon name="back"/>返回机会列表</button>
  <div className="page-header"><div className="title"><h1 className="object-heading">{opportunity.companyName} · {opportunity.role}</h1><div className="summary-meta"><span className="pill">{phaseLabel[opportunity.phase]}</span><span><i className="status-dot"/>{resultLabel[opportunity.result]}</span></div></div><div className="actions"><button className="button primary" onClick={()=>onSection('resume')}>修改简历</button>{onMore&&<button className="icon-button" aria-label="机会详情更多" onClick={onMore}><NavigationIcon name="more"/></button>}</div></div>
  <nav aria-label="机会分区" className="tabs-scroll"><div className="tabs" ref={tabs}>{sections.map(([id,label])=><button key={id} aria-selected={section===id} aria-current={section===id?'page':undefined} onMouseDown={event=>event.preventDefault()} onClick={()=>onSection(id)}>{label}</button>)}<i className="tab-indicator" style={{transform:`translateX(${indicator.left}px)`,width:indicator.width}}/></div></nav>
  <div className="next-action-strip"><NavigationIcon name="arrow"/><span>下一步 · {opportunity.result==='active'?nextStepLabel[opportunity.phase]:'查看历史'}</span></div>
 </header>;
}

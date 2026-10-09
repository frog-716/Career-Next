import React,{useEffect,useRef,useState} from 'react';
import type {CareerDocument,Span} from '../../../contracts/resume/schema';
import './source-paper.css';
/** Resize the viewing surface, never the document's A4 layout or persisted typography. */
export function SourcePaperStage({children,onOverflow}:{children:React.ReactNode;onOverflow?:(value:boolean)=>void}){
 const viewport=useRef<HTMLDivElement>(null),[scale,setScale]=useState(1),[height,setHeight]=useState<number>();
 useEffect(()=>{const el=viewport.current;if(!el)return;
  const measure=()=>{if(el.clientWidth>0)setScale(Math.min(1,el.clientWidth/(210*96/25.4)));};
  const observer=new ResizeObserver(measure);observer.observe(el);measure();return()=>observer.disconnect();
 },[]);
 useEffect(()=>{const paper=viewport.current?.querySelector<HTMLElement>('.source-paper');if(!paper){setHeight(undefined);return;}
  const measure=()=>{setHeight(paper.offsetHeight);onOverflow?.(paper.offsetHeight>297*96/25.4+1);};
  const observer=new ResizeObserver(measure);observer.observe(paper);measure();return()=>observer.disconnect();
 },[onOverflow,children]);
 return <div className="source-paper-stage"><div className="source-paper-viewport" ref={viewport} style={{'--paper-view-scale':scale,...height?{height:height*scale}:{}} as React.CSSProperties}>{children}</div></div>;
}
function Spans({values}:{values:Span[]}){return <>{values.map((s,i)=>{let value:React.ReactNode=s.text;for(const mark of s.marks)value=mark.type==='bold'?<strong>{value}</strong>:mark.type==='italic'?<em>{value}</em>:mark.type==='strike'?<s>{value}</s>:<a href={mark.href}>{value}</a>;return <React.Fragment key={i}>{value}</React.Fragment>;})}</>;}
/** Frozen view follows document order exactly. Editing hints are never frozen content. */
export function SourcePaperBody({content}:{content:CareerDocument}){
 return <div className="source-paper-body">{content.sections.map(section=>{
  const rows:React.ReactNode[]=[];
  for(let i=0;i<section.blocks.length;i++){
   const block=section.blocks[i];
   if(block.type==='paragraph'&&block.entry){const group=[block];while(section.blocks[i+1]?.type==='paragraph'&&(section.blocks[i+1] as any).entry?.id===block.entry.id)group.push(section.blocks[++i] as typeof block);const fields=section.kind==='experience'?['company','position','date']:section.kind==='education'?['school','major','date']:['name','responsibility','date'];rows.push(<div className="source-entry-row" key={block.id}>{fields.map(field=>{const p=group.find(p=>p.entry?.field===field);return <div key={field} data-field={field} style={{textAlign:p?.alignment}}><Spans values={p?.spans??[]}/></div>;})}</div>);for(const p of group.filter(p=>!fields.includes(p.entry!.field)))rows.push(<p key={p.id} style={{textAlign:p.alignment}}><Spans values={p.spans}/></p>);
   }else rows.push(block.type==='paragraph'?<p key={block.id} style={{textAlign:block.alignment}}><Spans values={block.spans}/></p>:<ul key={block.id}>{block.items.map(p=><li key={p.id} style={{textAlign:p.alignment}}><Spans values={p.spans}/></li>)}</ul>);
  }
  return <section className="source-paper-section" key={section.id}><h2><span className="heading-text">{section.title}</span><i className="heading-line"/></h2>{rows}</section>;
 })}</div>;
}

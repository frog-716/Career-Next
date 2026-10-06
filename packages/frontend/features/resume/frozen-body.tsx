import React from 'react';
import type {CareerDocument,Span} from '../../../contracts/resume/schema';

function FrozenSpans({spans}:{spans:Span[]}){
 return <>{spans.map((span,index)=>{
  let text:React.ReactNode=span.text;
  for(const mark of span.marks){
   if(mark.type==='bold')text=<strong>{text}</strong>;
   else if(mark.type==='italic')text=<em>{text}</em>;
   else if(mark.type==='strike')text=<s>{text}</s>;
   else text=<a href={mark.href}>{text}</a>;
  }
  return <React.Fragment key={index}>{text}</React.Fragment>;
 })}</>;
}

/** Read-only view of the frozen Career document; never reads the live editor. */
export function FrozenResumeBody({content}:{content:CareerDocument}){
 return <div className={`resume-frozen-body resume-font-${content.layout.fontSize}`}>
  {content.sections.map(section=><section className="paper-section" key={section.id}>
   <h3>{section.title}</h3>
   {section.blocks.map(block=>block.type==='paragraph'
    ?<p key={block.id} style={{textAlign:block.alignment??'left'}}><FrozenSpans spans={block.spans}/></p>
    :<ul key={block.id}>{block.items.map(item=><li key={item.id} style={{textAlign:item.alignment??'left'}}><FrozenSpans spans={item.spans}/></li>)}</ul>)}
  </section>)}
 </div>;
}

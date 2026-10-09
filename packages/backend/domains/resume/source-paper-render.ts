import type {CareerDocument,Span} from '../../../contracts/resume/schema';
/** Port of the active supplied legacy.css paper, not the unused React form scaffold. */
export const SOURCE_PAPER_PRINT_CSS=`@page{size:A4;margin:9mm}@font-face{font-family:'Career Resume Sans';src:url('https://career.invalid/font/source-han-sans') format('woff2');font-weight:200 900;font-style:normal}body{font-family:'Times New Roman','Career Resume Sans','Arial Unicode MS','PingFang SC',sans-serif;font-size:calc(12.25px * var(--source-scale,1));line-height:1.4;color:#222}header{text-align:center;margin-bottom:15px}header h1{font-family:'Career Resume Sans','Arial Unicode MS','PingFang SC',sans-serif;font-size:24px;line-height:1.25;margin:0 0 5px}header p{font-size:12px;margin:4px 0}header a{color:#4b20a6}.source-paper-section{margin:0;border:0;padding:0}.source-paper-section h2{display:flex;align-items:center;gap:12px;border:0;margin:calc(10.5px * var(--source-scale,1)) 0 calc(5px * var(--source-scale,1));font-size:16px;line-height:1.25;break-after:avoid}.source-paper-section h2 span{min-width:90px;padding:4px 10px;text-align:center;color:#fff;background:#424242;border-left:4px solid #deddda;border-radius:0 3px 3px 0}.source-paper-section h2:after{content:'';flex:1;border-top:1px solid #bbb}.source-entry-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:calc(3px * var(--source-scale,1)) 5px calc(4px * var(--source-scale,1));font-size:calc(12.75px * var(--source-scale,1));font-weight:600;break-inside:avoid;break-after:avoid}.source-entry-row>div{min-width:0;white-space:pre-wrap;overflow-wrap:anywhere}.source-entry-row>div:nth-child(2){text-align:center}.source-entry-row>div:nth-child(3){text-align:right;font-weight:400}.source-paper-section p{font-size:calc(12.25px * var(--source-scale,1));line-height:1.4;margin:calc(2px * var(--source-scale,1)) 0;white-space:pre-wrap}.source-paper-section ul{padding:0 0 0 17px;margin:calc(2px * var(--source-scale,1)) 0}.source-paper-section li{font-size:calc(12.25px * var(--source-scale,1));line-height:1.4;margin:calc(2px * var(--source-scale,1)) 0;white-space:pre-wrap;break-inside:avoid}.source-entry-detail{padding-left:5px}`;
export function renderSourcePaperSections(content:CareerDocument,escape:(s:string)=>string,spans:(v:Span[])=>string){
 return content.sections.map(section=>{
  const blocks:string[]=[];
  for(let i=0;i<section.blocks.length;i++){
   const b=section.blocks[i];
   if(b.type==='paragraph'&&b.entry){
    const group=[b];while(section.blocks[i+1]?.type==='paragraph'&&(section.blocks[i+1] as any).entry?.id===b.entry.id)group.push(section.blocks[++i] as typeof b);
    const fields=section.kind==='experience'?['company','position','date']:section.kind==='education'?['school','major','date']:['name','responsibility','date'];
    blocks.push('<div class="source-entry-row"'+(section.kind==='education'?' style="grid-template-columns:130px minmax(0,1fr) 130px"':'')+'>'+fields.map((field,index)=>{const p=group.find(p=>p.entry?.field===field);return '<div data-field="'+field+'"'+(p?.alignment?' style="text-align:'+p.alignment+'"':'')+'>'+spans(p?.spans??[])+'</div>';}).join('')+'</div>');
    for(const p of group.filter(p=>!fields.includes(p.entry!.field)))blocks.push('<p class="source-entry-detail">'+spans(p.spans)+'</p>');
   }else if(b.type==='paragraph')blocks.push('<p'+(b.alignment?' style="text-align:'+b.alignment+'"':'')+'>'+spans(b.spans)+'</p>');
   else blocks.push('<ul>'+b.items.map(p=>'<li'+(p.alignment?' style="text-align:'+p.alignment+'"':'')+'>'+spans(p.spans)+'</li>').join('')+'</ul>');
  }
  return '<section class="source-paper-section"><h2><span>'+escape(section.title)+'</span></h2>'+blocks.join('')+'</section>';
 }).join('');
}

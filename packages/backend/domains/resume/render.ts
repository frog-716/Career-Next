import {Snapshot,SafeLink,type Span} from '../../../contracts/resume/schema';
const escape=(text:string)=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
/** Trusted static rendering of a frozen Career snapshot; never accepts arbitrary HTML or resource URLs. */
export function renderSnapshot(input:unknown):string {
 const snapshot=Snapshot.parse(input);
 function spans(values:Span[]){return values.map(span=>{
  let text=escape(span.text);
  for(const mark of span.marks){if(mark.type==='bold')text=`<strong>${text}</strong>`;else if(mark.type==='italic')text=`<em>${text}</em>`;else if(mark.type==='strike')text=`<s>${text}</s>`;else text=`<a href="${escape(SafeLink.parse(mark.href))}">${text}</a>`;}
  return text;
 }).join('');}
 const fontFamily=snapshot.rendererVersion==='career-print-2'?"Arial,'Arial Unicode MS','Hiragino Sans GB','PingFang SC',sans-serif":"Arial,'PingFang SC','Hiragino Sans GB',sans-serif";
 const align=(value:import('../../../contracts/resume/schema').Alignment|undefined)=>value?` style="text-align:${value}"`:'';
 const sections=snapshot.content.sections.map(section=>`<section><h2>${escape(section.title)}</h2>${section.blocks.map(block=>block.type==='paragraph'?`<p${align(block.alignment)}>${spans(block.spans)||'&#8203;'}</p>`:`<ul>${block.items.map(item=>`<li${align(item.alignment)}>${spans(item.spans)}</li>`).join('')}</ul>`).join('')}</section>`).join('');
 return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'none'; img-src 'none'; connect-src 'none'; script-src 'none'; base-uri 'none'; form-action 'none'"><title>Career Resume</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:${fontFamily};font-size:${snapshot.content.layout.fontSize}pt;line-height:1.5;margin:0;color:#111;overflow-wrap:anywhere}header{margin-bottom:6mm}h1{font-size:24pt;margin:0 0 2mm}h2{font-size:14pt;border-bottom:1px solid #555;margin:5mm 0 2mm;break-after:avoid}p{margin:1mm 0;white-space:pre-wrap}li{white-space:pre-wrap}ul{padding-left:6mm}a{color:#111;text-decoration:underline}section{break-inside:auto}</style></head><body><header><h1${align(snapshot.content.layout.identityNameAlignment)}>${escape(snapshot.profile.name)}</h1><p>${escape(snapshot.profile.contact)}</p><p>${snapshot.profile.links.map(link=>`<a href="${escape(SafeLink.parse(link.href))}">${escape(link.label)}</a>`).join(' · ')}</p></header>${sections}</body></html>`;
}

import type {JSONContent} from '@tiptap/react';
import {CareerDocument,Mark,type Span} from '../../../contracts/resume/schema';
/** Editor JSON is a temporary adapter format. Only Career structured content is persisted. */
export function toEditor(document:CareerDocument):JSONContent {
 const text=(spans:Span[])=>spans.filter(span=>span.text.length).map(span=>({type:'text',text:span.text,marks:span.marks.map(mark=>mark.type==='link'?{type:'link',attrs:{href:mark.href,target:null,rel:null}}:{type:mark.type})}));
 return {type:'doc',content:document.sections.flatMap(section=>[
  {type:'heading',attrs:{level:2,careerId:section.id,careerKind:section.kind},content:section.title?[{type:'text',text:section.title}]:[]},
  ...section.blocks.map(block=>block.type==='paragraph'?{type:'paragraph',attrs:{careerId:block.id},content:text(block.spans)}:{type:'bulletList',attrs:{careerId:block.id},content:block.items.map(item=>({type:'listItem',attrs:{careerId:item.id},content:[{type:'paragraph',attrs:{careerId:item.paragraphId},content:text(item.spans)}]}))})
 ])};
}
export function fromEditor(editor:JSONContent,layout:CareerDocument['layout']):CareerDocument {
 const unsupported=()=>new Error('文档包含当前适配器不支持的结构；保留本地内容，未保存。');
 function spans(nodes:JSONContent[]=[]):Span[]{return nodes.map(node=>{if(node.type!=='text'||typeof node.text!=='string')throw unsupported();return {text:node.text,marks:(node.marks??[]).map(mark=>Mark.parse(mark.type==='link'?{type:'link',href:mark.attrs?.href}:{type:mark.type}))};});}
 function id(node:JSONContent){const value:unknown=node.attrs?.careerId;if(typeof value!=='string')throw unsupported();return value;}
 if(editor.type!=='doc')throw unsupported();
 const sections:CareerDocument['sections']=[];
 for(const node of editor.content??[]){
  if(node.type==='heading'){
   if(node.attrs?.level!==2)throw unsupported();
   sections.push({id:id(node),kind:node.attrs?.careerKind,title:(node.content??[]).map(item=>{if(item.type!=='text')throw unsupported();return item.text??'';}).join(''),blocks:[]});continue;
  }
  const section=sections.at(-1);if(!section)throw unsupported();
  if(node.type==='paragraph')section.blocks.push({id:id(node),type:'paragraph',spans:spans(node.content)});
  else if(node.type==='bulletList')section.blocks.push({id:id(node),type:'bullet-list',items:(node.content??[]).map(item=>{if(item.type!=='listItem'||item.content?.length!==1||item.content[0].type!=='paragraph')throw unsupported();return {id:id(item),paragraphId:id(item.content[0]),spans:spans(item.content[0].content)};})});
  else throw unsupported();
 }
 return CareerDocument.parse({schemaVersion:1,sections,layout});
}

import type{CareerDocument}from'../../../../contracts/resume/schema';
type Kind=CareerDocument['sections'][number]['kind'];
export const SOURCE_SECTIONS:{kind:Kind;title:string;fields:{key:string;label:string;textarea?:boolean}[]}[]=[
 {kind:'education',title:'教育经历',fields:[{key:'school',label:'学校'},{key:'degree',label:'学历'},{key:'major',label:'专业'},{key:'startDate',label:'开始时间'},{key:'endDate',label:'结束时间'},{key:'description',label:'描述',textarea:true}]},
 {kind:'experience',title:'实习经历',fields:[{key:'company',label:'公司'},{key:'position',label:'职位'},{key:'startDate',label:'开始时间'},{key:'endDate',label:'结束时间'},{key:'description',label:'描述',textarea:true}]},
 {kind:'project',title:'项目经历',fields:[{key:'name',label:'项目名称'},{key:'role',label:'角色'},{key:'techStack',label:'技术栈'},{key:'startDate',label:'开始时间'},{key:'endDate',label:'结束时间'},{key:'description',label:'描述',textarea:true}]},
 {kind:'skills',title:'专业技能',fields:[{key:'category',label:'分类'},{key:'items',label:'技能条目',textarea:true}]}];
export function entryGroups(section:CareerDocument['sections'][number]){const ids=new Set(section.blocks.flatMap(b=>b.type==='paragraph'&&b.entry?[b.entry.id]:[]));return [...ids].map(id=>({id,blocks:section.blocks.filter(b=>b.type==='paragraph'&&b.entry?.id===id)}));}
export function plainBlock(block:CareerDocument['sections'][number]['blocks'][number]){return block.type==='paragraph'?block.spans.map(s=>s.text).join(''):block.items.map(item=>item.spans.map(s=>s.text).join('')).join('\n');}
/** Source ResumePreview's fixed category order; custom Career headings stay visible.
 * This is a view projection, never a mutation or merge of saved sections. */
export function sourcePreviewSections(content:CareerDocument){
 const categories=[{kind:'summary',title:'个人简介',aliases:['个人简介']},{kind:'education',title:'教育经历',aliases:['教育','教育经历']},{kind:'experience',title:'实习经历',aliases:['经历','实习经历']},{kind:'project',title:'项目经历',aliases:['项目','项目经历']},{kind:'skills',title:'专业技能',aliases:['技能','专业技能']}];
 return categories.flatMap(c=>{const matching=content.sections.filter(s=>s.kind===c.kind),standard=matching.filter(s=>c.aliases.includes(s.title)),custom=matching.filter(s=>!c.aliases.includes(s.title));return [...(standard.length?[{...standard[0],title:c.title,blocks:standard.flatMap(s=>s.blocks)}]:[]),...custom];});
}

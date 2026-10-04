import Database from 'better-sqlite3';
import {existsSync,lstatSync,readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {Alignment,Mark,type Span} from '../../../contracts/resume/schema';
import {LegacyRecord} from './schema';
import {digest} from './source';
export const LiteSelection=z.strictObject({schemaDigest:z.string().regex(/^[a-f0-9]{64}$/),selection:z.array(z.strictObject({hash:z.string().regex(/^[a-f0-9]{64}$/),kind:z.enum(['profile','domain_company','opportunity','resume_document'])})).length(8)});
const fail=()=>new Error('RESUME_LOSSY_CONVERSION');
function decode(text:string){return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/gi,entity=>{const names:Record<string,string>={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':'\u00a0'};if(names[entity])return names[entity];const value=Number.parseInt(entity.slice(entity[2]==='x'?3:2,-1),entity[2]==='x'?16:10);if(!Number.isFinite(value)||value>0x10ffff)throw fail();return String.fromCodePoint(value);});}
/** Closed inline markup converter; unsupported markup fails rather than silently flattening. */
export function liteSpans(value:string):Span[]{
 if(!/<\/?[a-z]/i.test(value))return value?[{text:value,marks:[]}]:[];
 const result:Span[]=[],stack:{tag:string;mark:z.infer<typeof Mark>}[]=[];
 for(const token of value.split(/(<[^>]*>)/g).filter(Boolean)){
  if(!token.startsWith('<')){const text=decode(token);if(text)result.push({text,marks:stack.map(s=>s.mark)});continue;}
  const closing=/^<\/(b|strong|i|em|s|strike|a)\s*>$/i.exec(token);if(closing){if(stack.pop()?.tag!==closing[1].toLowerCase())throw fail();continue;}
  const opening=/^<(b|strong|i|em|s|strike)\s*>$/i.exec(token);
  if(opening){const tag=opening[1].toLowerCase(),type=['b','strong'].includes(tag)?'bold':['i','em'].includes(tag)?'italic':'strike';stack.push({tag,mark:Mark.parse({type})});continue;}
  const link=/^<a\s+href=(?:"([^"]*)"|'([^']*)')\s*>$/i.exec(token);if(link){stack.push({tag:'a',mark:Mark.parse({type:'link',href:decode(link[1]??link[2])})});continue;}
  if(/^<br\s*\/?>$/i.test(token)){result.push({text:'\n',marks:stack.map(s=>s.mark)});continue;}
  throw fail();
 }
 if(stack.length)throw fail();return result;
}
type LegacyDocument={schemaVersion:number;formatting:Record<string,{textAlign?:string}>;sections:{id:string;type:string;title:string;items:Record<string,unknown>[]}[]};
function document(value:unknown){
 const d=value as LegacyDocument;if(d?.schemaVersion!==1||!Array.isArray(d.sections))throw fail();const formatting=d.formatting??{};
 const alignment=(id:string)=>formatting[id]?.textAlign===undefined?{}:{alignment:Alignment.parse(formatting[id].textAlign)};
 const fields:Record<string,string[]>={summary:['content'],skills:['content'],experience:['organization','role','date'],projects:['title','date','responsibility'],education:['school','major','date']};
 const sections=d.sections.map(section=>{
  const ordered=fields[section.type];if(!ordered||typeof section.title!=='string')throw fail();const blocks:Extract<z.infer<typeof LegacyRecord>,{kind:'resume'}>['document']['sections'][number]['blocks']=[];
  for(const item of section.items){if(typeof item.id!=='string'||Object.keys(item).some(key=>!['id','bullets',...ordered].includes(key)))throw fail();
   for(const field of ordered){const text=item[field];if(text===undefined||text==='')continue;if(typeof text!=='string')throw fail();blocks.push({type:'paragraph',id:item.id+':'+field,...(formatting[item.id+':'+field]?alignment(item.id+':'+field):alignment(item.id)),spans:liteSpans(text)});}
   if(item.bullets!==undefined){if(!Array.isArray(item.bullets))throw fail();blocks.push({type:'bullet-list',id:item.id+':bullets',items:item.bullets.map(b=>{if(typeof b.id!=='string'||typeof b.content!=='string'||Object.keys(b).some(k=>!['id','content'].includes(k)))throw fail();return {id:b.id,...alignment(b.id),spans:liteSpans(b.content)};})});}
  }
  return {id:section.id,type:section.type as 'skills',title:section.title,blocks};
 });
 const used=new Set(['profile-name',...d.sections.flatMap(s=>s.items.flatMap(i=>[String(i.id),...fields[s.type].map(f=>i.id+':'+f),...((i.bullets??[]) as {id:string}[]).map(b=>b.id)]))]);
 if(Object.keys(formatting).some(key=>!used.has(key)))throw fail();
 return {schemaVersion:1 as const,...formatting['profile-name']?.textAlign?{identityNameAlignment:Alignment.parse(formatting['profile-name'].textAlign)}:{},sections};
}
/** Explicit current-only read. Never selects config bodies, revisions, records or history. */
export function readLiteSource(filename:string,expectedDigest:string,rawSelection:unknown){
 const selection=LiteSelection.parse(rawSelection);
 if(realpathSync(filename)!==path.resolve(filename)||!lstatSync(filename).isFile()||['-wal','-shm','-journal'].some(s=>existsSync(filename+s)))throw Error('source_snapshot_required');
 if(digest(readFileSync(filename))!==expectedDigest)throw Error('source_digest_changed');
 const db=new Database(filename,{readonly:true,fileMustExist:true,timeout:0});try{
  db.pragma('query_only=ON');if(db.pragma('user_version',{simple:true})!==6||digest(JSON.stringify(db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all()))!==selection.schemaDigest||db.pragma('integrity_check',{simple:true})!=='ok')throw Error('SOURCE_CORRUPT');
  const identities=db.prepare("SELECT id,kind,revision FROM current WHERE kind IN ('profile','domain_company','opportunity','resume_document')").all() as {id:string;kind:string;revision:number}[];
  const selected=selection.selection.map(wanted=>{const matches=identities.filter(r=>r.kind===wanted.kind&&digest(r.id)===wanted.hash);if(matches.length!==1)throw Error('TARGET_IDENTITY_AMBIGUOUS');return matches[0];});
  const kinds=selected.map(r=>r.kind);if(new Set(selected.map(r=>r.id)).size!==8||kinds.filter(k=>k==='profile').length!==1||kinds.filter(k=>k==='domain_company').length!==2||kinds.filter(k=>k==='opportunity').length!==3||kinds.filter(k=>k==='resume_document').length!==2)throw Error('TARGET_IDENTITY_AMBIGUOUS');
  const records=selected.map(row=>{
   const body=db.prepare('SELECT body FROM current WHERE id=? AND kind=?').get(row.id,row.kind) as {body:string};const v=JSON.parse(body.body),base={identity:digest(row.id),revision:row.revision,recordedAt:null};
   if(row.kind==='profile'){if(row.id!=='profile')throw Error('TARGET_IDENTITY_AMBIGUOUS');const b=v.basics,links=[...(b.links??[])];if(b.github)links.push({label:'GitHub',url:b.github});return LegacyRecord.parse({...base,kind:'profile',origin:'primary',basics:{name:b.name??'',phone:b.phone??'',email:b.email??'',wechat:b.wechat??'',links}});}
   if(row.kind==='domain_company')return LegacyRecord.parse({...base,kind:'company',name:v.name});
   if(row.kind==='opportunity')return LegacyRecord.parse({...base,kind:'opportunity',companyIdentity:digest(v.company_id),title:v.title,...v.jd?{jd:v.jd}:{},phase:'resume',result:'active'});
   return LegacyRecord.parse({...base,kind:'resume',opportunityIdentity:digest(v.opportunity_id),document:document(v.document)});
  });
  if(digest(readFileSync(filename))!==expectedDigest)throw Error('source_digest_changed');return {digest:expectedDigest,schemaDigest:selection.schemaDigest,version:6 as const,records};
 }finally{db.close();}
}

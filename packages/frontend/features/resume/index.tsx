import React,{useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useForm} from 'react-hook-form';
import {EditorContent,useEditor,Extension,type Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {Plugin} from '@tiptap/pm/state';
import {closeHistory} from '@tiptap/pm/history';
import type {Request as ResumeRequest,Result as ResumeResult,Profile,CareerDocument,Version} from '../../../contracts/resume/schema';
import {toEditor,fromEditor} from './adapter';
import {createResumeSaveSession} from './save-session';
import './resume.css';
import type {Request as ProfileRequest,Result as ProfileResult} from '../../../contracts/profile/schema';
type Request=ResumeRequest|ProfileRequest;
type Result=ResumeResult|ProfileResult;
type Transport=(request:Request)=>Promise<Result>;
type Opened=Extract<Result,{status:'document'}>;
const stableIds=Extension.create({
 name:'careerStableIds',
 addGlobalAttributes(){return [{types:['heading','paragraph','bulletList','listItem'],attributes:{careerId:{default:null},careerKind:{default:'summary'}}}];},
 addProseMirrorPlugins(){return [new Plugin({appendTransaction(transactions,_old,state){
  if(!transactions.some(transaction=>transaction.docChanged))return null;
  const seen=new Set<string>();const transaction=state.tr;
  state.doc.descendants((node,pos)=>{if(!['heading','paragraph','bulletList','listItem'].includes(node.type.name))return;let id=node.attrs.careerId as string|null;if(!id||seen.has(id)){id=crypto.randomUUID();transaction.setNodeMarkup(pos,undefined,{...node.attrs,careerId:id});}seen.add(id);});
  return transaction.docChanged?transaction:null;
 }})];}
});
const statusLabels={saved:'已保存',dirty:'未保存',saving:'保存中',composition:'正在中文输入，暂不保存',conflict:'保存冲突，保留了你的输入',unknown:'保存结果待核对',failed:'保存失败，保留了你的输入'};
function ProfileFields({profile,request,onSaved,onDirty}:{profile:Profile;request:Transport;onSaved:(profile:Profile)=>void;onDirty:(dirty:boolean)=>void}){
 const form=useForm<{name:string;contact:string;webpage:string}>({defaultValues:{name:profile.name,contact:profile.contact,webpage:profile.links[0]?.href??''}});
 const revision=useRef(profile.revision);
 const [comparison,setComparison]=useState<Profile>();const [notice,setNotice]=useState('');
 const [pending,setPending]=useState<Extract<Request,{operation:'profile.save'}>>();
 useEffect(()=>onDirty(form.formState.isDirty||!!pending),[form.formState.isDirty,pending,onDirty]);
 useEffect(()=>{if(profile.revision===revision.current)return;if(form.formState.isDirty)setComparison(profile);else{revision.current=profile.revision;form.reset({name:profile.name,contact:profile.contact,webpage:profile.links[0]?.href??''});}},[profile,form]);
 async function accept(result:Result){if(result.status==='profile'){revision.current=result.profile.revision;form.reset({name:result.profile.name,contact:result.profile.contact,webpage:result.profile.links[0]?.href??''});setComparison(undefined);setPending(undefined);setNotice('基础资料已保存，所有当前简历使用最新身份');onSaved(result.profile);}else if(result.status==='conflict'){setComparison(result.profile);setPending(undefined);setNotice('基础资料有冲突，保留了你的输入');}else{setPending(undefined);setNotice('未保存：请检查资料及网页链接');}}
 const save=form.handleSubmit(async values=>{if(pending)return;const input:Extract<Request,{operation:'profile.save'}>={operation:'profile.save',commandId:crypto.randomUUID(),expectedRevision:revision.current,name:values.name,contact:values.contact,links:[...(values.webpage?[{label:'个人网页',href:values.webpage}]:[]),...profile.links.slice(1)]};setPending(input);setNotice('基础资料保存中');try{await accept(await request(input));}catch{setNotice('基础资料保存结果待核对');}});
 return <form className="resume-identity" onSubmit={save}>
  <p className="resume-note">身份区属于全局基础资料，修改后同步所有当前简历。</p><fieldset disabled={!!pending}>
  <label>姓名<input aria-label="基础资料姓名" maxLength={120} {...form.register('name')}/></label>
  <label>联系方式<input aria-label="基础资料联系方式" maxLength={500} {...form.register('contact')}/></label>
  <label>个人网页<input aria-label="基础资料个人网页" {...form.register('webpage')}/></label>
  <button type="submit" disabled={!!pending}>保存基础资料</button><span role="status">{notice}</span></fieldset>
  {pending&&(notice.includes('待核对')||notice.includes('未登记')||notice.includes('无法核对'))&&<><button type="button" onClick={async()=>{try{const result=await request({operation:'profile.receipt',commandId:pending.commandId});if(result.status==='not-found'){setNotice('基础资料未登记，可明确继续原命令');}else await accept(result);}catch{setNotice('仍无法核对，保留输入');}}}>核对基础资料保存</button><button type="button" onClick={async()=>{try{await accept(await request(pending));}catch{setNotice('基础资料保存结果待核对');}}}>继续原基础资料命令</button></>}
  {comparison&&<aside><p>当前正式资料：{comparison.name} / {comparison.contact}。你的输入保留在上方。</p><button type="button" onClick={()=>{revision.current=comparison.revision;setComparison(undefined);setNotice('已采用新版本基线，请确认再保存你的输入');}}>以新版本为基线保留输入</button><button type="button" onClick={()=>{revision.current=comparison.revision;form.reset({name:comparison.name,contact:comparison.contact,webpage:comparison.links[0]?.href??''});setComparison(undefined);onSaved(comparison);}}>放弃本地身份输入，采用正式资料</button></aside>}
 </form>;
}
function replaceUndoably(editor:Editor,content:CareerDocument){
 editor.view.dispatch(closeHistory(editor.state.tr));
 const next=editor.schema.nodeFromJSON(toEditor(content));
 editor.view.dispatch(editor.state.tr.replaceWith(0,editor.state.doc.content.size,next.content));
 editor.view.dispatch(closeHistory(editor.state.tr));
}
function ResumeEditor({opened,request,onReturn,active}:{opened:Opened;request:Transport;onReturn?:()=>void;active:boolean}){
 const [,redraw]=useState(0);const transport=useRef(request);transport.current=request;
 const [profile,setProfile]=useState(opened.profile);const [profileDirty,setProfileDirty]=useState(false);
 const resumeTransport=async(input:ResumeRequest):Promise<ResumeResult>=>{const result=await transport.current(input);if(result.status==='profile')throw new Error('unexpected Profile response');return result;};
 const sessionRef=useRef<ReturnType<typeof createResumeSaveSession>|null>(null);
 if(!sessionRef.current)sessionRef.current=createResumeSaveSession({resumeId:opened.document.id,revision:opened.document.revision,profileRevision:opened.profile.revision,content:opened.document.content},resumeTransport,()=>redraw(value=>value+1));
 const session=sessionRef.current;const state=session.state();
 const [error,setError]=useState('');const [formatError,setFormatError]=useState('');const formatErrorRef=useRef('');const [history,setHistory]=useState(false);const [versions,setVersions]=useState<Version[]>([]);const [viewed,setViewed]=useState<Version>();const [historyReadStatus,setHistoryReadStatus]=useState<'unread'|'loading'|'loaded'|'failed'>('unread');const historyReadGeneration=useRef(0);
 const [restoreCommand,setRestoreCommand]=useState<Extract<Request,{operation:'resume.restore'}>>();const [restoreBusy,setRestoreBusy]=useState(false);
 const [naming,setNaming]=useState(false);const [versionName,setVersionName]=useState('');const [namingBusy,setNamingBusy]=useState(false);const [versionCommand,setVersionCommand]=useState<Extract<Request,{operation:'resume.name-version'}>>();
 const [findOpen,setFindOpen]=useState(false);const [find,setFind]=useState('');const [replacement,setReplacement]=useState('');const [overflow,setOverflow]=useState(false);
 function updateFromEditor(updated:Editor){
  try{session.change(fromEditor(updated.getJSON(),session.state().content.layout));formatErrorRef.current='';setFormatError('');setError('');setOverflow(updated.view.dom.scrollHeight>900);}
  catch(cause){const message=cause instanceof Error?cause.message:'当前格式不受支持，未保存';formatErrorRef.current=message;setFormatError(message);}
 }
 const editor=useEditor({injectCSS:false,extensions:[StarterKit.configure({heading:{levels:[2]},code:false,codeBlock:false,blockquote:false,hardBreak:false,horizontalRule:false,orderedList:false,underline:false,link:{openOnClick:false}}),stableIds],content:toEditor(opened.document.content),editorProps:{attributes:{'aria-label':'简历正文','role':'textbox','aria-multiline':'true'},handleDOMEvents:{compositionstart:()=>{session.composition(true);return false;},compositionend:()=>{setTimeout(()=>{session.composition(false);if(editor)updateFromEditor(editor);},0);return false;}}},onUpdate:({editor:updated})=>updateFromEditor(updated)});
 const queryClient=useQueryClient();
 const profileQuery=useQuery({queryKey:['resume',opened.document.opportunityId,'profile'],queryFn:async()=>{const result=await transport.current({operation:'profile.read'});if(result.status!=='profile')throw new Error('基础资料读取失败');return result.profile;},initialData:opened.profile,refetchInterval:5000,retry:false});
 useEffect(()=>{if(profileQuery.data.revision!==profile.revision){setProfile(profileQuery.data);session.profileRevision(profileQuery.data.revision);}},[profileQuery.data,profile.revision,session]);
 useEffect(()=>{if(state.status!=='dirty'||formatError)return;const timer=setTimeout(()=>{if(!formatErrorRef.current)void session.flush();},650);return()=>clearTimeout(timer);},[state.content,state.status,formatError,session]);
 useEffect(()=>{const protect=(event:BeforeUnloadEvent)=>{if(session.state().status!=='saved'||formatErrorRef.current||profileDirty||restoreCommand||versionCommand){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[session,profileDirty,restoreCommand,versionCommand]);
 useEffect(()=>()=>session.dispose(),[session]);
 useEffect(()=>{const shortcut=(event:KeyboardEvent)=>{if(!active||restoreCommand||!event.metaKey||event.isComposing||session.state().status==='composition')return;if(event.key.toLowerCase()==='s'){event.preventDefault();setNaming(true);}if(event.key.toLowerCase()==='f'){event.preventDefault();setFindOpen(true);}};window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);},[session,restoreCommand,active]);
 async function stableSave(){for(let tries=0;tries<4;tries++){if(formatErrorRef.current)return false;if(await session.flush())return !formatErrorRef.current;if(session.state().status!=='dirty')return false;}return false;}
 async function refreshHistory(){
  const generation=++historyReadGeneration.current;setHistoryReadStatus('loading');
  try{const result=await request({operation:'resume.versions',resumeId:opened.document.id});if(generation!==historyReadGeneration.current)return;if(result.status==='versions'){setVersions(result.versions);setHistoryReadStatus('loaded');}else setHistoryReadStatus('failed');}
  catch{if(generation===historyReadGeneration.current)setHistoryReadStatus('failed');}
 }
 async function finishVersion(result:Result){if(result.status==='version'){setNaming(false);setVersionName('');setVersionCommand(undefined);await refreshHistory();setError('命名版本及 PDF 已冻结保存');editor?.commands.focus();}else if(result.status==='conflict'){session.compare({status:'conflict',profile:result.profile,...('document' in result?{document:result.document}:{})});setVersionCommand(undefined);}else if(result.status==='pending-job'){setError('PDF 正在生成，尚未完成命名版本');}else{setError('版本生成失败，未产生完成版本；当前稿仍保留');setVersionCommand(undefined);}}
 async function nameVersion(){if(profileDirty){setError('请先保存基础资料的未提交输入，再冻结版本');return;}if(restoreCommand||namingBusy||versionCommand||!versionName.trim())return;if(!await stableSave()){setError('请先结束中文输入并解决当前稿保存状态');return;}const current=session.state();const input:Extract<Request,{operation:'resume.name-version'}>={operation:'resume.name-version',commandId:crypto.randomUUID(),resumeId:opened.document.id,expectedRevision:current.revision,expectedProfileRevision:current.profileRevision,name:versionName.trim()};setVersionCommand(input);setNamingBusy(true);try{await finishVersion(await request(input));}catch{setError('命名版本结果待核对，请核对原命令');}finally{setNamingBusy(false);}}
 async function finishRestore(result:Result){
  if(!editor)return;
  if(result.status==='document'){
   replaceUndoably(editor,result.document.content);session.adopted(result.document.content,result.document.revision,result.profile.revision);setProfile(result.profile);setViewed(undefined);setRestoreCommand(undefined);editor.setEditable(true,false);setError('已恢复正文；此替换可以撤销');
  }else if(result.status==='conflict'){session.compare({status:'conflict',profile:result.profile,...('document' in result?{document:result.document}:{})});setRestoreCommand(undefined);editor.setEditable(true);}
  else if(result.status==='not-found'){setError('恢复命令尚未登记，可明确继续原恢复命令');}
  else{setError('未恢复，当前正文保留');setRestoreCommand(undefined);editor.setEditable(true);}
 }
 async function restore(version:Version){
  if(restoreCommand||!editor||!await stableSave()){setError('恢复前请先完成当前稿保存');return;}
  if(!window.confirm('恢复此版本的正文与布局？当前基础资料保持最新。'))return;
  const current=session.state();const input:Extract<Request,{operation:'resume.restore'}>={operation:'resume.restore',commandId:crypto.randomUUID(),resumeId:opened.document.id,versionId:version.id,expectedRevision:current.revision,expectedProfileRevision:current.profileRevision};
  setRestoreCommand(input);setRestoreBusy(true);editor.setEditable(false);
  try{await finishRestore(await request(input));}catch{setError('恢复结果待核对；编辑暂受保护，请核对原命令。');}finally{setRestoreBusy(false);}
 }
 function findNext(replace:boolean){if(!editor||!find||state.status==='composition'||restoreCommand)return;let match:{from:number;to:number}|undefined;editor.state.doc.descendants((node,pos)=>{if(match||!node.isText||!node.text)return;const offset=node.text.indexOf(find);if(offset>=0)match={from:pos+offset,to:pos+offset+find.length};});if(!match){setError('当前文稿没有找到该文字');return;}editor.chain().focus().setTextSelection(match).run();if(replace)editor.view.dispatch(editor.state.tr.insertText(replacement,match.from,match.to));}
 return <section className="resume-feature">
  <header><h1>{opened.opportunity.companyName} · {opened.opportunity.role} 的简历</h1>{onReturn&&<button onClick={onReturn}>返回所属机会</button>}<p role="status" data-testid="resume-save-state">{formatError?'格式不受支持，当前输入未保存':statusLabels[state.status]}</p><p className="resume-note">自动保存只保存当前稿；命名版本才冻结正文、身份和 PDF。</p></header>
  <div className="resume-toolbar" aria-label="简历格式工具">
   <button disabled={!editor||state.status==='composition'||!!restoreCommand} onMouseDown={event=>event.preventDefault()} onClick={()=>editor?.chain().focus().toggleBold().run()}>加粗</button>
   <button disabled={!editor||state.status==='composition'||!!restoreCommand} onMouseDown={event=>event.preventDefault()} onClick={()=>editor?.chain().focus().toggleItalic().run()}>斜体</button>
   <button disabled={!editor||state.status==='composition'||!!restoreCommand} onMouseDown={event=>event.preventDefault()} onClick={()=>editor?.chain().focus().toggleBulletList().run()}>要点列表</button>
   <button disabled={!editor||state.status==='composition'||!!restoreCommand} onClick={()=>editor?.chain().focus().undo().run()}>撤销</button><button disabled={!editor||state.status==='composition'||!!restoreCommand} onClick={()=>editor?.chain().focus().redo().run()}>重做</button>
   <button onClick={()=>setFindOpen(value=>!value)}>查找替换</button><button disabled={state.status==='composition'||!!restoreCommand} onClick={()=>setNaming(true)}>命名版本（⌘S）</button>
   <button onClick={()=>{setHistory(value=>!value);void refreshHistory();}}>版本历史</button>
   <label>字号<select disabled={state.status==='composition'||!!restoreCommand} aria-label="简历字号" value={state.content.layout.fontSize} onChange={event=>session.change({...state.content,layout:{...state.content.layout,fontSize:Number(event.target.value)}})}>{[10,11,12,13,14].map(size=><option key={size}>{size}</option>)}</select></label>
  </div>
  {findOpen&&<div className="resume-panel"><label>查找<input autoFocus value={find} onChange={event=>setFind(event.target.value)}/></label><label>替换为<input value={replacement} onChange={event=>setReplacement(event.target.value)}/></label><button onClick={()=>findNext(false)}>定位</button><button onClick={()=>findNext(true)}>替换一处</button><button onClick={()=>{setFindOpen(false);editor?.commands.focus();}}>关闭查找</button></div>}
  {state.status==='unknown'&&<aside><button onClick={()=>void session.verify()}>核对原保存命令</button><button onClick={()=>void session.continueOriginal()}>明确继续原保存</button></aside>}
  {state.status==='failed'&&<aside><p>保存未成功，当前编辑内容保留。</p><button onClick={async()=>{try{const result=await request({operation:'resume.read',resumeId:opened.document.id});if(result.status==='document')session.compare({status:'conflict',profile:result.profile,document:result.document});else setError('当前正式稿暂不可读，保留你的输入');}catch{setError('当前正式稿读取失败，保留你的输入');}}}>比较后重新保存</button></aside>}
  {state.comparison&&<aside><p>当前正式正文如下；你的当前稿仍在纸面上。</p><pre>{state.comparison.document?.content.sections.map(section=>section.title+'\n'+section.blocks.map(block=>block.type==='paragraph'?block.spans.map(span=>span.text).join(''):block.items.map(item=>item.spans.map(span=>span.text).join('')).join('\n')).join('\n')).join('\n\n')}</pre><button onClick={()=>session.useComparisonRevision()}>确认以正式版本为基线保存我的输入</button><button onClick={()=>{const current=state.comparison;if(current?.document&&editor){replaceUndoably(editor,current.document.content);session.adopted(current.document.content,current.document.revision,current.profile.revision);}}}>放弃本地正文，采用正式正文</button></aside>}
  {restoreCommand&&!restoreBusy&&<aside><p>恢复结果待核对，当前正文仍保留。为避免覆盖，核对前暂停正文编辑。</p><button onClick={async()=>{try{await finishRestore(await request({operation:'resume.receipt',commandId:restoreCommand.commandId}));}catch{setError('恢复结果仍无法核对');}}}>核对原恢复命令</button><button onClick={async()=>{setRestoreBusy(true);try{await finishRestore(await request(restoreCommand));}catch{setError('恢复结果待核对');}finally{setRestoreBusy(false);}}}>明确继续原恢复命令</button></aside>}
  {formatError&&<p role="alert">{formatError}</p>}{error&&<p role="alert">{error}</p>}{historyReadStatus==='failed'&&<aside><p role="alert">版本历史读取失败，缓存可能不完整；已保存的版本保持不变。</p><button onClick={()=>void refreshHistory()}>重新读取版本历史</button></aside>}{historyReadStatus==='loading'&&<p role="status">正在读取版本历史…</p>}{overflow&&<p>正文超过一页 A4；导出将自动分页，请检查 PDF 页数。</p>}
  <article className={`resume-paper resume-font-${state.content.layout.fontSize}`}>
   <ProfileFields profile={profile} request={request} onDirty={setProfileDirty} onSaved={current=>{setProfile(current);session.profileRevision(current.revision);queryClient.setQueryData(['resume',opened.document.opportunityId,'profile'],current);}}/>
   <EditorContent editor={editor}/>
  </article>
  {history&&<aside className="resume-panel"><h2>命名版本历史</h2>{historyReadStatus==='loaded'&&versions.length===0&&<p>尚未创建命名版本。</p>}{versions.map(version=><button key={version.id} onClick={()=>setViewed(version)}>{version.name}</button>)}<button onClick={()=>{setHistory(false);setViewed(undefined);editor?.commands.focus();}}>关闭历史</button>{viewed&&<div><h3>{viewed.name}（冻结版本）</h3><p>{viewed.snapshot.profile.name} · {viewed.snapshot.profile.contact}</p>{viewed.snapshot.content.sections.map(section=><section key={section.id}><h4>{section.title}</h4>{section.blocks.map(block=><p key={block.id}>{block.type==='paragraph'?block.spans.map(span=>span.text).join(''):block.items.map(item=>item.spans.map(span=>span.text).join('')).join(' / ')}</p>)}</section>)}<p>对应 PDF 已保留，{viewed.pdf.size} 字节；源正文不会被当前编辑改写。</p><button onClick={()=>void restore(viewed)}>恢复此版本正文</button><button onClick={()=>{setViewed(undefined);editor?.commands.focus();}}>取消查看 / 恢复</button></div>}</aside>}
  {naming&&<div className="resume-panel" role="dialog" aria-modal="true" aria-label="命名简历版本" onKeyDown={event=>{if(event.key==='Tab'){const elements=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)'));const first=elements[0];const last=elements.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}if(event.key==='Escape'&&!namingBusy){setNaming(false);editor?.commands.focus();}}}><h2>命名版本</h2><label>版本名称<input disabled={namingBusy||!!versionCommand} autoFocus maxLength={120} value={versionName} onChange={event=>setVersionName(event.target.value)}/></label><button disabled={namingBusy||!!versionCommand} onClick={()=>void nameVersion()}>保存版本及 PDF</button>{versionCommand&&!namingBusy&&<><button onClick={async()=>{try{await finishVersion(await request({operation:'resume.receipt',commandId:versionCommand.commandId}));}catch{setError('仍无法核对版本结果');}}}>核对版本结果</button><button onClick={async()=>{setNamingBusy(true);try{await finishVersion(await request(versionCommand));}catch{setError('版本结果待核对');}finally{setNamingBusy(false);}}}>继续原冻结版本生成</button></>}<button disabled={namingBusy} onClick={()=>{setNaming(false);editor?.commands.focus();}}>关闭，保留当前稿</button></div>}
 </section>;
}
/** Nested Opportunity view. Keeping this component mounted retains independent editor sessions. */
export function ResumePage({request,profileRequest,opportunityId,onReturn,active=true}:{request:(input:ResumeRequest)=>Promise<ResumeResult>;profileRequest:(input:ProfileRequest)=>Promise<ProfileResult>;opportunityId:string;onReturn?:()=>void;active?:boolean}){
 const dispatch:Transport=input=>input.operation==='profile.read'||input.operation==='profile.save'||input.operation==='profile.receipt'?profileRequest(input):request(input);
 const [documents,setDocuments]=useState<Record<string,Opened>>({});const [error,setError]=useState('');const transport=useRef(dispatch);transport.current=dispatch;
 useEffect(()=>{let active=true;if(documents[opportunityId])return;setError('');void transport.current({operation:'resume.open',commandId:crypto.randomUUID(),opportunityId}).then(result=>{if(!active)return;if(result.status==='document')setDocuments(current=>({...current,[opportunityId]:result}));else setError('无法打开指定机会的简历，请返回所属机会。');}).catch(()=>{if(active)setError('简历打开结果待核对，请返回机会后重新打开原对象。');});return()=>{active=false;};},[opportunityId,documents]);
 return <>{error&&<p role="alert">{error}</p>}{!documents[opportunityId]&&!error&&<p>正在读取简历…</p>}{Object.entries(documents).map(([id,opened])=><div key={id} hidden={id!==opportunityId}><ResumeEditor opened={opened} request={dispatch} onReturn={onReturn} active={active&&id===opportunityId}/></div>)}</>;
}

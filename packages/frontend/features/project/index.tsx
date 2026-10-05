import {wasPurged,type PurgeNotice} from '../../design-system/purge-notice';
import {useState,useEffect,useRef,useLayoutEffect} from 'react';
import {useForm} from 'react-hook-form';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import type {Request as EmploymentRequest,Result as EmploymentResult} from '../../../contracts/employment/schema';
import type {Project,Result,Request} from '../../../contracts/project/schema';
import type {ProjectRequest} from './commands';
import {useProjectCommands} from './useProjectCommands';
import {ChangeControls,displayTime,emptyChange,type ChangeContext} from './ChangeControls';
export type ProjectPageProps={focusProject?:{id:string;sequence:number};onOpenWiki?:(id:string)=>void;purgeNotice?:PurgeNotice;request:ProjectRequest;relationEpoch?:number;employmentRequest?:(input:EmploymentRequest)=>Promise<EmploymentResult>};
const labels={inprogress:'进行中',paused:'暂停',completed:'完成',cancelled:'取消'};
const actionLabels={created:'创建项目',edited:'维护项目',state_changed:'状态变化',reopened:'真实重新推进',associated:'任职关联变化',joined:'加入项目',rejoined:'重新加入',left:'退出项目',role_changed:'项目职责变化'};
const parseTags=(value:string)=>value.split(/[,，]/).map(item=>item.trim()).filter(Boolean);
type Fields={name:string;description:string;tags:string};
function EmploymentOptions({employmentRequest}:Pick<ProjectPageProps,'employmentRequest'>){
 const query=useQuery({queryKey:['employments'],enabled:!!employmentRequest,retry:false,queryFn:async()=>{
  const result=await employmentRequest!({operation:'list'});if(result.kind!=='list')throw new Error('read_failed');return result;
 }});
 return <>{query.data?.employments.filter(item=>item.status==='current').map(item=><option key={item.id} value={item.id}>{item.company} · {item.role}</option>)}</>;
}
function CreateProject({request,employmentRequest,onCreated}:ProjectPageProps&{onCreated:(id:string)=>void}){
 const form=useForm<Fields>({defaultValues:{name:'',description:'',tags:''}});
 const [employmentId,setEmploymentId]=useState('');
 const commands=useProjectCommands(request,result=>{if(result.kind==='project'){onCreated(result.project.id);form.reset();setEmploymentId('');commands.markClean();}});
 return <form onChange={commands.markDirty} onSubmit={form.handleSubmit(values=>commands.save({operation:'create',commandId:crypto.randomUUID(),name:values.name,description:values.description,tags:parseTags(values.tags),employmentId:employmentId||null,occurredAt:{kind:'unknown'}}))}>
  <fieldset disabled={commands.blocked}><h3>创建独立项目</h3>
  <label>项目名称<input {...form.register('name',{required:true,maxLength:300})}/></label>
  <label>描述<textarea {...form.register('description',{maxLength:12000})}/></label>
  <label>自由标签（逗号分隔）<input {...form.register('tags')}/></label>
  <label>关联任职<select aria-label="关联任职" value={employmentId} onChange={event=>setEmploymentId(event.target.value)}><option value="">个人项目（不关联任职）</option><EmploymentOptions employmentRequest={employmentRequest}/></select></label>
  <button disabled={commands.blocked}>创建项目</button></fieldset>{commands.status}
 </form>;
}
function ProjectEditor({id,request,employmentRequest,relationEpoch,onOpenWiki}:ProjectPageProps&{id:string}){
 const client=useQueryClient();
 const query=useQuery({queryKey:['project',id],retry:false,queryFn:async()=>{
  const result=await request({operation:'read',id});if(result.kind!=='project')throw new Error('read_failed');return result;
 }});
 const observedEpoch=useRef(relationEpoch);
 useEffect(()=>{if(observedEpoch.current===relationEpoch)return;observedEpoch.current=relationEpoch;void client.invalidateQueries({queryKey:['project',id]});},[relationEpoch,client,id]);
 if(query.isPending)return <p>读取项目中</p>;
 if(!query.data)return <p role="alert">指定项目暂时无法打开。<button onClick={()=>void query.refetch()}>重新读取项目</button></p>;
 return <>{query.isError&&<p role="alert">已保存、暂时未刷新，当前输入保留。<button onClick={()=>void query.refetch()}>重新读取</button></p>}
  <ProjectDetails onOpenWiki={onOpenWiki} value={query.data} request={request} employmentRequest={employmentRequest} onSaved={value=>{
   client.setQueryData(['project',id],value);void client.invalidateQueries({queryKey:['projects']});void client.invalidateQueries({queryKey:['project',id]});
  }}/>
 </>;
}
function PersonSelector({employmentId,employmentRequest,value,onChange}:Pick<ProjectPageProps,'employmentRequest'>&{employmentId:string|null;value:string;onChange:(id:string)=>void}){
 const query=useQuery({queryKey:['employment',employmentId],enabled:!!employmentId&&!!employmentRequest,retry:false,queryFn:async()=>{
  const result=await employmentRequest!({operation:'read',id:employmentId!});if(result.kind!=='employment')throw new Error('read_failed');return result;
 }});
 return <>
  <label>当前任职人物<select aria-label="当前任职人物" value={value} onChange={event=>onChange(event.target.value)}><option value="">请选择已确认人物</option>{query.data?.people.map((person,index)=><option key={person.id} value={person.id}>{person.name} · {person.role||'未填任职角色'} · 第{index+1}位</option>)}</select></label>
  {query.isError&&<p role="alert">人物列表暂时不可读。<button type="button" onClick={()=>void query.refetch()}>重新读取人物</button></p>}
 </>;
}
function ProjectDetails({value,request,employmentRequest,onSaved,onOpenWiki}:ProjectPageProps&{value:Extract<Result,{kind:'project'}>;onSaved:(value:Extract<Result,{kind:'project'}>)=>void}){
 const project=value.project;const [editing,setEditing]=useState(false),[advanced,setAdvanced]=useState(false);
 const form=useForm<Fields>({defaultValues:{name:project.name,description:project.description,tags:project.tags.join(', ')}});
 const [revision,setRevision]=useState(project.revision);
 const [change,setChange]=useState<ChangeContext>(emptyChange);
 const [stateChoice,setStateChoice]=useState(project.state);
 const [association,setAssociation]=useState(project.employmentId??'');
 const [personId,setPersonId]=useState('');const [projectRole,setProjectRole]=useState('');
 const [selectedParticipation,setSelectedParticipation]=useState('');const [roleDraft,setRoleDraft]=useState('');
 const [history,setHistory]=useState<Extract<Result,{kind:'history'}>>();const [historyError,setHistoryError]=useState('');
 const submittedAction=useRef<Request|undefined>(undefined);
 const commands=useProjectCommands(request,result=>{if(result.kind==='project'){
  const action=submittedAction.current?.operation;
  if(action==='state.change'||action==='reopen')setStateChoice(result.project.state);
  if(action==='associate')setAssociation(result.project.employmentId??'');
  if(action==='participant.join'){setPersonId('');setProjectRole('');}
  if(action==='participant.edit'||action==='participant.leave')setRoleDraft(result.participants.find(item=>item.id===selectedParticipation)?.projectRole??'');
  setChange(emptyChange);setRevision(result.project.revision);onSaved(result);commands.markClean();
 }});
 const common=()=>({commandId:crypto.randomUUID(),id:project.id,expectedRevision:revision,...change});
 const [actionError,setActionError]=useState('');
 function save(command:Request){
  const fields=form.getValues();
  const contentDirty=fields.name.trim()!==project.name||fields.description!==project.description||JSON.stringify(parseTags(fields.tags))!==JSON.stringify(project.tags);
  if(command.operation!=='edit'&&contentDirty){setActionError('请先保存项目内容，再执行状态、关联或协作动作；当前输入仍保留。');return;}
  const selected=value.participants.find(item=>item.id===selectedParticipation);
  const roleDirty=roleDraft!==(selected?.projectRole??'');
  const joinDirty=personId!==''||projectRole!=='';
  const associationDirty=association!==(project.employmentId??'');
  const stateDirty=stateChoice!==project.state;
  const unrelatedDirty=(roleDirty&&command.operation!=='participant.edit')
   ||(joinDirty&&command.operation!=='participant.join')
   ||(associationDirty&&command.operation!=='associate')
   ||(stateDirty&&command.operation!=='state.change'&&command.operation!=='reopen');
  if(unrelatedDirty){setActionError('请先保存或清理其他未提交的状态、关联或协作输入；它们仍保留。');return;}
  submittedAction.current=command;setActionError('');commands.save(command);
 }
 async function readHistory(){try{
  const result=await request({operation:'history',id:project.id});if(result.kind!=='history')throw new Error('history_failed');setHistory(result);setHistoryError('');
 }catch{setHistoryError('历史暂时不可读，可重新读取。');}}
 function selectParticipation(id:string){
  const selected=value.participants.find(item=>item.id===selectedParticipation);
  if(id!==selectedParticipation&&roleDraft!==(selected?.projectRole??'')&&!window.confirm('切换参与关系会放弃当前未保存的项目职责，是否继续？'))return;
  const participation=value.participants.find(item=>item.id===id);setSelectedParticipation(id);setRoleDraft(participation?.projectRole??'');
 }
 const conflict=commands.state?.status==='known'&&commands.state.result.kind==='failure'&&commands.state.result.code==='conflict'?commands.state.result.current:undefined;
 return <section>
  <h3>{project.name}</h3><p>{labels[project.state]} · {project.stateNote}</p>
  <p>当前归属：{project.employmentId?value.employment?`${value.employment.company} · ${value.employment.role}`:'原关联任职目前不可读':'个人项目'}</p>
  <div className="readable-body">{project.description||'还没有项目描述，可以在编辑时补充。'}</div><p>{project.tags.join(' · ')}</p><h4>相关人物</h4>{value.participants.filter(person=>person.active&&person.contextId===project.contextId).length===0?<p>尚未记录协作人物。</p>:<ul>{value.participants.filter(person=>person.active&&person.contextId===project.contextId).map(person=><li key={person.id}>{person.person?.name??'原人物目前不可读'} · {person.projectRole||person.person?.role||'未填写职责'}</li>)}</ul>}{onOpenWiki&&<button onClick={()=>onOpenWiki(project.id)}>查看相关 Wiki 资料</button>}
  <div className="page-actions"><button className="primary-action" onClick={()=>setEditing(true)}>编辑项目</button><button onClick={()=>setAdvanced(value=>!value)} aria-expanded={advanced}>更多：状态、任职与参与关系</button></div>
  {editing&&<button onClick={()=>setEditing(false)}>返回项目阅读（保留输入）</button>}
  <fieldset hidden={!editing&&!advanced} disabled={commands.blocked}><div hidden={!editing}><form onChange={commands.markDirty} onSubmit={form.handleSubmit(fields=>save({operation:'edit',...common(),name:fields.name,description:fields.description,tags:parseTags(fields.tags)}))}>
   <h4>维护项目（完成后仍可维护）</h4>
   <label>项目名称<input {...form.register('name',{required:true,maxLength:300})}/></label>
   <label>描述<textarea {...form.register('description',{maxLength:12000})}/></label>
   <label>自由标签（逗号分隔）<input {...form.register('tags')}/></label>
   <button disabled={commands.blocked}>保存项目内容</button>
  </form></div>
  <div onChange={commands.markDirty}><ChangeControls value={change} onChange={setChange}/><div hidden={!advanced}>
   <label>项目状态<select aria-label="项目状态" value={stateChoice} onChange={event=>setStateChoice(event.target.value as Project['state'])}>{Object.entries(labels).map(([state,label])=><option key={state} value={state}>{label}</option>)}</select></label>
   <button disabled={commands.blocked} onClick={()=>save({operation:'state.change',...common(),state:stateChoice})}>记录状态变化或纠错</button>
   {(project.state==='completed'||project.state==='cancelled')&&<button disabled={commands.blocked} onClick={()=>save({operation:'reopen',commandId:crypto.randomUUID(),id:project.id,expectedRevision:revision,reason:change.reason,occurredAt:change.occurredAt})}>真实重新推进同一项目</button>}
   <h4>当前任职关联</h4>
   <p>变更任职或改为个人项目后，原协作者及职责会明确转为历史；不会自动迁移同名人物。</p>
   <label>新的关联任职<select aria-label="新的关联任职" value={association} onChange={event=>setAssociation(event.target.value)}><option value="">个人项目（不关联任职）</option><EmploymentOptions employmentRequest={employmentRequest}/></select></label>
   <button disabled={commands.blocked} onClick={()=>save({operation:'associate',...common(),employmentId:association||null})}>确认变更任职关联</button>
   <h4>当前协作与历史语境</h4>
   <button type="button" onClick={()=>{setStateChoice(project.state);setAssociation(project.employmentId??'');setPersonId('');setProjectRole('');setRoleDraft(value.participants.find(item=>item.id===selectedParticipation)?.projectRole??'');}}>放弃未提交的状态、关联和协作输入（保留项目正文）</button>
   <ul>{value.participants.map(participant=><li key={participant.id}>
    {participant.person?.name??'原人物目前不可读'} · 原任职语境：{participant.employment?.company??'原任职目前不可读'} · 当前任职职务：{participant.person?.role??'不可读'} · 项目职责：{participant.projectRole||'未填写'} · {participant.active&&participant.contextId===project.contextId?'当前协作':'历史协作'}
   </li>)}</ul>
   {project.employmentId&&<>
    <PersonSelector employmentId={project.employmentId} employmentRequest={employmentRequest} value={personId} onChange={setPersonId}/>
    <label>新参与的项目职责<input value={projectRole} maxLength={1000} onChange={event=>setProjectRole(event.target.value)}/></label>
    <button disabled={commands.blocked||!personId} onClick={()=>save({operation:'participant.join',...common(),personId,projectRole})}>确认加入或重新加入项目</button>
   </>}
   <label>维护参与关系<select aria-label="维护参与关系" value={selectedParticipation} onChange={event=>selectParticipation(event.target.value)}><option value="">请选择参与关系</option>{value.participants.map((participant,index)=><option key={participant.id} value={participant.id}>{participant.person?.name??'原人物'} · {participant.projectRole} · {participant.active&&participant.contextId===project.contextId?'当前':'历史'} · 第{index+1}条</option>)}</select></label>
   <label>参与关系的项目职责<input value={roleDraft} maxLength={1000} onChange={event=>setRoleDraft(event.target.value)}/></label>
   <button disabled={commands.blocked||!selectedParticipation} onClick={()=>save({operation:'participant.edit',...common(),participationId:selectedParticipation,projectRole:roleDraft})}>保存项目职责</button>
   <button disabled={commands.blocked||!selectedParticipation} onClick={()=>save({operation:'participant.leave',...common(),participationId:selectedParticipation})}>记录退出或纠正参与</button>
  </div></div>
  </fieldset>{actionError&&<p role="alert">{actionError}</p>}{(editing||advanced||commands.state)&&commands.status}
  {conflict&&<div>
   <p>当前服务器状态：{labels[conflict.state]}。本地名称、描述和输入仍保留。</p>
   <button disabled={commands.blocked} onClick={()=>setRevision(conflict.revision)}>保留本地输入，按最新版本重新保存</button>
   <button disabled={commands.blocked} onClick={()=>{form.reset({name:conflict.name,description:conflict.description,tags:conflict.tags.join(', ')});setAssociation(conflict.employmentId??'');setStateChoice(conflict.state);setRevision(conflict.revision);setChange(emptyChange);setPersonId('');setProjectRole('');setSelectedParticipation('');setRoleDraft('');commands.markClean();}}>放弃本地修改，使用当前项目</button>
  </div>}
  <details><summary>历史与技术详情</summary><button onClick={()=>void readHistory()}>查看项目与协作历史</button>{historyError&&<p role="alert">{historyError}</p>}
  {history&&<ol>{history.history.map(item=><li key={item.revision}>
   {actionLabels[item.action]} · {item.mode==='correction'?'纠错':item.mode==='change'?'真实变化':'录入'} · {item.reason} · {labels[item.project.state]} · 实际时间 {displayTime(item.occurredAt)} · 录入 {item.recordedAt}
   <ul>{item.participants.map(participant=><li key={participant.id}>协作者：{value.participants.find(current=>current.id===participant.id)?.person?.name??'原人物目前不可读'} · 当时项目职责：{participant.projectRole} · {participant.active?'当时参与':'已转历史'}</li>)}</ul>
  </li>)}</ol>}
  <details><summary>查看技术详情</summary><pre>{JSON.stringify({id:project.id,revision:project.revision,contextId:project.contextId},null,2)}</pre></details></details>
 </section>;
}
export function ProjectPage({purgeNotice,request,employmentRequest,relationEpoch,onOpenWiki,focusProject}:ProjectPageProps){
 const client=useQueryClient();const [selected,setSelected]=useState<string>();const [opened,setOpened]=useState<string[]>([]);const [creating,setCreating]=useState(false);
 const [search,setSearch]=useState(''),[stateFilter,setStateFilter]=useState('all');
 const listPosition=useRef<{left:number;top:number}|undefined>(undefined),details=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{if(selected)details.current?.scrollIntoView({block:'start'});else if(listPosition.current)window.scrollTo(listPosition.current);},[selected]);
 const observedEpoch=useRef(relationEpoch);
 useEffect(()=>{if(observedEpoch.current===relationEpoch)return;observedEpoch.current=relationEpoch;void client.invalidateQueries({queryKey:['projects']});void client.invalidateQueries({queryKey:['employments']});void client.invalidateQueries({queryKey:['employment']});},[relationEpoch,client]);
 const list=useQuery({queryKey:['projects'],retry:false,queryFn:async()=>{const result=await request({operation:'list'});if(result.kind!=='list')throw new Error('read_failed');return result;}});
 useEffect(()=>{if(!purgeNotice)return;const removed=opened.filter(id=>wasPurged(purgeNotice,'project',id));setOpened(old=>old.filter(id=>!removed.includes(id)));if(selected&&removed.includes(selected))setSelected(undefined);void list.refetch();},[purgeNotice?.sequence]);
 useEffect(()=>{if(focusProject)open(focusProject.id);},[focusProject?.sequence]);
 function open(id:string){listPosition.current={left:window.scrollX,top:window.scrollY};setSelected(id);setOpened(old=>old.includes(id)?old:[...old,id]);}
 return <section aria-label="项目" data-feedback-owner="project" data-feedback-id={selected}>
  <h1>项目</h1><p>记录你实际做过或正在做的项目。</p><div hidden={!!selected&&!creating}><button onClick={()=>setCreating(value=>!value)}>{creating?'收起新增（保留输入）':'新建项目'}</button>
  <div hidden={!creating}><CreateProject request={request} employmentRequest={employmentRequest} onCreated={id=>{setCreating(false);open(id);void client.invalidateQueries({queryKey:['projects']});}}/></div>
  {list.isError&&<p role="alert">项目列表暂时未刷新。<button onClick={()=>void list.refetch()}>重新读取列表</button></p>}
  <label>搜索项目<input value={search} onChange={e=>setSearch(e.target.value)} maxLength={300}/></label><label>项目状态筛选<select value={stateFilter} onChange={e=>setStateFilter(e.target.value)}><option value="all">全部</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
  <ul aria-label="项目列表" style={{maxHeight:'60vh',overflowY:'auto'}}>{list.data?.projects.filter(project=>(stateFilter==='all'||project.state===stateFilter)&&project.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(project=><li key={project.id}><button onClick={()=>open(project.id)}>{project.name} · {labels[project.state]} · {project.employment?.company??(project.employmentId?'关联任职目前不可读':'个人项目')}</button></li>)}</ul>
  {list.data&&list.data.projects.length>0&&!list.data.projects.some(project=>(stateFilter==='all'||project.state===stateFilter)&&project.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))&&<p>没有符合筛选条件的项目</p>}
  {!selected&&list.data?.projects.length===0&&<p>记下做过或正在做的一件事。个人项目不用先建任职。</p>}
  </div>{selected&&<button onClick={()=>setSelected(undefined)}>返回项目列表（保留输入）</button>}
  {opened.map(id=><div key={id} ref={id===selected?details:undefined} hidden={id!==selected}><ProjectEditor onOpenWiki={onOpenWiki} id={id} request={request} employmentRequest={employmentRequest} relationEpoch={relationEpoch}/></div>)}
 </section>;
}

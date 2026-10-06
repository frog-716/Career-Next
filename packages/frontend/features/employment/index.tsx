import {NavigationIcon} from '../../design-system/NavigationIcon';
import {wasPurged,type PurgeNotice} from '../../design-system/purge-notice';
import { useState,useEffect,type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery,useQueryClient,useMutation } from '@tanstack/react-query';
import { BusinessTime } from '../../../contracts/common/business-time';
import type { Employment,Person,Request,Result } from '../../../contracts/employment/schema';
import { submitEmploymentCommand,checkEmploymentCommand,employmentLifecycleCanProceed,type EmploymentRequest,type CommandState } from './commands';
export type PageProps={renderProjects?:(employmentId:string,personId?:string)=>ReactNode;onOpenWiki?:(owner:'employment'|'person',id:string)=>void;purgeNotice?:PurgeNotice;request:EmploymentRequest};
function displayTime(time:BusinessTime):string {return time.kind==='unknown'?'未知':time.kind==='date'?time.date:`${time.instant}（${time.timezone}）`;
}
function TimeInput({label,value,onChange}:{label:string;
value:BusinessTime;
onChange:(value:BusinessTime)=>void}) {
 return <fieldset>
<legend>{label}
</legend>
<select aria-label={`${label}类型`} value={value.kind} onChange={event=>onChange(event.target.value==='date'?{kind:'date',date:''}:event.target.value==='instant'?{kind:'instant',instant:'',timezone:''}:{kind:'unknown'})}>
<option value="unknown">未知
</option>
<option value="date">仅日期
</option>
<option value="instant">精确时刻（含时区）
</option>
</select>{value.kind==='date'&&
<input aria-label={label} type="date" value={value.date} onChange={event=>onChange({...value,date:event.target.value})}/>} {value.kind==='instant'&&<>
<input aria-label={`${label}时刻`} placeholder="2024-01-01T09:00:00+08:00" value={value.instant} onChange={event=>onChange({...value,instant:event.target.value})}/>
<input aria-label={`${label}时区`} placeholder="Asia/Shanghai" value={value.timezone} onChange={event=>onChange({...value,timezone:event.target.value})}/></>}
</fieldset>;
}
const errors:Record<string,string>={invalid_input:'请检查必填内容和业务日期。',not_found:'指定对象不存在，请返回列表。',conflict:'发生冲突，本地输入已保留。请比较最新内容后明确决定。',invalid_transition:'这项变化不符合当前真实任职状态或实际日期。',storage_error:'保存失败，请检查资料位置后重试。'};
function SaveStatus({state,pending,unsaved,onCheck,onContinue}:{state:CommandState|undefined;
pending:boolean;
unsaved:boolean;
onCheck:()=>void;
onContinue:()=>void}) {
 return <div role="status">{pending?'保存中':!state?'未保存':state.status==='unknown'?'暂时无法确认是否保存。你的输入还在，请先检查保存结果。':state.status==='not_recorded'?'已经确认这次保存尚未完成，可以继续保存。':state.result.kind==='failure'?errors[state.result.code]:unsaved?'已有保存结果，当前输入未保存':'已保存'}{state&&(state.status==='unknown'||state.status==='not_recorded')&&
<button className="button" type="button" disabled={pending} onClick={onCheck}>检查是否已保存
</button>}{state?.status==='not_recorded'&&
<button className="button" type="button" disabled={pending} onClick={onContinue}>继续保存
</button>}{state?.status==='known'&&state.result.kind==='failure'&&state.result.current&&
<details>
<summary>服务器当前内容（本地输入仍保留）
</summary>{'company' in state.result.current?
<p>{state.result.current.company} / {state.result.current.role} / {state.result.current.status==='current'?'当前':'历史'}；开始 {displayTime(state.result.current.start)}；实际结束 {displayTime(state.result.current.actualEnd)}；目标 {state.result.current.goal}
</p>:
<p>{state.result.current.name} / {state.result.current.role}
</p>}
</details>}
</div>;
}
function useCommands(request:EmploymentRequest,onSaved:(result:Result)=>void) {
 const [state,setState]=useState
<CommandState>();
 const [unsaved,setUnsaved]=useState(false);

 const mutation=useMutation({retry:false,mutationFn:({command,check}:{command:Request;
check?:boolean})=>check?checkEmploymentCommand(request,command):submitEmploymentCommand(request,command),onSuccess:next=>{setState(next);if(next.status==='known'&&next.result.kind==='failure')setUnsaved(true);
if(next.status==='known'&&next.result.kind!=='failure')onSaved(next.result);
}});
 useEffect(()=>{if(!mutation.isPending&&!unsaved&&state?.status!=='unknown'&&state?.status!=='not_recorded')return;const protect=(event:BeforeUnloadEvent)=>{event.preventDefault();};window.addEventListener('beforeunload',protect);return ()=>window.removeEventListener('beforeunload',protect);},[unsaved,state,mutation.isPending]);
 return {state,pending:mutation.isPending,blocked:mutation.isPending||state?.status==='unknown'||state?.status==='not_recorded',markUnsaved:()=>setUnsaved(true),save:(command:Request)=>{setUnsaved(false);mutation.mutate({command});},status:
<SaveStatus state={state} pending={mutation.isPending} unsaved={unsaved} onCheck={()=>state&&mutation.mutate({command:state.command,check:true})} onContinue={()=>state?.status==='not_recorded'&&mutation.mutate({command:state.command})}/>};
}
type EmploymentFields={company:string;
role:string;
goal:string;
started:boolean;
reason:string;
mode:'change'|'correction'};
function CreateEmployment({request,onCreated}:PageProps&{onCreated:(id:string)=>void}) {
 const form=useForm
<EmploymentFields>({defaultValues:{company:'',role:'',goal:'',started:false}});
const [start,setStart]=useState
<BusinessTime>({kind:'unknown'});
const [planned,setPlanned]=useState
<BusinessTime>({kind:'unknown'});
 const commands=useCommands(request,result=>{if(result.kind==='employment'){onCreated(result.employment.id);
form.reset();
setStart({kind:'unknown'});
setPlanned({kind:'unknown'});
}});
 return <form onChange={commands.markUnsaved} onSubmit={form.handleSubmit(values=>{if(!values.started)return;
commands.save({operation:'create',commandId:crypto.randomUUID(),company:values.company,role:values.role,goal:values.goal,started:true,start,plannedEnd:planned});
})}><fieldset disabled={commands.blocked}><h3>新增任职</h3>
<label className="field">公司
<input {...form.register('company',{required:true,maxLength:300})}/>
</label>
<label className="field">岗位
<input {...form.register('role',{required:true,maxLength:300})}/>
</label>
<label className="field">当前目标
<textarea {...form.register('goal',{maxLength:4000})}/>
</label>
<TimeInput label="实际开始" value={start} onChange={setStart}/>
<TimeInput label="计划结束" value={planned} onChange={setPlanned}/>
<label className="field">
<input type="checkbox" {...form.register('started',{required:true})}/>我确认已经真实开始这段任职
</label>
<button className="button" disabled={commands.blocked} type="submit">创建任职
</button></fieldset>{commands.status}
</form>;
}
function PersonEditor({person,employmentId,request,onSaved,renderProjects,onOpenWiki}:PageProps&{person?:Person;
employmentId:string;
onSaved:(person?:Person)=>void}) {
 const [editing,setEditing]=useState(!person);
 const form=useForm({defaultValues:{name:person?.name??'',role:person?.role??'',reason:'',mode:'change' as 'change'|'correction'}});
const [occurredAt,setOccurredAt]=useState
<BusinessTime>({kind:'unknown'});
const [revision,setRevision]=useState(person?.revision??1);
const [history,setHistory]=useState<Extract<Result,{kind:'person.history'}>>();
const [readError,setReadError]=useState('');
 const commands=useCommands(request,result=>{if(result.kind==='person'){setRevision(result.person.revision);
if(!person)form.reset();
onSaved(result.person);
}});
 async function readHistory(){try{const result=await request({operation:'person.history',id:person!.id,employmentId});
if(result.kind==='person.history'){setHistory(result);
setReadError('');
}else setReadError('人物历史暂时不可读');
}catch{setReadError('人物历史暂时不可读，可刷新');
}}
 return <article aria-label="人物资料">{person&&<><h4>{person.name}</h4><p>{person.role||'尚未填写当前角色'}</p>{renderProjects?.(employmentId,person.id)}{onOpenWiki&&<button className="button" onClick={()=>onOpenWiki('person',person.id)}>查看人物相关 Wiki</button>}<button className="button primary" onClick={()=>setEditing(true)}>编辑人物</button><button className="button" hidden={!editing} onClick={()=>setEditing(false)}>返回人物阅读（保留输入）</button></>}
<div hidden={!editing}><form onChange={commands.markUnsaved} onSubmit={form.handleSubmit(values=>commands.save(person?{operation:'person.edit',commandId:crypto.randomUUID(),id:person.id,employmentId,expectedRevision:revision,name:values.name,role:values.role,reason:values.reason,mode:values.mode,occurredAt}:{operation:'person.create',commandId:crypto.randomUUID(),employmentId,name:values.name,role:values.role,occurredAt}))}><fieldset disabled={commands.blocked}><h4>{person?'维护人物':'新增人物（同名不会合并）'}</h4>
<label className="field">姓名
<input {...form.register('name',{required:true,maxLength:300})}/>
</label>
<label className="field">任职角色
<input {...form.register('role',{maxLength:300})}/>
</label>{person&&<>
<label className="field">变化类型
<select {...form.register('mode')}>
<option value="change">后来真实变化
</option>
<option value="correction">纠正原记录
</option>
</select>
</label>
<label className="field">变化说明
<input {...form.register('reason',{required:true,maxLength:1000})}/>
</label></>}
<TimeInput label="人物角色实际业务时间" value={occurredAt} onChange={setOccurredAt}/>
<button className="button" disabled={commands.blocked}>保存人物
</button></fieldset>{commands.status}{commands.state?.status==='known'&&commands.state.result.kind==='failure'&&commands.state.result.code==='conflict'&&commands.state.result.current&&'name' in commands.state.result.current&&<>
<button className="button" type="button" disabled={commands.blocked} onClick={()=>{const state=commands.state;
if(state?.status==='known'&&state.result.kind==='failure'&&state.result.current&&'name' in state.result.current)setRevision(state.result.current.revision);
}}>保留输入，按最新版本重新保存
</button>
<button className="button" type="button" disabled={commands.blocked} onClick={()=>{const state=commands.state;
if(state?.status==='known'&&state.result.kind==='failure'&&state.result.current&&'name' in state.result.current){form.reset({name:state.result.current.name,role:state.result.current.role,reason:'',mode:'change'});
setRevision(state.result.current.revision);
}}}>放弃本地修改，使用当前人物
</button></>}
</form></div><details hidden={!person}><summary>角色历史</summary>{person&&
<button className="button" onClick={()=>void readHistory()}>读取人物角色历史
</button>}{readError&&
<p role="alert">{readError}
</p>}{history&&
<ol>{history.history.map(item=>
<li key={item.revision}>{item.person.name} / {item.person.role}；{item.mode==='correction'?'纠错':item.mode==='change'?'真实变化':'录入'}；{item.reason}；实际时间 {displayTime(item.occurredAt)}；录入 {item.recordedAt}
</li>)}
</ol>}{person&&<details><summary>查看技术详情</summary><pre>{JSON.stringify({id:person.id,revision:person.revision},null,2)}</pre></details>}</details>
</article>;
}
function EmploymentEditor({id,request,purgeNotice,renderProjects,onOpenWiki}:PageProps&{id:string}) {
 const client=useQueryClient();
const query=useQuery({queryKey:['employment',id],queryFn:async()=>{const result=await request({operation:'read',id});
if(result.kind!=='employment')throw new Error('read_failed');
return result;
},retry:false});
 useEffect(()=>{if(purgeNotice?.references.some(ref=>ref.owner==='person'))void query.refetch();},[purgeNotice?.sequence]);
 if(query.isPending)return <p>读取任职中
</p>;
if(!query.data)return <div role="alert">指定任职暂时无法读取。
<button className="button" onClick={()=>void query.refetch()}>刷新
</button>
</div>;
 return <>{query.isError&&
<p role="alert">已保存、暂时未刷新。输入仍保留。
<button className="button" onClick={()=>void query.refetch()}>刷新
</button>
</p>}
<EmploymentDetails renderProjects={renderProjects} onOpenWiki={onOpenWiki} employment={query.data.employment} people={query.data.people.filter(person=>!wasPurged(purgeNotice,'person',person.id))} request={request} onSaved={()=>{void client.invalidateQueries({queryKey:['employment',id]});
void client.invalidateQueries({queryKey:['employments']});
}}/></>;
}
function EmploymentDetails({employment,people,request,onSaved,renderProjects,onOpenWiki}:PageProps&{employment:Employment;
people:Person[];
onSaved:()=>void}) {
 const [tab,setTab]=useState<'overview'|'people'|'projects'>('overview'),[editing,setEditing]=useState(false),[lifecycleOpen,setLifecycleOpen]=useState(false),[personId,setPersonId]=useState<string>(),[creatingPerson,setCreatingPerson]=useState(false),[openedPeople,setOpenedPeople]=useState<string[]>([]);
 const form=useForm
<EmploymentFields>({defaultValues:{company:employment.company,role:employment.role,goal:employment.goal,reason:'',mode:'change'}});
 const [revision,setRevision]=useState(employment.revision);
const [start,setStart]=useState(employment.start);
const [planned,setPlanned]=useState(employment.plannedEnd);
const [actualEnd,setActualEnd]=useState(employment.actualEnd);
const [occurredAt,setOccurredAt]=useState
<BusinessTime>({kind:'unknown'});
const [history,setHistory]=useState<Extract<Result,{kind:'history'}>>();
const [readError,setReadError]=useState('');
 const commands=useCommands(request,result=>{if(result.kind==='employment'){setRevision(result.employment.revision);
onSaved();
}});
 const [lifecycleError,setLifecycleError]=useState('');
 const action=(operation:'end'|'reopen')=>{const values=form.getValues();const {mode,reason}=values;
if(!employmentLifecycleCanProceed(employment,{...values,start,plannedEnd:planned,actualEnd},operation)){setLifecycleError('请先保存任职内容，再执行结束或恢复；当前输入仍保留。');return;}
setLifecycleError('');
if(!reason.trim()){form.setError('reason',{message:'请填写变化说明'});
return;
}commands.save(operation==='end'?{operation,commandId:crypto.randomUUID(),id:employment.id,expectedRevision:revision,mode,reason,occurredAt,actualEnd}:{operation,commandId:crypto.randomUUID(),id:employment.id,expectedRevision:revision,mode,reason,occurredAt});
};
 async function readHistory(){try{const result=await request({operation:'history',id:employment.id});
if(result.kind==='history'){setHistory(result);
setReadError('');
}else setReadError('历史暂时无法读取');
}catch{setReadError('历史暂时无法读取，可刷新');
}}
 return <section className="aura-module-detail"><h3>{employment.company} · {employment.role}</h3>
<p>{employment.status==='current'?'当前任职':'历史任职'}；实际开始 {displayTime(employment.start)}；计划结束 {displayTime(employment.plannedEnd)}；实际结束 {displayTime(employment.actualEnd)}
</p>
<nav aria-label="任职分区" className="section-tabs">{([['overview','概览'],['people','人物'],['projects','项目']] as const).map(([id,label])=><button className="button" key={id} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{label}</button>)}</nav><div hidden={tab!=='overview'}><p className="readable-body">{employment.goal||'可以记录这段工作目前最想完成的目标。'}</p>{onOpenWiki&&<button className="button" onClick={()=>onOpenWiki('employment',employment.id)}>查看任职相关 Wiki</button>}<button className="button primary" onClick={()=>setEditing(true)}>编辑任职</button><details><summary>更多</summary><button className="button" onClick={()=>{setEditing(true);setLifecycleOpen(true);}}>结束任职 / 日期纠错</button><button className="button" onClick={()=>void readHistory()}>查看任职历史</button><details><summary>查看技术详情</summary><pre>{JSON.stringify({id:employment.id,revision:employment.revision,recordedAt:employment.recordedAt},null,2)}</pre></details></details><div hidden={!editing}><button className="button" onClick={()=>setEditing(false)}>返回任职阅读（保留输入）</button>
<form onChange={commands.markUnsaved} onSubmit={form.handleSubmit(values=>{if(employment.status==='current'&&actualEnd.kind!=='unknown'){setLifecycleError('请使用“确认任职已真实结束”提交实际结束日期；当前输入仍保留。');return;}setLifecycleError('');commands.save({operation:'edit',commandId:crypto.randomUUID(),id:employment.id,expectedRevision:revision,company:values.company,role:values.role,goal:values.goal,start,plannedEnd:planned,actualEnd,reason:values.reason,mode:values.mode,occurredAt});})}><fieldset disabled={commands.blocked}>
<label className="field">公司
<input {...form.register('company',{required:true,maxLength:300})}/>
</label>
<label className="field">岗位
<input {...form.register('role',{required:true,maxLength:300})}/>
</label>
<label className="field">当前目标
<textarea {...form.register('goal',{maxLength:4000})}/>
</label>
<TimeInput label="实际开始" value={start} onChange={setStart}/>
<TimeInput label="计划结束" value={planned} onChange={setPlanned}/>
<TimeInput label="实际结束" value={actualEnd} onChange={setActualEnd}/>
<TimeInput label="本次变化实际业务时间" value={occurredAt} onChange={setOccurredAt}/>
<label className="field">变化类型
<select {...form.register('mode')}>
<option value="change">后来真实变化
</option>
<option value="correction">纠正原记录
</option>
</select>
</label>
<label className="field">变化说明
<input {...form.register('reason',{required:true,maxLength:1000})}/>
</label>{form.formState.errors.reason&&
<p role="alert">请填写变化说明
</p>}
<button className="button" disabled={commands.blocked}>保存任职
</button>
{lifecycleError&&<p role="alert">{lifecycleError}</p>}<details open={lifecycleOpen} onToggle={event=>setLifecycleOpen(event.currentTarget.open)}><summary>结束 / 恢复任职</summary><button className="button" type="button" disabled={commands.blocked} onClick={()=>action(employment.status==='current'?'end':'reopen')}>{employment.status==='current'?'确认任职已真实结束':'恢复同一任职'}
</button></details></fieldset>{commands.status}{commands.state?.status==='known'&&commands.state.result.kind==='failure'&&commands.state.result.code==='conflict'&&commands.state.result.current&&'company' in commands.state.result.current&&<>
<button className="button" type="button" disabled={commands.blocked} onClick={()=>{const state=commands.state;
if(state?.status==='known'&&state.result.kind==='failure'&&state.result.current&&'company' in state.result.current)setRevision(state.result.current.revision);
}}>保留输入，按最新版本重新保存
</button>
<button className="button" type="button" disabled={commands.blocked} onClick={()=>{const state=commands.state;
if(state?.status==='known'&&state.result.kind==='failure'&&state.result.current&&'company' in state.result.current){const current=state.result.current;
form.reset({company:current.company,role:current.role,goal:current.goal,reason:'',mode:'change',started:true});
setStart(current.start);
setPlanned(current.plannedEnd);
setActualEnd(current.actualEnd);
setRevision(current.revision);
}}}>放弃本地修改，使用当前任职
</button></>}
</form></div>{readError&&
<p role="alert">{readError}
</p>}{history&&
<ol>{history.history.map(item=>
<li key={item.revision}>{item.action==='ended'?'结束':item.action==='reopened'?'恢复':item.action==='created'?'创建':'维护'} · {item.mode==='correction'?'纠错':item.mode==='change'?'真实变化':'录入'} · {item.reason} · 实际业务时间 {displayTime(item.occurredAt)} · 实际结束 {displayTime(item.employment.actualEnd)} · 录入 {item.recordedAt}
</li>)}
</ol>}</div><div hidden={tab!=='people'}><h3>人物</h3><p>同名人物不会自动合并；只记录这段任职里的真实人物。</p><button className="button" onClick={()=>setCreatingPerson(value=>!value)}>记录人物</button><ul className="readable-list">{people.map(person=><li key={person.id}><button className="button" onClick={()=>{setPersonId(person.id);setOpenedPeople(old=>old.includes(person.id)?old:[...old,person.id]);}}>{person.name} · {person.role||'未填写角色'}</button></li>)}</ul>{people.length===0&&<p>还没有记录人物。遇到值得记住的同事时再补充。</p>}{people.filter(person=>openedPeople.includes(person.id)).map(person=><div key={person.id} hidden={personId!==person.id}><PersonEditor person={person} employmentId={employment.id} request={request} onSaved={onSaved} renderProjects={renderProjects} onOpenWiki={onOpenWiki}/></div>)}<div hidden={!creatingPerson}><PersonEditor employmentId={employment.id} request={request} onSaved={person=>{setCreatingPerson(false);if(person){setPersonId(person.id);setOpenedPeople(old=>old.includes(person.id)?old:[...old,person.id]);}onSaved();}}/></div></div><div hidden={tab!=='projects'}><h3>相关项目</h3>{renderProjects?.(employment.id)??<p>项目可在“项目”入口中选择这段任职进行关联。</p>}</div>
</section>;
}
export function EmploymentPage({request,purgeNotice,renderProjects,onOpenWiki}:PageProps) {
 const client=useQueryClient();
const list=useQuery({queryKey:['employments'],queryFn:async()=>{const result=await request({operation:'list'});
if(result.kind!=='list')throw new Error('read_failed');
return result;
},retry:false});
const [selected,setSelected]=useState
<string>();
const [opened,setOpened]=useState<string[]>([]);
const [creating,setCreating]=useState(false);
 useEffect(()=>{if(!purgeNotice)return;const removed=opened.filter(id=>wasPurged(purgeNotice,'employment',id));setOpened(old=>old.filter(id=>!removed.includes(id)));if(selected&&removed.includes(selected))setSelected(undefined);void list.refetch();},[purgeNotice?.sequence]);
 function open(id:string){setSelected(id);
setOpened(old=>old.includes(id)?old:[...old,id]);
}
 return <section className="screen aura-module" aria-label="任职" data-feedback-owner="employment" data-feedback-id={selected}><header className="page-header"><div className="title"><h1>任职</h1><p>记录一段真实工作经历，以及里面的人和项目。</p></div><div className="actions" hidden={!!selected&&!creating}><button className="button primary" onClick={()=>setCreating(value=>!value)}>{creating?'收起新增（保留输入）':'新建任职'}</button></div></header><div hidden={!!selected&&!creating}>
<div hidden={!creating}>
<CreateEmployment request={request} onCreated={id=>{setCreating(false);
open(id);
void client.invalidateQueries({queryKey:['employments']});
}}/>
</div>{list.isError&&
<p role="alert">列表暂时未刷新，已保存内容不受影响。
<button className="button" onClick={()=>void list.refetch()}>刷新
</button>
</p>}{list.data?.kind==='list'&&
<ul className="rows aura-rows">{list.data.employments.map(item=>
<li key={item.id}>
<button className="recent-row" aria-label={`${item.company} · ${item.role} · ${item.status==='current'?'当前':'历史'}`} onClick={()=>open(item.id)}><span className="row-icon"><NavigationIcon name="employment"/></span><div className="row-text"><strong>{item.company} · {item.role}</strong><p>{item.status==='current'?'当前':'历史'}</p></div><NavigationIcon name="arrow"/></button>
</li>)}
</ul>}{!selected&&list.data?.kind==='list'&&list.data.employments.length===0&&
<p>真正开始一份工作后，在这里记录。
</p>}</div>{selected&&
<button className="button" onClick={()=>setSelected(undefined)}>返回任职列表（保留输入）
</button>}{opened.map(id=>
<div key={id} hidden={id!==selected}>
<EmploymentEditor renderProjects={renderProjects} onOpenWiki={onOpenWiki} purgeNotice={purgeNotice} id={id} request={request}/>
</div>)}
</section>;
}

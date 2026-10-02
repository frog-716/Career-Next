import {useState,useEffect} from 'react';
import {useMutation} from '@tanstack/react-query';
import type {Request,Result} from '../../../contracts/project/schema';
import {submitProjectCommand,checkProjectCommand,type ProjectRequest,type ProjectCommandState} from './commands';
const messages:Record<string,string>={invalid_input:'请检查必填内容与日期。',not_found:'指定项目或参与关系不存在。',conflict:'发生冲突，本地输入已保留。',invalid_transition:'当前状态不允许这项操作，请区分纠错和真实变化。',invalid_relation:'请选择有效当前任职中的已确认人物。',storage_error:'保存失败，请检查资料位置后重试。'};
export function useProjectCommands(request:ProjectRequest,onSaved:(result:Result)=>void){
 const [state,setState]=useState<ProjectCommandState>();
 const [dirty,setDirty]=useState(false);
 const mutation=useMutation({
  retry:false,
  mutationFn:({command,check}:{command:Request;check?:boolean})=>check?checkProjectCommand(request,command):submitProjectCommand(request,command),
  onSuccess:next=>{setState(next);if(next.status==='known'){if(next.result.kind==='failure')setDirty(true);else onSaved(next.result);}},
 });
 useEffect(()=>{
  if(!dirty&&!mutation.isPending&&state?.status!=='unknown'&&state?.status!=='not_recorded')return;
  const protect=(event:BeforeUnloadEvent)=>event.preventDefault();
  window.addEventListener('beforeunload',protect);
  return ()=>window.removeEventListener('beforeunload',protect);
 },[dirty,mutation.isPending,state]);
 const status=<div role="status">
  {mutation.isPending?'保存中':!state?'未保存':state.status==='unknown'?'结果待核对，输入已保留':state.status==='not_recorded'?'原命令尚未记录，确认后可继续原保存':state.result.kind==='failure'?messages[state.result.code]:dirty?'已有保存结果，当前输入未保存':'已保存'}
  {state&&(state.status==='unknown'||state.status==='not_recorded')&&<button type="button" disabled={mutation.isPending} onClick={()=>mutation.mutate({command:state.command,check:true})}>核对原保存结果</button>}
  {state?.status==='not_recorded'&&<button type="button" disabled={mutation.isPending} onClick={()=>mutation.mutate({command:state.command})}>继续原保存</button>}
  {state?.status==='known'&&state.result.kind==='failure'&&state.result.current&&<details><summary>服务器当前内容</summary><p>{state.result.current.name} · {state.result.current.description} · {state.result.current.stateNote}</p></details>}
 </div>;
 return {
  state,status,pending:mutation.isPending,blocked:mutation.isPending||state?.status==='unknown'||state?.status==='not_recorded',
  markDirty:()=>setDirty(true),markClean:()=>setDirty(false),
  save:(command:Request)=>{setDirty(false);mutation.mutate({command});},
 };
}

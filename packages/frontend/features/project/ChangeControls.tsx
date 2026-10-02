import type {BusinessTime} from '../../../contracts/common/business-time';
export type ChangeContext={mode:'change'|'correction';reason:string;occurredAt:BusinessTime};
export const emptyChange:ChangeContext={mode:'change',reason:'',occurredAt:{kind:'unknown'}};
export function displayTime(time:BusinessTime):string{
 return time.kind==='unknown'?'未知':time.kind==='date'?time.date:`${time.instant}（${time.timezone}）`;
}
export function ChangeControls({value,onChange}:{value:ChangeContext;onChange:(value:ChangeContext)=>void}){
 const time=value.occurredAt;
 return <fieldset>
  <legend>变化说明和实际业务时间</legend>
  <label>变化类型<select value={value.mode} onChange={event=>onChange({...value,mode:event.target.value==='correction'?'correction':'change'})}>
   <option value="change">后来真实变化</option><option value="correction">纠正原记录</option>
  </select></label>
  <label>变化说明<input required maxLength={1000} value={value.reason} onChange={event=>onChange({...value,reason:event.target.value})}/></label>
  <label>业务时间类型<select value={time.kind} onChange={event=>onChange({...value,occurredAt:event.target.value==='date'?{kind:'date',date:''}:event.target.value==='instant'?{kind:'instant',instant:'',timezone:''}:{kind:'unknown'}})}>
   <option value="unknown">未知</option><option value="date">仅日期</option><option value="instant">精确时刻（含时区）</option>
  </select></label>
  {time.kind==='date'&&<label>实际业务日期<input type="date" required value={time.date} onChange={event=>onChange({...value,occurredAt:{...time,date:event.target.value}})}/></label>}
  {time.kind==='instant'&&<>
   <label>实际业务时刻<input required placeholder="2024-01-02T09:00:00+08:00" value={time.instant} onChange={event=>onChange({...value,occurredAt:{...time,instant:event.target.value}})}/></label>
   <label>原业务时区<input required placeholder="Asia/Shanghai" value={time.timezone} onChange={event=>onChange({...value,occurredAt:{...time,timezone:event.target.value}})}/></label>
  </>}
 </fieldset>;
}

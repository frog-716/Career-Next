import {useEffect,useRef,useState} from 'react';
import {useCredentialWait,credentialWaitLabels} from './credential-wait';
import {SecretResult,type SecretBridge} from '../../../contracts/ai/secret-input';
export function SecretSettings({bridge,service='provider'}:{bridge:SecretBridge;service?:'provider'|'tavily'}){
 const input=useRef<HTMLInputElement>(null);const [provider,setProvider]=useState<'local-test'|'deepseek-v4.1-flash'>('local-test');const [status,setStatus]=useState('尚未读取凭据状态'),[busy,setBusy]=useState(false),[checking,setChecking]=useState(false);
 const wait=useCredentialWait(bridge,checking);
 const clear=()=>{if(input.current)input.current.value='';};
 async function run(operation:'save'|'status'|'check'|'disable'|'delete'){
  setBusy(true);setChecking(operation==='check');try{
   const value=operation==='save'?input.current?.value??'':undefined;
   const pending=bridge.request(operation==='save'?{operation,value:value!,...service==='provider'&&provider==='deepseek-v4.1-flash'?{provider}:{}}:{operation});clear();
   const result=SecretResult.parse(await pending);
   if(result.kind==='failure')setStatus(operation==='save'?'安全保存失败；请先核对凭据状态。没有使用明文备用方式。':'凭据状态暂时无法确认。没有发送请求，请先核对本机状态。');
   else if(!result.status.configured)setStatus('未配置凭据。');
   else if(!result.status.enabled)setStatus('凭据已停用，不会自动恢复。');
   else if(result.status.authorization==='cancelled'||result.status.authorization==='denied'||result.status.authorization==='timeout'||result.status.authorization==='waiting_for_system_authorization')setStatus(credentialWaitLabels[result.status.authorization]);
   else if(result.status.readiness==='available')setStatus('凭据已配置，当前本机检查可用。发送前仍须单独确认最终预览。');
   else if(result.status.readiness==='unavailable')setStatus('凭据已保存，但当前不可用（credential_unavailable）。没有发送请求。');
   else setStatus('凭据已安全保存，但尚未检查是否可用。没有发送请求。');
  }catch{setStatus('凭据操作结果待核对，请重新读取状态。');}finally{clear();setChecking(false);setBusy(false);}
 }
 useEffect(()=>{const node=input.current;void run('status');return()=>{if(node)node.value='';};},[]);
 return <section aria-label={service==='tavily'?'Tavily Search 凭据':'外部服务凭据'}><h3>{service==='tavily'?'Tavily Search Key':'外部服务凭据'}</h3><p>Key 仅保存在设备安全存储中。保存不会发送请求；真实外发必须在任务最终预览中另行授权。</p>{service==='tavily'&&<p>仅批准查询：OpenAI official website。仅 1 次；不附带 Resume / Raw / Profile 或 Career 私有资料。本步骤仅配置 Key，不执行搜索。</p>}{service==='provider'&&<label>凭据用途<select value={provider} disabled={busy} onChange={event=>setProvider(event.target.value as typeof provider)}><option value="local-test">本地受控协议测试（无网络）</option><option value="deepseek-v4.1-flash">DeepSeek V4.1-Flash · non-thinking</option></select></label>}<label>{service==='tavily'?'Tavily Search Key':'新凭据'}<input ref={input} type="password" maxLength={4096} autoComplete="off" disabled={busy}/></label><button disabled={busy} onClick={()=>void run('save')}>{service==='tavily'?'安全保存 Tavily Key':'安全保存新凭据'}</button><button disabled={busy} onClick={()=>{clear();setStatus('已取消输入。');}}>{service==='tavily'?'取消 Tavily Key 输入':'取消凭据输入'}</button><button disabled={busy} onClick={()=>void run('disable')}>{service==='tavily'?'停用 Tavily Key':'停用凭据'}</button><button disabled={busy} onClick={()=>void run('delete')}>{service==='tavily'?'删除 Tavily Key':'删除凭据'}</button><button disabled={busy} onClick={()=>void run('status')}>{service==='tavily'?'读取 Tavily Key 状态':'重新读取凭据状态'}</button><button disabled={busy} onClick={()=>void run('check')}>{service==='tavily'?'本机检查 Tavily Key（不联网）':'本机检查凭据（不联网）'}</button><p role="status">{busy&&wait.authorization?credentialWaitLabels[wait.authorization]:status}</p>{busy&&wait.authorization==='waiting_for_system_authorization'&&<button disabled={wait.cancelling} onClick={()=>void wait.cancel()}>取消等待系统授权（不发送）</button>}{wait.notice&&<p role="status">{wait.notice}</p>}</section>;
}

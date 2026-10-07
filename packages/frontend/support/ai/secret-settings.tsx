import {useEffect,useRef,useState} from 'react';
import {useCredentialWait,credentialWaitLabels} from './credential-wait';
import {SecretResult,type SecretBridge} from '../../../contracts/ai/secret-input';
import {ProviderConnectionTestResult,type ProviderConnectionTestBridge,type ProviderConnectionTestOutput} from '../../../contracts/ai/connection-test';

type Service='provider'|'tavily';
type Provider='local-test'|'deepseek-v4.1-flash';

export function SecretSettings({bridge,connectionBridge,service='provider',active=true,diagnostics=false}:{diagnostics?:boolean;bridge:SecretBridge;connectionBridge?:ProviderConnectionTestBridge;service?:Service;active?:boolean}){
 const input=useRef<HTMLInputElement>(null),lastInput=useRef<HTMLInputElement|undefined>(undefined);const [editing,setEditing]=useState(false);const [provider,setProvider]=useState<Provider>('deepseek-v4.1-flash');const [status,setStatus]=useState('正在读取状态…'),[busy,setBusy]=useState(false),[checking,setChecking]=useState(false);
 const [preview,setPreview]=useState<ProviderConnectionTestOutput>(),[testResult,setTestResult]=useState<ProviderConnectionTestOutput>(),[testBusy,setTestBusy]=useState(false),[testStarted,setTestStarted]=useState(false),[testUnknown,setTestUnknown]=useState(false);
 const wait=useCredentialWait(bridge,checking||testBusy);
 const displayName=service==='tavily'?'Tavily Search':'DeepSeek V4.1-Flash';
 const testProvider=service==='tavily'?'tavily' as const:'deepseek' as const;
 const clear=()=>{if(input.current)input.current.value='';if(lastInput.current)lastInput.current.value='';};

 async function run(operation:'save'|'status'|'check'|'disable'|'delete'){
  setBusy(true);setChecking(operation==='check');
  try{
   const value=operation==='save'?input.current?.value??'':undefined;
   const request=operation==='save'?{operation,value:value!,...service==='provider'&&provider==='deepseek-v4.1-flash'?{provider}:{}}:{operation};
   const pending=bridge.request(request as Parameters<SecretBridge['request']>[0]);clear();const result=SecretResult.parse(await pending);
   if(result.kind==='failure')setStatus(operation==='save'?'保存失败。请检查后重试。':'状态暂时无法确认。没有发送请求。');
   else if(service==='provider'&&result.status.configured&&result.status.provider!=='deepseek-v4.1-flash')setStatus(diagnostics?'已配置本地演示凭据':'未配置 DeepSeek');
   else if(!result.status.configured)setStatus('未配置');
   else if(!result.status.enabled)setStatus('已停用');
   else if(result.status.authorization==='cancelled'||result.status.authorization==='denied'||result.status.authorization==='timeout'||result.status.authorization==='waiting_for_system_authorization')setStatus(credentialWaitLabels[result.status.authorization]);
   else if(result.status.readiness==='available')setStatus('已配置 · 本机检查可用');
   else if(result.status.readiness==='unavailable')setStatus('已保存 · 本机暂不可用');
   else setStatus('已配置 · 尚未检查');
   if(operation==='save'&&result.kind==='status'&&result.status.configured&&result.status.enabled)setEditing(false);
   if(['save','disable','delete'].includes(operation))window.dispatchEvent(new Event('career-connection-changed'));
  }catch{clear();setStatus('操作结果暂时无法确认。请先刷新状态。');}
  finally{clear();setChecking(false);setBusy(false);}
 }

 async function showPreview(){
  if(testStarted||testBusy)return;
  try{const test=connectionBridge??window.careerConnectionTest;const result=ProviderConnectionTestResult.parse(await test.request({operation:'preview',provider:testProvider}));if(result.kind==='preview')setPreview(result);}
  catch{setStatus('测试内容暂时无法读取。没有发送请求。');}
 }

 async function executeTest(){
  if(testStarted||testBusy)return;
  setTestStarted(true);setTestBusy(true);setTestUnknown(false);setTestResult(undefined);
  try{const test=connectionBridge??window.careerConnectionTest;setTestResult(ProviderConnectionTestResult.parse(await test.request({operation:'run',provider:testProvider,confirmed:true})));}
  catch{setTestUnknown(true);}
  finally{setTestBusy(false);}
 }

 useEffect(()=>{if(!active){clear();setEditing(false);setPreview(undefined);}},[active]);
 useEffect(()=>{void run('status');return()=>{clear();};},[]);

 const ready=testResult?.kind==='result'&&testResult.status==='connected';
 const outcome=testResult?.kind==='result'?testResult:undefined;
 const displayedStatus=outcome?(ready?'连接正常':'连接检查未通过'):testUnknown?'结果暂时无法确认':status;
 const body=preview?.kind==='preview'?preview.preview.body:undefined;
 return <section className="credential-card" aria-label={displayName}>
  <header className="credential-card-head"><div><h3>{displayName}</h3><p role="status" className="credential-status">{busy&&wait.authorization?credentialWaitLabels[wait.authorization]:displayedStatus}</p></div></header>
  {diagnostics&&service==='provider'&&<label className="field">凭据用途<select value={provider} disabled={busy} onChange={event=>setProvider(event.target.value as Provider)}><option value="local-test">本地演示（不联网）</option><option value="deepseek-v4.1-flash">DeepSeek V4.1-Flash · non-thinking</option></select></label>}
  <div className="credential-actions"><button className="button" disabled={busy} onClick={()=>setEditing(true)}>{status.startsWith('已配置')?'更换 Key':'配置 Key'}</button>{status.startsWith('已配置')&&<button className="text-button" disabled={testBusy||testStarted} onClick={()=>void showPreview()}>测试连接</button>}</div>
  {editing&&<div className="credential-editor"><label className="field">{service==='tavily'?'Tavily Search Key':'DeepSeek Key'}<input ref={node=>{input.current=node;if(node)lastInput.current=node;}} type="password" maxLength={4096} autoComplete="off" disabled={busy}/></label><div className="credential-actions"><button className="button" disabled={busy} onClick={()=>void run('save')}>保存到本机</button><button className="text-button" disabled={busy} onClick={()=>{clear();setEditing(false);setStatus('已取消输入');}}>取消</button></div></div>}
  {preview?.kind==='preview'&&<section className="connection-test-preview" aria-label={`${displayName}连接测试预览`}><h4>连接测试预览</h4><p>只发送下方固定内容，不读取或附带 Career 资料。Key 只用于认证；本次单发，无重试、跳转或备用服务。</p><p>接收方：{preview.preview.provider==='deepseek'?'DeepSeek V4.1-Flash · deepseek-flash':'Tavily'} · {preview.preview.method} {preview.preview.endpoint}</p>{preview.preview.provider==='deepseek'&&<p>thinking：关闭 · fallback：关闭</p>}<pre>{JSON.stringify(body,null,2)}</pre><div className="credential-actions"><button className="button" disabled={testBusy||testStarted} onClick={()=>void executeTest()}>发送一次测试</button><button className="text-button" disabled={testBusy||testStarted} onClick={()=>setPreview(undefined)}>取消</button></div></section>}
  {testBusy&&<p role="status">{wait.authorization==='waiting_for_system_authorization'?'正在等待系统授权…':'正在检查连接…'}</p>}
  {testBusy&&wait.authorization==='waiting_for_system_authorization'&&<button className="text-button" disabled={wait.cancelling} onClick={()=>void wait.cancel()}>取消等待</button>}
  {testUnknown&&<p role="status">结果暂时无法确认。不会自动重试，请勿重复发送。</p>}
  {outcome&&<p role="status">{ready?'连接成功':outcome.requestCount===0?'未发送请求，凭据读取未完成':'连接检查失败'} · 请求 {outcome.requestCount} 次{outcome.httpStatus?` · HTTP ${outcome.httpStatus}`:''}{outcome.resultCount!==undefined?` · 结果 ${outcome.resultCount} 条`:''}{outcome.failureStage?` · ${outcome.failureStage}`:''}</p>}
  <details className="credential-more"><summary>更多操作</summary><div className="credential-actions"><button className="text-button" disabled={busy} onClick={()=>void run('check')}>检查本机 Key</button><button className="text-button" disabled={busy} onClick={()=>void run('status')}>刷新状态</button><button className="text-button" disabled={busy} onClick={()=>void run('disable')}>停用</button><button className="text-button danger" disabled={busy} onClick={()=>void run('delete')}>删除 Key</button></div>{wait.notice&&<p role="status">{wait.notice}</p>}</details>
 </section>;
}

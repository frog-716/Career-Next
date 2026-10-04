import {useState} from 'react';
import {useCredentialWait,credentialWaitLabels} from './credential-wait';
import {TavilyResult,type TavilyBridge} from '../../../contracts/ai/tavily-search';
export function TavilySearch({bridge,targets}:{bridge:TavilyBridge;targets:{owner:string;objectId:string;label:string}[]}){
 const [ownerId,setOwnerId]=useState(''),[result,setResult]=useState<TavilyResult>(),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[checking,setChecking]=useState(false);
 const wait=useCredentialWait(window.careerTavilySecrets,checking);
 const selected=targets.find(target=>target.objectId===ownerId&&['company','opportunity'].includes(target.owner));
 const owner=selected?{kind:selected.owner as 'company'|'opportunity',id:selected.objectId}:undefined;
 async function run(input:Parameters<TavilyBridge['request']>[0]){if(busy)return;setBusy(true);setChecking(input.operation==='credential.check'||input.operation==='run');try{setResult(TavilyResult.parse(await bridge.request(input)));setUnknown(false);}catch{setUnknown(true);}finally{setChecking(false);setBusy(false);}}
 return <section aria-label="Tavily 真实搜索验收"><h3>Tavily 真实搜索 · TEST DATA</h3><p>只执行 OpenAI official website 这一次公开搜索。结果只是研究候选，不是已核验事实；不自动写 Research 正文、不调用 DeepSeek。</p><label>研究候选归属<select disabled={busy} value={ownerId} onChange={event=>{setOwnerId(event.target.value);setResult(undefined);}}><option value="">请选择 TEST DATA 对象</option>{targets.filter(target=>['company','opportunity'].includes(target.owner)).map(target=><option key={target.objectId} value={target.objectId}>{target.label}</option>)}</select></label><button disabled={busy||!owner} onClick={()=>owner&&void run({operation:'preview',owner})}>预览 Tavily 查询，不发送</button><button disabled={busy} onClick={()=>void run({operation:'receipt'})}>核对本次 Tavily 结果，不重发</button>
 <button disabled={busy} onClick={()=>void run({operation:'credential.check'})}>检查正式搜索凭据链（不联网）</button>
 {wait.authorization&&<p role="status">{credentialWaitLabels[wait.authorization]}</p>}
 {busy&&wait.authorization==='waiting_for_system_authorization'&&<button disabled={wait.cancelling} onClick={()=>void wait.cancel()}>取消等待系统授权（不发送）</button>}{wait.notice&&<p role="status">{wait.notice}</p>}
 {result?.kind==='credential_readiness'&&<p>正式凭据交接：{result.available?'可用':'不可用'}；用时 {result.elapsedMs} ms；{result.failureReason??'成功'}。没有预留或发送搜索请求。</p>}
 {result?.kind==='preview'&&<><p>凭据：{result.configured&&result.enabled?'已配置、已启用':'未配置或已停用'}；已占用本次搜索：{result.used?'是':'否'}</p><p>实际接收方：Tavily；POST {result.endpoint}</p><pre>{JSON.stringify({query:result.query})}</pre><p>不包含 Resume / Raw / Profile / Career 私有资料。仅 1 次，不自动 retry，不跟随 redirect，不切换 Provider。</p><button disabled={busy||unknown||result.used||!result.enabled||!owner} onClick={()=>owner&&void run({operation:'run',owner,commandId:crypto.randomUUID(),previewDigest:result.previewDigest,confirmed:true})}>执行已授权的唯一一次 Tavily 搜索</button></>}
 {result?.kind==='candidate'&&<><p>真实 Tavily 返回 {result.run.results.length} 条研究候选；请求次数 1。Research 正文未写入；未标记为已核验事实。</p><p>SearchRun：{result.run.id} · {result.run.adapter} · {result.run.network}</p>{result.run.results.map(item=><article key={item.id}><h4>{item.title}</h4><p>{item.url}</p><p>{item.body}</p><p>来源：Tavily 公网搜索结果 · {item.source.owner}/{item.source.objectId}/{item.source.locator} · 未独立核验</p></article>)}</>}
 {result?.kind==='state'&&<p>状态：{result.state}；请求次数：{result.requestCount}；HTTP：{result.httpStatus??'未收到'}；阶段：{result.failureStage??'无失败记录'}。不自动重发。</p>}{result?.kind==='failure'&&<p>未完成：{result.code}；阶段：{result.failureStage??'未记录'}；HTTP：{result.httpStatus??'未收到'}。不自动重发。</p>}{unknown&&<p>结果暂时未知，只核对本次结果，不创建新请求。</p>}
 </section>;
}

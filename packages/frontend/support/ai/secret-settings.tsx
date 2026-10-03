import {useEffect,useRef,useState} from 'react';
import {SecretResult,type SecretBridge} from '../../../contracts/ai/secret-input';
export function SecretSettings({bridge}:{bridge:SecretBridge}){
 const input=useRef<HTMLInputElement>(null);const [status,setStatus]=useState('尚未读取凭据状态'),[busy,setBusy]=useState(false);
 const clear=()=>{if(input.current)input.current.value='';};
 async function run(operation:'save'|'status'|'disable'|'delete'){
  setBusy(true);try{
   const value=operation==='save'?input.current?.value??'':undefined;
   const pending=bridge.request(operation==='save'?{operation,value:value!}:{operation});clear();
   const result=SecretResult.parse(await pending);
   setStatus(result.kind==='failure'?'安全保存失败，请重新输入；没有使用明文备用方式。':result.status.configured?(result.status.enabled?'凭据已安全保存。真实服务尚未接入或测试。':'凭据已停用，不会自动恢复。'):'未配置凭据。');
  }catch{setStatus('凭据操作结果待核对，请重新读取状态。');}finally{clear();setBusy(false);}
 }
 useEffect(()=>{const node=input.current;void run('status');return()=>{if(node)node.value='';};},[]);
 return <section aria-label="外部服务凭据"><h3>外部服务凭据</h3><p>只保存设备安全凭据；本轮不连接真实服务。</p><label>新凭据<input ref={input} type="password" maxLength={4096} autoComplete="off" disabled={busy}/></label><button disabled={busy} onClick={()=>void run('save')}>安全保存新凭据</button><button disabled={busy} onClick={()=>{clear();setStatus('已取消输入。');}}>取消凭据输入</button><button disabled={busy} onClick={()=>void run('disable')}>停用凭据</button><button disabled={busy} onClick={()=>void run('delete')}>删除凭据</button><button disabled={busy} onClick={()=>void run('status')}>重新读取凭据状态</button><p role="status">{status}</p></section>;
}

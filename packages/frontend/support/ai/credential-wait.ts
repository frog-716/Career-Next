import {useEffect,useRef,useState} from 'react';
import {SecretResult,type SecretBridge,type SecretStatus} from '../../../contracts/ai/secret-input';
import type {z} from 'zod';
export const credentialWaitLabels:Record<NonNullable<z.infer<typeof SecretStatus>['authorization']>,string>={
 idle:'尚未检查系统授权',waiting_for_system_authorization:'正在等待系统授权，请在 macOS 系统窗口中由你本人完成。应用仍可继续操作。',ready:'系统授权已完成，凭据当前可用。',cancelled:'已取消等待，没有发送请求；系统窗口仍由你本人处理。',denied:'系统拒绝本次凭据读取（授权或认证失败），没有发送请求。',timeout:'系统授权长时间未返回，异常保护已结束等待；没有自动重试。',unavailable:'凭据当前不可用；系统未提供可区分的取消或拒绝原因。',
};
/** Poll metadata only. This path cannot decrypt or start an authorization prompt. */
export function useCredentialWait(bridge:SecretBridge|undefined,active:boolean){
 const didWait=useRef(false);
 const [authorization,setAuthorization]=useState<z.infer<typeof SecretStatus>['authorization']>(),[cancelling,setCancelling]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{if(!bridge||!active&&!didWait.current)return;if(active)didWait.current=true;let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
  async function status(){try{const result=SecretResult.parse(await bridge!.request({operation:'status'}));if(!stopped&&result.kind==='status')setAuthorization(result.status.authorization);}catch{/* Do not infer readiness from a broken status connection. */}finally{if(!stopped&&active)timer=setTimeout(()=>void status(),500);}}
  void status();return()=>{stopped=true;if(timer)clearTimeout(timer);};
 },[bridge,active]);
 async function cancel(){if(!bridge||cancelling)return;setCancelling(true);setNotice('');try{const result=SecretResult.parse(await bridge.request({operation:'cancel'}));if(result.kind==='status')setAuthorization(result.status.authorization);}catch{setNotice('取消结果暂时无法确认，请核对本机状态。不会自动重试。');}finally{setCancelling(false);}}
 return {authorization,cancelling,cancel,notice};
}

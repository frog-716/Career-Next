import {useEffect,useState} from 'react';
import {SecretResult} from '../../../contracts/ai/secret-input';
import type {ProductTarget} from '../../../contracts/ai/product-context';
import type {PurgeNotice} from '../../design-system/purge-notice';
import {ProductTaskPage} from './product-task';
/** Display availability from credential metadata only; never resolves a credential or sends a request. */
export function useTaskAvailability(kind:ProductTarget['kind']){
 const [supported,setSupported]=useState(false);
 useEffect(()=>{let alive=true;async function read(){try{const response=window.careerSecrets?SecretResult.parse(await window.careerSecrets.request({operation:'status'})):undefined;if(!alive)return;const status=response?.kind==='status'?response.status:undefined;setSupported(status?.provider==='deepseek-v4.1-flash'?kind==='research-organize'&&status.configured&&status.enabled&&status.readiness!=='unavailable':window.career?.developmentDiagnostics===true);}catch{if(alive)setSupported(false);}}void read();window.addEventListener('career-connection-changed',read);return()=>{alive=false;window.removeEventListener('career-connection-changed',read);};},[kind]);
 return supported;
}
const labels:Record<ProductTarget['kind'],string>={'research-organize':'帮我整理情报','research-promotion':'整理为公司共享情报','resume-optimize':'优化这份简历',greeting:'起草沟通内容','interview-preparation':'准备面试','interview-review':'整理面试复盘','offer-assist':'分析 Offer','simulation-return':'整理确认过的真实经历'};
export function BusinessAiEntry({target,purgeNotice,onApplied}:{target:ProductTarget;purgeNotice?:PurgeNotice;onApplied?():void}){
 const supported=useTaskAvailability(target.kind),[open,setOpen]=useState(false),[visited,setVisited]=useState(false);
 return <div className="business-ai-entry">{supported?<button onClick={()=>{setVisited(true);setOpen(value=>!value);}}>{labels[target.kind]}</button>:<p>当前连接还不能完成这个任务。</p>}{visited&&<div hidden={!open||!supported}><ProductTaskPage target={target} purgeNotice={purgeNotice} onApplied={onApplied}/></div>}</div>;
}

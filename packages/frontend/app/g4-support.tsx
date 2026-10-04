import {ProductTaskLauncher} from '../support/ai/product-launcher';
import {LocalSearch} from '../support/local-search';
import {TavilySearch} from '../support/ai/tavily-search';
import {SecretSettings} from '../support/ai/secret-settings';
import {FeedbackOverlay} from '../support/feedback';
import type {PurgeNotice} from '../design-system/purge-notice';
import {useEffect,useState,useRef} from 'react';
import {WikiAiPage} from '../support/ai';
import {DataLifecycleSettings} from '../support/data-lifecycle/page';
import {Result as AiResult,type Request as AiRequest,type Target} from '../../contracts/ai/schema';
import {Result as DataResult,type DataRequest} from '../../contracts/application/schema';
import {Result as MaterialsResult} from '../../contracts/materials/schema';
import {Result as WikiResult} from '../../contracts/wiki/schema';
import type {SourceRef} from '../../contracts/common/source-ref';
const aiRequest=async(input:AiRequest)=>AiResult.parse(await window.career.request('ai',input));
async function sources(){const result=MaterialsResult.parse(await window.careerMaterials.request({operation:'list'}));return result.kind==='list'?result.items.map(item=>({ref:item.source,name:item.name})):[];}
interface PurgeTarget {owner:string;objectId:string;label:string}
export function G4Support({workspaceInstance,onRestore,onApplied,onPurge,purgeNotice}:{workspaceInstance:string;onRestore():Promise<void>;onApplied():void;onPurge(refs:PurgeNotice['references']):void;purgeNotice?:PurgeNotice}){
 const plans=useRef(new Map<string,PurgeNotice['references']>());
 const [settings,setSettings]=useState(false),[ai,setAi]=useState(false),[product,setProduct]=useState(false),[productVisited,setProductVisited]=useState(false),[targets,setTargets]=useState<PurgeTarget[]>([]),[scopes,setScopes]=useState<{target:Target;label:string}[]>([{target:{scope:'personal'},label:'个人 Wiki'},{target:{scope:'cognition'},label:'长期认知 Wiki'}]);
 async function load(){try{const result=DataResult.parse(await window.career.request('application',{operation:'data.targets'}));if(result.kind!=='data_targets')return;setTargets(result.targets);const next:{target:Target;label:string}[]=[{target:{scope:'personal'},label:'个人 Wiki'},{target:{scope:'cognition'},label:'长期认知 Wiki'}];for(const t of result.targets){if(['project','employment','person','opportunity'].includes(t.owner))next.push({target:{scope:t.owner as Target['scope'],scopeId:t.objectId},label:t.label});}setScopes(next);}catch{/* Current input and known targets remain available; mutations never retry. */}}
 useEffect(()=>{void load();},[workspaceInstance,settings,ai]);
 const requestData=async(input:DataRequest)=>{const result=DataResult.parse(await window.career.request('application',input));if(result.kind==='purge_plan')plans.current.set(result.plan.id,result.plan.impact.references);if(result.kind==='restored'||result.kind==='failure'&&result.code==='restore_failed_reconnected')await onRestore();if(result.kind==='failure'&&result.code==='purge_incomplete'&&input.operation==='data.purge.confirm')onPurge(plans.current.get(input.planId)??[]);if(result.kind==='purged'){onPurge(plans.current.get(result.planId)??[]);await load();onApplied();}return result;};
 return <section aria-label="辅助功能"><FeedbackOverlay purgeNotice={purgeNotice} onPurged={refs=>{onPurge(refs);void load();onApplied();}}/><button onClick={()=>{setProduct(!product);setProductVisited(true);}}>完整旅程任务辅助</button>{productVisited&&<div hidden={!product}><ProductTaskLauncher purgeNotice={purgeNotice} onApplied={onApplied}/></div>}<button onClick={()=>setAi(!ai)}>Wiki 整理辅助</button><button onClick={()=>setSettings(!settings)}>设置与资料维护</button>{ai&&<WikiAiPage purgeNotice={purgeNotice} request={aiRequest} sources={sources} targets={scopes} workspaceInstance={workspaceInstance} onApplied={()=>{void load();onApplied();}}/>}{settings&&<><LocalSearch bridge={window.careerSearch} purgeNotice={purgeNotice}/><SecretSettings bridge={window.careerSecrets}/><SecretSettings bridge={window.careerTavilySecrets} service="tavily"/><TavilySearch bridge={window.careerTavilySearch} targets={targets}/><DataLifecycleSettings request={requestData} targets={targets}/></>}</section>;
}

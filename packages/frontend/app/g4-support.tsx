import {LegacyHistoryView} from '../support/ai/legacy-history';
import {ProductTaskLauncher} from '../support/ai/product-launcher';
import {LocalSearch} from '../support/local-search';
import {TavilySearch} from '../support/ai/tavily-search';
import {SecretSettings} from '../support/ai/secret-settings';
import {FeedbackOverlay} from '../support/feedback';
import type {PurgeNotice} from '../design-system/purge-notice';
import {useEffect,useState,useRef,useCallback} from 'react';
import {AuxiliaryPanel} from '../support/experience/panel';
import {HelpContent} from '../support/experience';
import {navigationManifest,type NavigationId} from '../shell/routes';
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
export function G4Support({workspaceInstance,onRestore,onApplied,onPurge,purgeNotice,preferences,helpOpen,onHelp,onHelpClose,onFinishTutorial,onOpenOpportunity}:{workspaceInstance:string;onRestore():Promise<void>;onApplied():void;onPurge(refs:PurgeNotice['references']):void;purgeNotice?:PurgeNotice;preferences:{pinned:NavigationId|null;order:NavigationId[];busy:boolean;status:string;pin(id:NavigationId|null):Promise<void>;reorder(order:NavigationId[]):Promise<void>};helpOpen:boolean;onHelp():void;onHelpClose():void;onFinishTutorial():void;onOpenOpportunity(id:string):void}){
 const handlers=useRef({onRestore,onPurge,onApplied});handlers.current={onRestore,onPurge,onApplied};
 const [settingsVisited,setSettingsVisited]=useState(false);
 const plans=useRef(new Map<string,PurgeNotice['references']>());
 const [history,setHistory]=useState(false),[settings,setSettings]=useState(false),[ai,setAi]=useState(false),[product,setProduct]=useState(false),[productVisited,setProductVisited]=useState(false),[targets,setTargets]=useState<PurgeTarget[]>([]),[scopes,setScopes]=useState<{target:Target;label:string}[]>([{target:{scope:'personal'},label:'个人 Wiki'},{target:{scope:'cognition'},label:'长期认知 Wiki'}]);
 async function load(){try{const result=DataResult.parse(await window.career.request('application',{operation:'data.targets'}));if(result.kind!=='data_targets')return;setTargets(result.targets);const next:{target:Target;label:string}[]=[{target:{scope:'personal'},label:'个人 Wiki'},{target:{scope:'cognition'},label:'长期认知 Wiki'}];for(const t of result.targets){if(['project','employment','person','opportunity'].includes(t.owner))next.push({target:{scope:t.owner as Target['scope'],scopeId:t.objectId},label:t.label});}setScopes(next);}catch{/* Current input and known targets remain available; mutations never retry. */}}
 useEffect(()=>{void load();},[workspaceInstance,settings,ai]);
 const requestData=useCallback(async(input:DataRequest)=>{const result=DataResult.parse(await window.career.request('application',input));if(result.kind==='purge_plan')plans.current.set(result.plan.id,result.plan.impact.references);if(result.kind==='restored'||result.kind==='failure'&&result.code==='restore_failed_reconnected')await handlers.current.onRestore();if(result.kind==='failure'&&result.code==='purge_incomplete'&&input.operation==='data.purge.confirm')handlers.current.onPurge(plans.current.get(input.planId)??[]);if(result.kind==='purged'){handlers.current.onPurge(plans.current.get(result.planId)??[]);await load();handlers.current.onApplied();}return result;},[workspaceInstance]);
 function move(id:NavigationId){const order=[...preferences.order],index=order.indexOf(id);if(index<1)return;[order[index-1],order[index]]=[order[index],order[index-1]];void preferences.reorder(order);}
 return <><button onMouseDown={event=>event.preventDefault()} onClick={()=>{setSettingsVisited(true);setSettings(true);}}>设置</button><button onMouseDown={event=>event.preventDefault()} onClick={onHelp}>帮助</button><FeedbackOverlay purgeNotice={purgeNotice} onPurged={refs=>{onPurge(refs);void load();onApplied();}}/>
 {settingsVisited&&<AuxiliaryPanel open={settings} label="设置" onClose={()=>setSettings(false)}><p>管理本机连接、导航和资料备份。关闭后回到原任务，业务输入会保留；未提交的密钥输入会清空。</p><details><summary>导航设置</summary><p>置顶的模块是启动首页；没有置顶时先到 Wiki。</p>{preferences.order.map(id=>{const item=navigationManifest.find(entry=>entry.id===id)!;return <div key={id}><span>{item.label}</span><button disabled={preferences.busy} aria-pressed={preferences.pinned===id} onClick={()=>void preferences.pin(preferences.pinned===id?null:id)}>{preferences.pinned===id?`取消${item.label}置顶首页`:`置顶${item.label}首页`}</button><button disabled={preferences.busy||preferences.order.indexOf(id)===0} onClick={()=>move(id)}>上移{item.label}</button></div>;})}<p role="status">{preferences.status}</p></details>
 <SecretSettings active={settings} bridge={window.careerSecrets}/><SecretSettings active={settings} bridge={window.careerTavilySecrets} service="tavily"/>
 <details><summary>备份与恢复</summary><DataLifecycleSettings request={requestData} targets={targets}/></details>
 <details><summary>本地资料搜索</summary><LocalSearch bridge={window.careerSearch} purgeNotice={purgeNotice} onOpenOpportunity={id=>{setSettings(false);onOpenOpportunity(id);}}/></details>
 <details><summary>AI 与更多辅助</summary><button onClick={()=>{setProduct(!product);setProductVisited(true);}}>AI 任务辅助</button>{productVisited&&<div hidden={!product}><ProductTaskLauncher purgeNotice={purgeNotice} onApplied={onApplied}/></div>}<button onClick={()=>setAi(!ai)}>整理 Wiki 资料</button>{ai&&<WikiAiPage purgeNotice={purgeNotice} request={aiRequest} sources={sources} targets={scopes} workspaceInstance={workspaceInstance} onApplied={()=>{void load();onApplied();}}/>}<button onClick={()=>setHistory(!history)}>历史 AI 建议</button>{history&&<LegacyHistoryView request={aiRequest} purgeNotice={purgeNotice}/>}</details>
 <details><summary>查看技术详情</summary><p>以下为本地诊断与受控测试，不是普通搜索入口。不会自动发送请求。</p><TavilySearch bridge={window.careerTavilySearch} targets={targets}/></details></AuxiliaryPanel>}
 <AuxiliaryPanel open={helpOpen} label="如何使用 Career" onClose={onHelpClose}><HelpContent onFinishTutorial={onFinishTutorial}/></AuxiliaryPanel></>;
}

import {ProfileSettings} from '../support/profile';
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
 const diagnostics=window.career.developmentDiagnostics===true;
 const [group,setGroup]=useState<string>(),[visited,setVisited]=useState<string[]>([]);function openGroup(value:string){setGroup(value);setVisited(old=>old.includes(value)?old:[...old,value]);}
 const [settingsVisited,setSettingsVisited]=useState(false);
 const plans=useRef(new Map<string,PurgeNotice['references']>());
 const [history,setHistory]=useState(false),[settings,setSettings]=useState(false),[ai,setAi]=useState(false),[product,setProduct]=useState(false),[productVisited,setProductVisited]=useState(false),[targets,setTargets]=useState<PurgeTarget[]>([]),[scopes,setScopes]=useState<{target:Target;label:string}[]>([{target:{scope:'personal'},label:'个人 Wiki'},{target:{scope:'cognition'},label:'长期认知 Wiki'}]);
 async function load(){try{const result=DataResult.parse(await window.career.request('application',{operation:'data.targets'}));if(result.kind!=='data_targets')return;setTargets(result.targets);const next:{target:Target;label:string}[]=[{target:{scope:'personal'},label:'个人 Wiki'},{target:{scope:'cognition'},label:'长期认知 Wiki'}];for(const t of result.targets){if(['project','employment','person','opportunity'].includes(t.owner))next.push({target:{scope:t.owner as Target['scope'],scopeId:t.objectId},label:t.label});}setScopes(next);}catch{/* Current input and known targets remain available; mutations never retry. */}}
 useEffect(()=>{void load();},[workspaceInstance,settings,ai]);
 const requestData=useCallback(async(input:DataRequest)=>{const result=DataResult.parse(await window.career.request('application',input));if(result.kind==='purge_plan')plans.current.set(result.plan.id,result.plan.impact.references);if(result.kind==='restored'||result.kind==='failure'&&result.code==='restore_failed_reconnected')await handlers.current.onRestore();if(result.kind==='failure'&&result.code==='purge_incomplete'&&input.operation==='data.purge.confirm')handlers.current.onPurge(plans.current.get(input.planId)??[]);if(result.kind==='purged'){handlers.current.onPurge(plans.current.get(result.planId)??[]);await load();handlers.current.onApplied();}return result;},[workspaceInstance]);
 function move(id:NavigationId){const order=[...preferences.order],index=order.indexOf(id);if(index<1)return;[order[index-1],order[index]]=[order[index],order[index-1]];void preferences.reorder(order);}
 return <><button onMouseDown={event=>event.preventDefault()} onClick={()=>{setSettingsVisited(true);setSettings(true);}}>设置</button><button onMouseDown={event=>event.preventDefault()} onClick={onHelp}>帮助</button><FeedbackOverlay purgeNotice={purgeNotice} onPurged={refs=>{onPurge(refs);void load();onApplied();}}/>
 {settingsVisited&&<AuxiliaryPanel open={settings} label="设置" onClose={()=>setSettings(false)}><p>管理基础资料、本机连接和备份。返回后继续原任务；未提交的密钥输入会清空。</p><div hidden={!!group} className="settings-groups">{[['profile','我的基础资料','同步所有当前简历'],['connections','AI / Search 连接','管理本机安全连接；发送仍需单独授权'],['backup','备份与恢复','保护资料，选择经过验证的恢复点'],['navigation','导航设置','调整启动入口和四模块顺序'],['maintenance','高级资料维护','查找资料、只读历史与永久清除']] .map(([id,name,description])=><button key={id} aria-label={name} onClick={()=>openGroup(id)}><strong>{name}</strong><span>{description}</span></button>)}</div>{group&&<button onClick={()=>setGroup(undefined)}>返回设置分类</button>}
 {visited.includes('profile')&&<div hidden={group!=='profile'}><ProfileSettings purgeNotice={purgeNotice} onSaved={onApplied}/></div>}
 {visited.includes('navigation')&&<div hidden={group!=='navigation'}><h3>导航设置</h3><p>置顶的模块是启动首页；没有置顶时先到 Wiki。</p>{preferences.order.map(id=>{const item=navigationManifest.find(entry=>entry.id===id)!;return <div key={id}><span>{item.label}</span><button disabled={preferences.busy} aria-pressed={preferences.pinned===id} onClick={()=>void preferences.pin(preferences.pinned===id?null:id)}>{preferences.pinned===id?`取消${item.label}置顶首页`:`置顶${item.label}首页`}</button><button disabled={preferences.busy||preferences.order.indexOf(id)===0} onClick={()=>move(id)}>上移{item.label}</button></div>;})}<p role="status">{preferences.status}</p></div>}
 {visited.includes('connections')&&<div hidden={group!=='connections'}><SecretSettings diagnostics={diagnostics} active={settings&&group==='connections'} bridge={window.careerSecrets}/><SecretSettings active={settings&&group==='connections'} bridge={window.careerTavilySecrets} service="tavily"/></div>}
 {visited.includes('backup')&&<div hidden={group!=='backup'}><DataLifecycleSettings section="backup" request={requestData} targets={targets}/></div>}
 {visited.includes('maintenance')&&<div hidden={group!=='maintenance'}><h3>高级资料维护</h3><details><summary>本地资料搜索</summary><LocalSearch bridge={window.careerSearch} purgeNotice={purgeNotice} onOpenOpportunity={id=>{setSettings(false);onOpenOpportunity(id);}}/></details><details><summary>历史 AI 建议（只读）</summary><p>这些是旧建议的历史记录，不能再次执行或接受。</p><LegacyHistoryView request={aiRequest} purgeNotice={purgeNotice}/></details><details><summary>永久清除</summary><DataLifecycleSettings section="maintenance" request={requestData} targets={targets}/></details></div>}
 {diagnostics&&<details><summary>开发诊断（仅隔离验收）</summary><p>以下能力使用明确的本地诊断模式，不代表真实服务已通过。</p><button onClick={()=>{setProduct(!product);setProductVisited(true);}}>AI 任务辅助</button>{productVisited&&<div hidden={!product}><ProductTaskLauncher purgeNotice={purgeNotice} onApplied={onApplied}/></div>}<button onClick={()=>setAi(!ai)}>整理 Wiki 资料</button>{ai&&<WikiAiPage purgeNotice={purgeNotice} request={aiRequest} sources={sources} targets={scopes} workspaceInstance={workspaceInstance} onApplied={()=>{void load();onApplied();}}/>}<TavilySearch bridge={window.careerTavilySearch} targets={targets}/></details>}
 </AuxiliaryPanel>}
 <AuxiliaryPanel open={helpOpen} label="如何使用 Career" onClose={onHelpClose}><HelpContent onFinishTutorial={onFinishTutorial}/></AuxiliaryPanel></>;
}

import {useEffect,useState} from 'react';
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
export function G4Support({workspaceInstance,onRestore,onApplied}:{workspaceInstance:string;onRestore():Promise<void>;onApplied():void}){
 const [settings,setSettings]=useState(false),[ai,setAi]=useState(false),[targets,setTargets]=useState<PurgeTarget[]>([]),[scopes,setScopes]=useState<{target:Target;label:string}[]>([{target:{scope:'personal'},label:'个人 Wiki'},{target:{scope:'cognition'},label:'长期认知 Wiki'}]);
 async function load(){try{const raw=await sources(),wiki=WikiResult.parse(await window.career.request('wiki',{operation:'list',includeRetired:true}));const targets:PurgeTarget[]=[...raw.map(item=>({owner:'materials',objectId:item.ref.objectId,label:'原件 · '+item.name})),...(wiki.kind==='list'?wiki.items.map(item=>({owner:'wiki',objectId:item.id,label:'Wiki · '+item.title})):[])];setTargets(targets);const next:{target:Target;label:string}[]=[{target:{scope:'personal'},label:'个人 Wiki'},{target:{scope:'cognition'},label:'长期认知 Wiki'}];
 const employments=await window.career.request('employment',{operation:'list'}) as {kind:string;employments?:{id:string;company:string;people:{id:string;name:string}[]}[]};for(const e of employments.employments??[]){next.push({target:{scope:'employment',scopeId:e.id},label:'任职 · '+e.company});targets.push({owner:'employment',objectId:e.id,label:'任职 · '+e.company});for(const p of e.people??[]){next.push({target:{scope:'person',scopeId:p.id},label:'人物 · '+p.name});targets.push({owner:'person',objectId:p.id,label:'人物 · '+p.name});}}
 const projects=await window.career.request('project',{operation:'list'}) as {projects?:{id:string;name:string}[]};for(const p of projects.projects??[]){next.push({target:{scope:'project',scopeId:p.id},label:'项目 · '+p.name});targets.push({owner:'project',objectId:p.id,label:'项目 · '+p.name});}
 const opportunities=await window.career.request('opportunity',{operation:'list'}) as {opportunities?:{id:string;role:string}[];items?:{id:string;role:string}[]};for(const o of opportunities.opportunities??opportunities.items??[]){next.push({target:{scope:'opportunity',scopeId:o.id},label:'机会 Wiki · '+o.role});targets.push({owner:'opportunity',objectId:o.id,label:'机会 · '+o.role});}
 setTargets([...targets,{owner:'profile',objectId:'current',label:'当前本人身份'}]);setScopes(next);
 }catch{/* Current input and known targets remain available; mutations never retry. */}}
 useEffect(()=>{void load();},[workspaceInstance,settings,ai]);
 const requestData=async(input:DataRequest)=>{const result=DataResult.parse(await window.career.request('application',input));if(result.kind==='restored')await onRestore();if(result.kind==='purged'){await load();onApplied();}return result;};
 return <section aria-label="辅助功能"><button onClick={()=>setAi(!ai)}>Wiki 整理辅助</button><button onClick={()=>setSettings(!settings)}>设置与资料维护</button>{ai&&<WikiAiPage request={aiRequest} sources={sources} targets={scopes} workspaceInstance={workspaceInstance} onApplied={()=>{void load();onApplied();}}/>}{settings&&<DataLifecycleSettings request={requestData} targets={targets}/>}</section>;
}

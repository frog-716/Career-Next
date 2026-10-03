import {useEffect,useState} from 'react';
import type {OpportunityView} from '../../contracts/opportunity/schema';
import {Result as MaterialsResult,type RawSummary} from '../../contracts/materials/schema';
import {Result as ResearchResult,type Request as ResearchRequest} from '../../contracts/opportunity/research/schema';
import {Result as InterviewResult,type Request as InterviewRequest} from '../../contracts/opportunity/interview/schema';
import {Result as OfferResult,type Request as OfferRequest} from '../../contracts/opportunity/offer/schema';
import {ResearchPage} from '../features/opportunity/research';
import {InterviewPage} from '../features/opportunity/interview';
import {OfferPage} from '../features/opportunity/offer';
export const researchRequest=async(input:ResearchRequest)=>ResearchResult.parse(await window.career.request('research',input));
const interviewRequest=async(input:InterviewRequest)=>InterviewResult.parse(await window.career.request('interview',input));
const offerRequest=async(input:OfferRequest)=>OfferResult.parse(await window.career.request('offer',input));
export function OpportunitySubmodules({opportunity,workspaceInstance,onChanged,openResearch}:{opportunity:OpportunityView;workspaceInstance:string;onChanged:()=>void;openResearch?:number}){
 const [active,setActive]=useState<string>(),[visited,setVisited]=useState<string[]>([]),[sources,setSources]=useState<RawSummary[]>([]),[sourcesError,setSourcesError]=useState(false);
 const show=(name:string)=>{setActive(name);setVisited(previous=>previous.includes(name)?previous:[...previous,name]);};
 useEffect(()=>{if(openResearch)show('research');},[openResearch]);
 async function refreshSources(){try{const value=MaterialsResult.parse(await window.careerMaterials.request({operation:'list'}));if(value.kind!=='list')throw Error();setSources(value.items);setSourcesError(false);}catch{setSources([]);setSourcesError(true);}}
 useEffect(()=>{void refreshSources();},[workspaceInstance,opportunity.id,active]);
 return <section aria-label="机会强子模块"><h2>研究、面试与 Offer</h2><button onClick={()=>show('research')}>打开岗位情报</button><button onClick={()=>show('interview')}>打开面试</button><button onClick={()=>show('offer')}>打开 Offer</button>{active&&<button onClick={()=>void refreshSources()}>刷新可用原件</button>}{visited.includes('research')&&<div hidden={active!=='research'}><ResearchPage opportunityId={opportunity.id} companyId={opportunity.companyId} workspaceInstance={workspaceInstance} request={researchRequest} onChanged={onChanged} availableSources={sources.map(raw=>({ref:raw.source,name:raw.name}))}/></div>}{visited.includes('interview')&&<div hidden={active!=='interview'}><InterviewPage opportunityId={opportunity.id} workspaceInstance={workspaceInstance} request={interviewRequest} onChanged={onChanged}/></div>}{visited.includes('offer')&&<div hidden={active!=='offer'}><OfferPage opportunityId={opportunity.id} workspaceInstance={workspaceInstance} request={offerRequest} onChanged={onChanged} sources={sources} sourcesError={sourcesError}/></div>}</section>;
}

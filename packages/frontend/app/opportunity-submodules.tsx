import type {PurgeNotice} from '../design-system/purge-notice';
import {sourceCatalogue} from './source-catalogue';
import type {SourceRef} from '../../contracts/common/source-ref';
import {SubmissionPage} from '../features/opportunity/submission';
import {CommunicationPage} from '../features/opportunity/communication';
import {Result as SubmissionResult,type Request as SubmissionRequest} from '../../contracts/opportunity/submission/schema';
import {Result as CommunicationResult,type Request as CommunicationRequest} from '../../contracts/opportunity/communication/schema';
import {Result as ResumeResult} from '../../contracts/resume/schema';
import '../../contracts/opportunity/submission/file-selection';
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
const submissionRequest=async(input:SubmissionRequest)=>SubmissionResult.parse(await window.career.request('submission',input));
const communicationRequest=async(input:CommunicationRequest)=>CommunicationResult.parse(await window.career.request('communication',input));
const interviewRequest=async(input:InterviewRequest)=>InterviewResult.parse(await window.career.request('interview',input));
const offerRequest=async(input:OfferRequest)=>OfferResult.parse(await window.career.request('offer',input));
export function OpportunitySubmodules({purgeNotice,opportunity,workspaceInstance,onChanged,openResearch}:{purgeNotice?:PurgeNotice;opportunity:OpportunityView;workspaceInstance:string;onChanged:()=>void;openResearch?:number}){
 const [active,setActive]=useState<string>(),[visited,setVisited]=useState<string[]>([]),[sources,setSources]=useState<RawSummary[]>([]),[researchSources,setResearchSources]=useState<{ref:SourceRef;name:string}[]>([]),[sourcesError,setSourcesError]=useState(false),[candidates,setCandidates]=useState<{kind:'resume';id:string;name:string}[]>([]);
 const show=(name:string)=>{setActive(name);setVisited(previous=>previous.includes(name)?previous:[...previous,name]);};
 useEffect(()=>{if(openResearch)show('research');},[openResearch]);
 async function refreshSources(){try{const value=MaterialsResult.parse(await window.careerMaterials.request({operation:'list'}));if(value.kind!=='list')throw Error();setSources(value.items);setResearchSources((await sourceCatalogue(opportunity.id)).map(item=>({ref:item.source,name:item.name})));const resumes=ResumeResult.parse(await window.career.request('resume',{operation:'resume.candidates',opportunityId:opportunity.id}));if(resumes.status==='versions')setCandidates(resumes.versions.map(v=>({kind:'resume',id:v.id,name:v.name||'未命名导出.pdf'})));setSourcesError(false);}catch{setSources([]);setSourcesError(true);}}
 useEffect(()=>{void refreshSources();},[purgeNotice?.sequence]);
 useEffect(()=>{void refreshSources();},[workspaceInstance,opportunity.id,active]);
 return <section aria-label="机会强子模块"><h2>机会记录</h2><button onClick={()=>show('submission')}>打开首次投递</button><button onClick={()=>show('communication')}>打开沟通</button><button onClick={()=>show('research')}>打开岗位情报</button><button onClick={()=>show('interview')}>打开面试</button><button onClick={()=>show('offer')}>打开 Offer</button>{active&&<button onClick={()=>void refreshSources()}>刷新可用原件</button>}{visited.includes('submission')&&<div hidden={active!=='submission'}><SubmissionPage purgeNotice={purgeNotice} opportunityId={opportunity.id} workspaceInstance={workspaceInstance} request={submissionRequest} candidates={candidates} selectActual={()=>window.careerSentFiles.select()} onChanged={onChanged}/></div>}{visited.includes('communication')&&<div hidden={active!=='communication'}><CommunicationPage purgeNotice={purgeNotice} opportunityId={opportunity.id} workspaceInstance={workspaceInstance} request={communicationRequest} candidates={candidates} selectActual={()=>window.careerSentFiles.select()} onChanged={onChanged}/></div>}{visited.includes('research')&&<div hidden={active!=='research'}><ResearchPage purgeNotice={purgeNotice} opportunityId={opportunity.id} companyId={opportunity.companyId} workspaceInstance={workspaceInstance} request={researchRequest} onChanged={onChanged} availableSources={researchSources}/></div>}{visited.includes('interview')&&<div hidden={active!=='interview'}><InterviewPage purgeNotice={purgeNotice} opportunityId={opportunity.id} workspaceInstance={workspaceInstance} request={interviewRequest} onChanged={onChanged}/></div>}{visited.includes('offer')&&<div hidden={active!=='offer'}><OfferPage purgeNotice={purgeNotice} opportunityId={opportunity.id} workspaceInstance={workspaceInstance} request={offerRequest} onChanged={onChanged} sources={sources} sourcesError={sourcesError}/></div>}</section>;
}

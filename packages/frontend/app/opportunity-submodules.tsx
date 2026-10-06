import {BusinessAiEntry} from '../support/ai/business-entry';
import type {OpportunitySection} from '../features/opportunity/detail-header';
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
export const communicationRequest=async(input:CommunicationRequest)=>CommunicationResult.parse(await window.career.request('communication',input));
const interviewRequest=async(input:InterviewRequest)=>InterviewResult.parse(await window.career.request('interview',input));
const offerRequest=async(input:OfferRequest)=>OfferResult.parse(await window.career.request('offer',input));
function ResearchAssistants({owner,purgeNotice,onApplied}:{owner:import('../../contracts/opportunity/research/schema').Owner;purgeNotice?:PurgeNotice;onApplied():void}){
 const [visited,setVisited]=useState([owner]);
 useEffect(()=>{setVisited(old=>old.some(item=>item.kind===owner.kind&&item.id===owner.id)?old:[...old,owner]);},[owner.kind,owner.id]);
 return <>{visited.map(item=><div key={item.kind+item.id} hidden={item.kind!==owner.kind||item.id!==owner.id}><BusinessAiEntry target={{kind:'research-organize',owner:item}} purgeNotice={purgeNotice} onApplied={onApplied}/></div>)}</>;
}
export function OpportunitySubmodules({purgeNotice,opportunity,workspaceInstance,onChanged,section}:{purgeNotice?:PurgeNotice;opportunity:OpportunityView;workspaceInstance:string;onChanged:()=>void;section:OpportunitySection}){
 const [hasSubmission,setHasSubmission]=useState(false),[researchEpoch,setResearchEpoch]=useState(0);
 const active=section;const [visited,setVisited]=useState<string[]>([]),[sources,setSources]=useState<RawSummary[]>([]),[researchSources,setResearchSources]=useState<{ref:SourceRef;name:string}[]>([]),[sourcesError,setSourcesError]=useState(false),[candidates,setCandidates]=useState<{kind:'resume';id:string;name:string}[]>([]);
 const show=(name:string)=>{setVisited(previous=>previous.includes(name)?previous:[...previous,name]);};
 useEffect(()=>{if(section!=='overview'&&section!=='resume')show(section);},[section]);
 async function refreshSources(){try{const submitted=SubmissionResult.parse(await submissionRequest({operation:'submission.read',opportunityId:opportunity.id}));setHasSubmission(submitted.kind==='submission'||submitted.kind==='purged');}catch{/* Do not change the known submission state on a failed read. */}try{const value=MaterialsResult.parse(await window.careerMaterials.request({operation:'list'}));if(value.kind!=='list')throw Error();setSources(value.items);setResearchSources((await sourceCatalogue(opportunity.id)).map(item=>({ref:item.source,name:item.name})));const resumes=ResumeResult.parse(await window.career.request('resume',{operation:'resume.candidates',opportunityId:opportunity.id}));if(resumes.status==='versions')setCandidates(resumes.versions.map(v=>({kind:'resume',id:v.id,name:v.name||'未命名导出.pdf'})));setSourcesError(false);}catch{setSources([]);setSourcesError(true);}}
 useEffect(()=>{void refreshSources();},[purgeNotice?.sequence]);
 useEffect(()=>{void refreshSources();},[workspaceInstance,opportunity.id,active]);
 return <section className="opportunity-section section-view" aria-label="机会分区内容">{active!=='overview'&&active!=='resume'&&<details><summary>来源与发送材料</summary><p>只读取已有材料，不自动导入或发送。</p><button onClick={()=>void refreshSources()}>刷新可用原件</button></details>}{visited.includes('communication')&&<div hidden={active!=='communication'}><CommunicationPage hasFirstSubmission={hasSubmission} purgeNotice={purgeNotice} opportunityId={opportunity.id} workspaceInstance={workspaceInstance} request={communicationRequest} candidates={candidates} selectActual={()=>window.careerSentFiles.select()} onChanged={onChanged}/><SubmissionPage purgeNotice={purgeNotice} opportunityId={opportunity.id} workspaceInstance={workspaceInstance} request={submissionRequest} candidates={candidates} selectActual={()=>window.careerSentFiles.select()} onChanged={onChanged}/></div>}{visited.includes('research')&&<div hidden={active!=='research'}><ResearchPage purgeNotice={purgeNotice} opportunityId={opportunity.id} companyId={opportunity.companyId} workspaceInstance={workspaceInstance} request={researchRequest} onChanged={onChanged} availableSources={researchSources} changeEpoch={researchEpoch} renderAssistant={owner=><ResearchAssistants owner={owner} purgeNotice={purgeNotice} onApplied={()=>{setResearchEpoch(value=>value+1);onChanged();void refreshSources();}}/>}/></div>}{visited.includes('interview')&&<div hidden={active!=='interview'}><InterviewPage purgeNotice={purgeNotice} opportunityId={opportunity.id} workspaceInstance={workspaceInstance} request={interviewRequest} onChanged={onChanged}/></div>}{visited.includes('offer')&&<div hidden={active!=='offer'}><OfferPage purgeNotice={purgeNotice} opportunityId={opportunity.id} workspaceInstance={workspaceInstance} request={offerRequest} onChanged={onChanged} sources={sources} sourcesError={sourcesError}/></div>}</section>;
}

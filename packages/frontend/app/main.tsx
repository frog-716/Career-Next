import {createRoot} from 'react-dom/client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {HashRouter,useLocation,useNavigate} from 'react-router';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {CareerShell,resolveRoute,resumePath} from '../shell';
import {RawImport} from '../features/materials/RawImport';
import {WikiPage} from '../features/wiki';
import {EmploymentPage} from '../features/employment';
import {ProjectPage} from '../features/project';
import {OpportunityPage} from '../features/opportunity';
import {ResumePage} from '../features/resume';
import {Result as WikiResult,type Request as WikiRequest} from '../../contracts/wiki/schema';
import {Result as EmploymentResult,type Request as EmploymentRequest} from '../../contracts/employment/schema';
import {Result as ProjectResult,type Request as ProjectRequest} from '../../contracts/project/schema';
import {Result as OpportunityResult,type Request as OpportunityRequest} from '../../contracts/opportunity/schema';
import {Result as ResumeResult,type Request as ResumeRequest} from '../../contracts/resume/schema';
import {Result as ProfileResult,type Request as ProfileRequest} from '../../contracts/profile/schema';
import {Identity} from '../../contracts/materials/schema';
import './style.css';
const wikiRequest=async(input:WikiRequest)=>WikiResult.parse(await window.career.request('wiki',input));
const projectRequest=async(input:ProjectRequest)=>ProjectResult.parse(await window.career.request('project',input));
const opportunityRequest=async(input:OpportunityRequest)=>OpportunityResult.parse(await window.career.request('opportunity',input));
const resumeRequest=async(input:ResumeRequest)=>ResumeResult.parse(await window.career.request('resume',input));
const profileRequest=async(input:ProfileRequest)=>ProfileResult.parse(await window.career.request('profile',input));
function Workspace(){
 const [workspace,setWorkspace]=useState<string>(),[error,setError]=useState(''),[epoch,setEpoch]=useState(0);
 const [focusOpportunity,setFocusOpportunity]=useState<{id:string;sequence:number}>();
 const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}}));
 const route=resolveRoute(useLocation().pathname),navigate=useNavigate();
 const lastResume=useRef<string|undefined>(undefined);if(route.view==='resume')lastResume.current=route.opportunityId;
 const employmentRequest=useCallback(async(input:EmploymentRequest)=>{const result=EmploymentResult.parse(await window.career.request('employment',input));if(!['list','read','history','person.history'].includes(input.operation)&&(result.kind==='employment'||result.kind==='person'))setEpoch(value=>value+1);return result;},[]);
 useEffect(()=>{void window.career.ready().then(value=>setWorkspace(Identity.parse(value).workspaceInstance)).catch(()=>setError('工作区连接失败，请重新连接。'));},[]);
 if(!workspace)return <main><p>{error||'正在打开工作区…'}</p>{error&&<button onClick={async()=>{try{setWorkspace(Identity.parse(await window.career.reconnect()).workspaceInstance);setError('');}catch{setError('连接暂不可用，请重试。');}}}>重新连接工作区</button>}</main>;
 return <QueryClientProvider client={client}><CareerShell pages={{
  wiki:<><WikiPage request={wikiRequest} materials={window.careerMaterials} workspaceInstance={workspace}/><RawImport/></>,
  employment:<EmploymentPage request={employmentRequest}/>,
  project:<ProjectPage request={projectRequest} employmentRequest={employmentRequest} relationEpoch={epoch}/>,
  opportunity:<OpportunityPage focusOpportunity={focusOpportunity} request={opportunityRequest} workspaceInstance={workspace} onOpenResume={id=>navigate(resumePath(id))}/>,
 }} resume={lastResume.current?<ResumePage request={resumeRequest} profileRequest={profileRequest} opportunityId={lastResume.current} active={route.view==='resume'} onReturn={()=>{const id=lastResume.current;if(id)setFocusOpportunity(previous=>({id,sequence:(previous?.sequence??0)+1}));navigate('/opportunity');}}/>:undefined}/></QueryClientProvider>;
}
createRoot(document.getElementById('root')!).render(<HashRouter><Workspace/></HashRouter>);

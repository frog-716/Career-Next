import {useHomepagePreferences} from '../shell/preferences';
import type {PurgeNotice} from '../design-system/purge-notice';
import {flushSync} from 'react-dom';
import {sourceCatalogue,readSourceVersion,scopeCatalogue} from './source-catalogue';
import {useIntroduction,Welcome} from '../support/experience';
import {G4Support} from './g4-support';
import {createRoot} from 'react-dom/client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {HashRouter,useLocation,useNavigate} from 'react-router';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {CareerShell,resolveRoute,resumePath} from '../shell';
import {RawImport} from '../features/materials/RawImport';
import {WikiPage} from '../features/wiki';
import {WikiResearchReferences} from '../features/wiki/research';
import {OpportunitySubmodules,researchRequest} from './opportunity-submodules';
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
 const [purgeNotice,setPurgeNotice]=useState<PurgeNotice>();
 const [workspace,setWorkspace]=useState<string>(),[error,setError]=useState(''),[epoch,setEpoch]=useState(0);
 const [focusOpportunity,setFocusOpportunity]=useState<{id:string;sequence:number}>();
 const [researchFocus,setResearchFocus]=useState<{id:string;sequence:number}>();
 const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}}));
 const route=resolveRoute(useLocation().pathname),navigate=useNavigate();
 const homepage=useHomepagePreferences(workspace);const introduction=useIntroduction();const [helpOpen,setHelpOpen]=useState(false);
 const lastResume=useRef<string|undefined>(undefined);if(route.view==='resume')lastResume.current=route.opportunityId;
 const purge=(references:PurgeNotice['references'])=>{flushSync(()=>setPurgeNotice(old=>({sequence:(old?.sequence??0)+1,references})));for(const ref of references)client.removeQueries({predicate:query=>query.queryKey.includes(ref.objectId)});setEpoch(e=>e+1);};
 useEffect(()=>window.career.onPurge?.(notice=>{if(notice.workspaceInstance===workspace)purge(notice.references);}),[workspace]);
 const employmentRequest=useCallback(async(input:EmploymentRequest)=>{const result=EmploymentResult.parse(await window.career.request('employment',input));if(!['list','read','history','person.history'].includes(input.operation)&&(result.kind==='employment'||result.kind==='person'))setEpoch(value=>value+1);return result;},[]);
 useEffect(()=>{void window.career.ready().then(value=>setWorkspace(Identity.parse(value).workspaceInstance)).catch(()=>setError('工作区连接失败，请重新连接。'));},[]);
 if(!workspace)return <main><p>{error||'正在打开工作区…'}</p>{error&&<button onClick={async()=>{try{setWorkspace(Identity.parse(await window.career.reconnect()).workspaceInstance);setError('');}catch{setError('连接暂不可用，请重试。');}}}>重新连接工作区</button>}</main>;
 return <QueryClientProvider client={client}><CareerShell contextHelp={<>{homepage.status&&<p role="status">{homepage.status}</p>}<button className="career-context-help" onMouseDown={event=>event.preventDefault()} onClick={()=>setHelpOpen(true)}>这个页面怎么用</button></>} auxiliary={<G4Support preferences={homepage} helpOpen={helpOpen} onHelp={()=>setHelpOpen(true)} onHelpClose={()=>setHelpOpen(false)} onFinishTutorial={introduction.finish} purgeNotice={purgeNotice} onPurge={purge} key={workspace} workspaceInstance={workspace} onRestore={async()=>{const identity=Identity.parse(await window.career.ready());flushSync(()=>setWorkspace(undefined));client.clear();lastResume.current=undefined;setFocusOpportunity(undefined);setResearchFocus(undefined);setWorkspace(identity.workspaceInstance);setEpoch(e=>e+1);navigate('/wiki');}} onApplied={()=>setEpoch(e=>e+1)}/>} welcome={route.view==='module'&&route.module===(homepage.pinned??'wiki')?<Welcome introduction={introduction} onTutorial={()=>setHelpOpen(true)}/>:undefined} key={workspace} pinned={homepage.pinned} order={homepage.order} pages={{
  wiki:<><WikiPage changeEpoch={epoch} purgeNotice={purgeNotice} request={wikiRequest} scopeCatalogue={scopeCatalogue} sourceCatalogue={sourceCatalogue} readSourceVersion={readSourceVersion} materials={window.careerMaterials} workspaceInstance={workspace}/><WikiResearchReferences purgeNotice={purgeNotice} opportunityRequest={opportunityRequest} researchRequest={researchRequest} onOpenOwner={id=>{setFocusOpportunity(previous=>({id,sequence:(previous?.sequence??0)+1}));setResearchFocus(previous=>({id,sequence:(previous?.sequence??0)+1}));navigate('/opportunity');}}/><RawImport purgeNotice={purgeNotice}/></>,
  employment:<EmploymentPage purgeNotice={purgeNotice} request={employmentRequest}/>,
  project:<ProjectPage purgeNotice={purgeNotice} request={projectRequest} employmentRequest={employmentRequest} relationEpoch={epoch}/>,
  opportunity:<OpportunityPage purgeNotice={purgeNotice} focusOpportunity={focusOpportunity} request={opportunityRequest} workspaceInstance={workspace} onOpenResume={id=>navigate(resumePath(id))} renderSubmodules={(opportunity,onChanged)=><OpportunitySubmodules purgeNotice={purgeNotice} opportunity={opportunity} workspaceInstance={workspace} onChanged={onChanged} openResearch={researchFocus?.id===opportunity.id?researchFocus.sequence:undefined}/>}/>,
 }} resume={lastResume.current?<ResumePage purgeNotice={purgeNotice} request={resumeRequest} profileRequest={profileRequest} opportunityId={lastResume.current} active={route.view==='resume'} onReturn={()=>{const id=lastResume.current;if(id)setFocusOpportunity(previous=>({id,sequence:(previous?.sequence??0)+1}));navigate('/opportunity');}}/>:undefined}/></QueryClientProvider>;
}
createRoot(document.getElementById('root')!).render(<HashRouter><Workspace/></HashRouter>);

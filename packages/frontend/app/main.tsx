import {RelatedProjects} from './related-projects';
import {ResumeOpportunityContext,OpportunityOverview} from './opportunity-context';
import {useHomepagePreferences} from '../shell/preferences';
import type {PurgeNotice} from '../design-system/purge-notice';
import {flushSync} from 'react-dom';
import {sourceCatalogue,readSourceVersion,scopeCatalogue} from './source-catalogue';
import {useIntroduction,Onboarding} from '../support/experience';
import {G4Support} from './g4-support';
import {createRoot} from 'react-dom/client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {HashRouter,useLocation,useNavigate} from 'react-router';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {CareerShell,resolveRoute,resumePath,opportunityPath} from '../shell';
import {RawImport} from '../features/materials/RawImport';
import {MaterialSources} from '../features/materials/MaterialSources';
import {WikiPage} from '../features/wiki';
import {WikiResearchReferences} from '../features/wiki/research';
import {OpportunitySubmodules,researchRequest,communicationRequest} from './opportunity-submodules';
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
import '../design-system/aura-approved.css';
import './aura-adapter.css';
const wikiRequest=async(input:WikiRequest)=>WikiResult.parse(await window.career.request('wiki',input));

const opportunityRequest=async(input:OpportunityRequest)=>OpportunityResult.parse(await window.career.request('opportunity',input));
const resumeRequest=async(input:ResumeRequest)=>ResumeResult.parse(await window.career.request('resume',input));
const profileRequest=async(input:ProfileRequest)=>ProfileResult.parse(await window.career.request('profile',input));
function Workspace(){
 const [wikiFocus,setWikiFocus]=useState<{scope:'project'|'employment'|'person';scopeId:string;sequence:number}>(),[projectFocus,setProjectFocus]=useState<{id:string;sequence:number}>();
 function openWiki(scope:'project'|'employment'|'person',scopeId:string){setWikiFocus(old=>({scope,scopeId,sequence:(old?.sequence??0)+1}));navigate('/wiki');}
 function openProject(id:string){setProjectFocus(old=>({id,sequence:(old?.sequence??0)+1}));navigate('/project');}
 const [purgeNotice,setPurgeNotice]=useState<PurgeNotice>();
 const [workspace,setWorkspace]=useState<string>(),[error,setError]=useState(''),[epoch,setEpoch]=useState(0);
 const [offline,setOffline]=useState(false),[invalidated,setInvalidated]=useState(false);
 useEffect(()=>{const disconnected=()=>setOffline(true),connected=()=>setOffline(false),changed=()=>{setInvalidated(true);setWorkspace(undefined);};window.addEventListener('career-backend-disconnected',disconnected);window.addEventListener('career-connection-changed',connected);window.addEventListener('career-workspace-invalidated',changed);return()=>{window.removeEventListener('career-backend-disconnected',disconnected);window.removeEventListener('career-connection-changed',connected);window.removeEventListener('career-workspace-invalidated',changed);};},[]);
 const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}}));
 const route=resolveRoute(useLocation().pathname),navigate=useNavigate();
 const homepage=useHomepagePreferences(workspace);const introduction=useIntroduction();const [helpOpen,setHelpOpen]=useState(false);
 const [resumeHeading,setResumeHeading]=useState<{id:string;companyName:string;role:string}>();
 const lastResume=useRef<string|undefined>(undefined);if(route.view==='resume')lastResume.current=route.opportunityId;
 const purge=(references:PurgeNotice['references'])=>{flushSync(()=>setPurgeNotice(old=>({sequence:(old?.sequence??0)+1,references})));for(const ref of references)client.removeQueries({predicate:query=>query.queryKey.includes(ref.objectId)});setEpoch(e=>e+1);};
 useEffect(()=>window.career.onPurge?.(notice=>{if(notice.workspaceInstance===workspace)purge(notice.references);}),[workspace]);
 const projectRequest=useCallback(async(input:ProjectRequest)=>{const result=ProjectResult.parse(await window.career.request('project',input));if(!['list','read','history'].includes(input.operation)&&result.kind==='project')setEpoch(value=>value+1);return result;},[]);
 const employmentRequest=useCallback(async(input:EmploymentRequest)=>{const result=EmploymentResult.parse(await window.career.request('employment',input));if(!['list','read','history','person.history'].includes(input.operation)&&(result.kind==='employment'||result.kind==='person'))setEpoch(value=>value+1);return result;},[]);
 useEffect(()=>{void window.career.ready().then(value=>setWorkspace(Identity.parse(value).workspaceInstance)).catch(()=>setError('工作区连接失败，请重新连接。'));},[]);
 if(!workspace)return <main><p>{invalidated?'资料库已切换，请重新载入。旧页面不会向新资料库保存。':error||'正在打开工作区…'}</p>{invalidated?<button onClick={()=>location.reload()}>重新载入</button>:error&&<button onClick={async()=>{try{setWorkspace(Identity.parse(await window.career.reconnect()).workspaceInstance);setError('');}catch{setError('连接暂不可用，请重试。');}}}>重新连接工作区</button>}</main>;
 return <QueryClientProvider client={client}><CareerShell contextHelp={<>{offline&&<p role="status">本地后台暂时断开。你的当前输入仍在；后台启动后可以继续。<button className="button" onClick={async()=>{try{await window.career.reconnect();setOffline(false);}catch{setError('连接暂不可用，请先启动 Career。');}}}>重新连接</button></p>}{introduction.automatic&&<Onboarding onFinish={introduction.finish}/>} {homepage.status&&<p role="status">{homepage.status}</p>}</>} auxiliary={<G4Support onOpenOpportunity={id=>navigate(opportunityPath(id,'overview'))} preferences={homepage} helpOpen={helpOpen} onHelp={()=>setHelpOpen(true)} onHelpClose={()=>setHelpOpen(false)} onFinishTutorial={introduction.finish} purgeNotice={purgeNotice} onPurge={purge} key={workspace} workspaceInstance={workspace} onRestore={async()=>{const identity=Identity.parse(await window.career.ready());flushSync(()=>setWorkspace(undefined));client.clear();lastResume.current=undefined;setWorkspace(identity.workspaceInstance);setEpoch(e=>e+1);navigate('/wiki');}} onApplied={()=>setEpoch(e=>e+1)}/>} key={workspace} onReorder={homepage.reorder} reorderBusy={homepage.busy} pinned={homepage.pinned} order={homepage.order} pages={{
  wiki:<><WikiPage focusScope={wikiFocus} changeEpoch={epoch} purgeNotice={purgeNotice} request={wikiRequest} scopeCatalogue={scopeCatalogue} sourceCatalogue={sourceCatalogue} readSourceVersion={readSourceVersion} materials={window.careerMaterials} workspaceInstance={workspace} importContent={onUse=><MaterialSources local={<RawImport diagnostics={window.career.developmentDiagnostics===true} purgeNotice={purgeNotice} onUse={onUse}/>}/>} researchContent={<WikiResearchReferences purgeNotice={purgeNotice} opportunityRequest={opportunityRequest} researchRequest={researchRequest} onOpenOwner={id=>navigate(opportunityPath(id,'research'))}/>}/></>,
  employment:<EmploymentPage onOpenWiki={openWiki} renderProjects={(employmentId,personId)=><RelatedProjects employmentId={employmentId} personId={personId} epoch={epoch} request={projectRequest} onOpen={openProject} onManage={()=>navigate('/project')}/>} purgeNotice={purgeNotice} request={employmentRequest}/>,
  project:<ProjectPage focusProject={projectFocus} onOpenWiki={id=>openWiki('project',id)} purgeNotice={purgeNotice} request={projectRequest} employmentRequest={employmentRequest} relationEpoch={epoch}/>,
  opportunity:<OpportunityPage readCommunications={id=>communicationRequest({operation:'communication.list',opportunityId:id})} active={route.view==='opportunity-detail'||route.view==='module'&&route.module==='opportunity'} purgeNotice={purgeNotice} detail={route.view==='opportunity-detail'?{id:route.opportunityId,section:route.section}:undefined} onNavigate={(id,section)=>navigate(id?opportunityPath(id,section):'/opportunity')} request={opportunityRequest} workspaceInstance={workspace} onOpenResume={id=>navigate(resumePath(id))} renderOverview={opportunity=><OpportunityOverview opportunity={opportunity} active={route.view==='opportunity-detail'&&route.section==='overview'} onSection={section=>navigate(section==='resume'?resumePath(opportunity.id):opportunityPath(opportunity.id,section))}/>} renderSubmodules={(opportunity,onChanged,section)=><OpportunitySubmodules purgeNotice={purgeNotice} opportunity={opportunity} workspaceInstance={workspace} onChanged={onChanged} section={section}/>}/>,
 }} resume={lastResume.current?<><ResumeOpportunityContext onRead={setResumeHeading} active={route.view==='resume'} purgeNotice={purgeNotice} id={lastResume.current} request={opportunityRequest} onList={()=>navigate('/opportunity')} onSection={section=>{const id=lastResume.current!;navigate(section==='resume'?resumePath(id):opportunityPath(id,section));}}/><ResumePage heading={resumeHeading} embedded purgeNotice={purgeNotice} request={resumeRequest} profileRequest={profileRequest} opportunityId={lastResume.current} active={route.view==='resume'} onReturn={()=>{const id=lastResume.current;if(id)navigate(opportunityPath(id,'overview'));}}/></>:undefined}/></QueryClientProvider>;
}
createRoot(document.getElementById('root')!).render(<HashRouter><Workspace/></HashRouter>);

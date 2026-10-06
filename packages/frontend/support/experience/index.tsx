import {useEffect,useState,useRef} from 'react';
import {useLocation} from 'react-router';
import guide from '../../../../docs/ux/USER-GUIDE.md?raw';
import './experience.css';
const key='career.ui.introduction.v1';
type UiState={finished:boolean;welcomeCollapsed:boolean};
function read():UiState{try{const s=JSON.parse(localStorage.getItem(key)??'null');return {finished:s?.finished===true,welcomeCollapsed:s?.welcomeCollapsed===true};}catch{return {finished:false,welcomeCollapsed:false};}}
/** Device-profile presentation preferences only; never business commands, backup data or AI permissions. */
export function useIntroduction(){
 const [state,setState]=useState(read);const initialPath=useRef(useLocation().pathname);
 useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key===key)setState(read());};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
 function update(patch:Partial<UiState>){setState(old=>{const next={...old,...patch};try{localStorage.setItem(key,JSON.stringify(next));}catch{/* A blocked device preference never blocks a business task. */}return next;});}
 return {...state,automatic:initialPath.current==='/'&&!state.finished,finish:()=>update({finished:true}),collapse:(welcomeCollapsed:boolean)=>update({welcomeCollapsed})};
}
const steps=[
 {title:'你的长期职业工作台',body:'Career 帮你推进求职，也陪你积累项目、工作经历和职业资料。无需先配置 AI，也不用一次填完所有内容。'},
 {title:'四个入口，各有用途',body:'Wiki：可复用的资料和经验。机会：正在接触的工作。项目：做过或正在做的事。任职：一段真实工作经历。'},
 {title:'求职一般从机会开始',body:'公司 + 岗位就能建立一个机会，岗位介绍可以以后补。简历属于具体机会，从那份机会里面进入。'},
 {title:'开始工作后，继续积累',body:'真正入职后，记录任职、项目和相关人物。以后可以从帮助重新查看教程。'}
];
export function Onboarding({onFinish}:{onFinish():void}){
 const [step,setStep]=useState(0);return <section className="career-onboarding" role="region" aria-label="新手教程"><p>第 {step+1} 步 / 4</p><h3>{steps[step].title}</h3><p>{steps[step].body}</p><div className="actions"><button disabled={step===0} onClick={()=>setStep(step-1)}>上一步</button>{step<3?<button onClick={()=>setStep(step+1)}>下一步</button>:<button onClick={onFinish}>完成</button>}<button onClick={onFinish}>跳过</button></div></section>;
}
const questions=guide.split(/^## /m).slice(1).map(part=>({title:part.slice(0,part.indexOf('\n')).trim(),paragraphs:part.slice(part.indexOf('\n')+1).trim().split(/\n\s*\n/)}));
export function HelpContent({onFinishTutorial}:{onFinishTutorial():void}){
 const [tutorial,setTutorial]=useState(false),[tutorialSession,setTutorialSession]=useState(0);return <div className="career-guide"><p>Career，我的长期职业工作台。先处理一件真实的事，其他资料以后再补。</p><button onClick={()=>{setTutorialSession(old=>old+1);setTutorial(true);}}>重新查看新手教程</button>{tutorial&&<Onboarding key={tutorialSession} onFinish={()=>{onFinishTutorial();setTutorial(false);}}/>}<p>要打开简历、情报或面试，请先选择对应机会。</p>{questions.map(question=><details key={question.title}><summary>{question.title}</summary>{question.paragraphs.map((text,index)=><p key={index}>{text}</p>)}</details>)}</div>;
}

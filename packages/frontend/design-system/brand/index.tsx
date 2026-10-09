import {useLayoutEffect,useRef,useId} from 'react';
import leopard from './leopard.svg?raw';
import './brand.css';
const duration=3300,speed=.75;
const flamePositions=[[9,29,2/3],[10,19,2/3],[17,12,2/3],[27,9,2/3],[37,14,.4],[46,22,.4],[53,33,.4],[47,42,.4],[34,47,2/3],[21,48,2/3]];
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const smooth=(value:number)=>value*value*(3-2*value);
const out=(value:number)=>1-(1-value)**4;
const progress=(time:number,from:number,to:number,ease=out)=>ease(clamp((time-from)/(to-from)));
/** Transparent vector lockup: contour construction → ink → letter registration → quiet final mark. */
export function CareerBrand(){
 const root=useRef<HTMLDivElement>(null),replay=useRef(()=>{}),leave=useRef(()=>{}),id=useId().replace(/[^a-zA-Z0-9]/g,'');
 useLayoutEffect(()=>{
  const logo=root.current!,head=logo.querySelector<HTMLElement>('.career-brand-head')!,ink=logo.querySelector<HTMLElement>('.career-brand-ink')!,draft=logo.querySelector<HTMLElement>('.career-brand-draft')!,lit=logo.querySelector<HTMLElement>('.career-brand-lit')!,flare=logo.querySelector<SVGElement>('.career-brand-flare')!,flames=[...logo.querySelectorAll<SVGElement>('.career-brand-flame')],eye=logo.querySelector<SVGElement>('.career-brand-eye')!,trace=logo.querySelector<SVGElement>('.career-brand-trace')!,guide=logo.querySelector<SVGElement>('.career-brand-guides')!,word=logo.querySelector<HTMLElement>('.career-brand-name')!,letters=[...logo.querySelectorAll<HTMLElement>('.career-brand-letter')];
  const contours=[...draft.querySelectorAll<SVGPathElement>('g>path')];for(const path of contours){const length=path.getTotalLength();path.style.strokeDasharray=String(length);path.style.strokeDashoffset=String(length);path.dataset.length=String(length);}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let frame:number|undefined,playing=false,start=0,lite=false,completed=false,hovered=false;
  function stop(){if(frame!==undefined)cancelAnimationFrame(frame);frame=undefined;playing=false;}
  function rest(){stop();logo.dataset.phase='rest';head.style.transform='none';ink.style.clipPath='none';ink.style.opacity='1';ink.style.filter='none';lit.style.opacity='0';flare.style.opacity='0';flames.forEach(flame=>flame.style.opacity='0');draft.style.opacity='0';guide.style.opacity='0';eye.style.opacity='0';trace.style.opacity='0';word.style.letterSpacing='1px';letters.forEach(letter=>{letter.style.transform='none';letter.style.opacity='1';letter.style.setProperty('--letter-ink','1');letter.style.setProperty('--letter-outline','0');});}
  function render(time:number){
   if(lite){const p=(time%2100)/2100,wave=(1-Math.cos(p*Math.PI*2))/2;logo.dataset.phase='breathing';head.style.transform=`translate3d(${wave*.35}px,${-wave*.9}px,0) rotate(${wave*.3}deg)`;eye.style.opacity=String(wave*.35);flare.style.opacity=String(wave*.08);flare.style.transform=`scale(${.95+wave*.1})`;trace.style.opacity=String(Math.sin(p*Math.PI)*.45);trace.style.strokeDashoffset=String(100-p*200);letters.forEach((letter,i)=>{const w=(1-Math.cos(Math.max(0,p-i*.012)*Math.PI*2))/2;letter.style.transform=`translate3d(0,${-w*.55}px,0)`;letter.style.opacity='1';});return;}
   const draw=progress(time,0,780,smooth),fill=progress(time,560,1320,smooth),registration=progress(time,1250,2460,smooth),settle=progress(time,2420,duration,smooth);
   logo.dataset.phase=time<560?'contour':time<1320?'ink':time<2460?'letters':'settle';
   draft.style.opacity=String((.12+draw*.35)*(1-fill));contours.forEach(path=>{path.style.strokeDashoffset=String(Number(path.dataset.length)*(1-draw));});
   ink.style.clipPath='none';ink.style.opacity='1';ink.style.filter=`brightness(${.25+fill*.75}) saturate(${.65+fill*.35})`;lit.style.opacity=String(Math.sin(fill*Math.PI)*.7);lit.style.maskImage=`radial-gradient(ellipse ${12+fill*120}% ${10+fill*130}% at 65% 41%,#000 0%,#0009 45%,transparent 78%)`;const fire=progress(time,500,1520,smooth),fade=1-progress(time,1560,2460,smooth);flare.style.opacity=String(Math.sin(fire*Math.PI)*.42);flare.style.transform=`translate3d(0,${-fire*2}px,0) scale(${.65+fire*.6})`;flames.forEach((flame,i)=>{const p=clamp((time-610-i*28)/1120),pulse=Math.sin(p*Math.PI);flame.style.opacity=String(pulse*fade*(i<4?.75:.62));flame.style.transform=`translate3d(${p*(i%2?-.8:.8)}px,${-pulse*(1.8+i*.5)}px,0) scale(${(.7+p*.4)*Number(flame.dataset.size)},${(.6+p*.65)*Number(flame.dataset.size)})`;});
   head.style.transform=time>=duration?'none':`translate3d(${(1-fill)*-1.4}px,${(1-fill)*1.2}px,0) rotate(${(1-fill)*-.5}deg)`;
   const glint=progress(time,980,1140,smooth)*(1-progress(time,1180,1410,smooth));eye.style.opacity=String(glint*.7);
   guide.style.opacity='0';
   const flowing=progress(time,1130,2200,smooth);trace.style.strokeDashoffset=String(100-flowing*200);trace.style.opacity=String(Math.sin(flowing*Math.PI)*.55);
   word.style.letterSpacing=`${1+(1-registration)*.85}px`;
   letters.forEach((letter,i)=>{const begin=1160+i*95,p=progress(time,begin,begin+880,smooth),inkProgress=progress(time,begin+340,begin+900,smooth),angle=(i%2?-1:1)*(1-p)*5;
    letter.style.opacity=String(.65+p*.35);letter.style.transform=`translate3d(${(1-p)*(i-2.5)*.55}px,${(1-p)*(i%2?2.8:-2)}px,0) rotate(${angle}deg)`;letter.style.setProperty('--letter-ink',String(inkProgress));letter.style.setProperty('--letter-outline',String((1-inkProgress)*.7));
   });
  }
  function waiting(){stop();render(0);logo.dataset.phase='waiting';}
  function breathe(){if(!hovered||reduced.matches||document.hidden){rest();return;}lite=true;playing=true;start=performance.now();render(0);frame=requestAnimationFrame(tick);}
  function tick(now:number){const time=(now-start)*speed;if(lite){if(!hovered){rest();return;}render(time);frame=requestAnimationFrame(tick);return;}render(Math.min(duration,time));if(time<duration)frame=requestAnimationFrame(tick);else{completed=true;rest();if(hovered)breathe();}}
  function enter(){hovered=true;if(playing||reduced.matches||document.hidden)return;if(completed){breathe();return;}lite=false;playing=true;start=performance.now();render(0);frame=requestAnimationFrame(tick);}
  function exit(){hovered=false;if(lite)rest();}
  function motion(){if(reduced.matches)rest();else if(completed)rest();else waiting();}
  function visibility(){if(document.hidden){if(completed)rest();else waiting();}}
  replay.current=enter;leave.current=exit;reduced.addEventListener('change',motion);document.addEventListener('visibilitychange',visibility);motion();
  return()=>{stop();replay.current=()=>{};leave.current=()=>{};reduced.removeEventListener('change',motion);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 return <div ref={root} className="career-brand" role="img" aria-label="Career 豹头与字标" onMouseEnter={()=>replay.current()} onMouseLeave={()=>leave.current()}>
  <span className="career-brand-head"><span className="career-brand-vector career-brand-draft" aria-hidden="true" dangerouslySetInnerHTML={{__html:leopard.replaceAll('b6-',id+'-draft-')}}/><span className="career-brand-vector career-brand-ink" aria-hidden="true" dangerouslySetInnerHTML={{__html:leopard.replaceAll('b6-',id+'-ink-')}}/><span className="career-brand-vector career-brand-lit" aria-hidden="true" dangerouslySetInnerHTML={{__html:leopard.replaceAll('b6-',id+'-lit-')}}/><svg className="career-brand-eye-overlay" viewBox="0 5 353 379" aria-hidden="true"><defs><radialGradient id={id+'-eye'}><stop stopColor="#fff3c4"/><stop offset=".45" stopColor="#ffd67c"/><stop offset="1" stopColor="#e0aa4b" stopOpacity="0"/></radialGradient><radialGradient id={id+'-fire'}><stop stopColor="#fff4ca"/><stop offset=".28" stopColor="#ffd57a" stopOpacity=".75"/><stop offset=".65" stopColor="#ee9b3b" stopOpacity=".2"/><stop offset="1" stopColor="#ee9b3b" stopOpacity="0"/></radialGradient></defs><ellipse className="career-brand-flare" cx="222" cy="160" rx="145" ry="160" fill={`url(#${id}-fire)`}/><circle className="career-brand-eye" cx="237" cy="149" r="9" fill={`url(#${id}-eye)`}/></svg></span>
  <span className="career-brand-name" aria-hidden="true">{[...'Career'].map((letter,i)=><span className="career-brand-letter" data-letter={letter} key={i}>{letter}</span>)}</span>
  <svg className="career-brand-line" viewBox="0 0 60 84" aria-hidden="true"><defs><linearGradient id={id+'-line'} x1="26" y1="38" x2="14" y2="57" gradientUnits="userSpaceOnUse"><stop stopColor="#edc180"/><stop offset=".5" stopColor="#c79950"/><stop offset="1" stopColor="#72815c"/></linearGradient></defs><g className="career-brand-guides"><path d="M6 9H52M8 6V49M4 54H56M4 68H56M4 52V70M56 52V70"/></g><defs><linearGradient id={id+'-ember'} x1="0" y1="1" x2=".6" y2="0"><stop stopColor="#e45814"/><stop offset=".5" stopColor="#ff9d30"/><stop offset="1" stopColor="#ffd678"/></linearGradient></defs><g className="career-brand-fire">{flamePositions.map(([x,y,size],i)=><g key={i} transform={`translate(${x} ${y})`}><g className="career-brand-flame" data-size={size}><path d="M0 0C-2.6-2.2-2-4.3-.5-6C.6-7.3.5-9.1 1-10.2C1.6-7.7 4.1-6.1 3.4-3.9C2.9-2.2 1.4-.7 0 0Z" fill={`url(#${id}-ember)`}/><path d="M.3-1.7C-.7-3 .2-4.2 1-5.5C1.1-4.1 2.2-3.8 1.8-3C1.4-2.4.9-2 .3-1.7Z" fill="#ffeab1"/></g></g>)}</g><path className="career-brand-trace" pathLength="100" d="M26 38C25 46 9 50 14 57" stroke={`url(#${id}-line)`}/></svg>
 </div>;
}

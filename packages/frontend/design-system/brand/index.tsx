import {useEffect,useRef,useId} from 'react';
import leopard from './leopard.svg?raw';
import './brand.css';
const duration=2400, speed=.75;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const out=(v:number)=>1-(1-v)**3;
const smooth=(v:number)=>v<.5?4*v**3:1-(-2*v+2)**3/2;
const quint=(v:number)=>1-(1-v)**5;
const back=(v:number)=>1+2.56*(v-1)**3+1.56*(v-1)**2;
const progress=(t:number,a:number,b:number,ease=out)=>ease(clamp((t-a)/(b-a)));
/** Approved C lockup. Decorative only; never a route, account or business state. */
export function CareerBrand(){
 const root=useRef<HTMLDivElement>(null),replay=useRef(()=>{}),id=useId().replace(/[^a-zA-Z0-9]/g,'');
 useEffect(()=>{
  const logo=root.current!;const head=logo.querySelector<HTMLElement>('.career-brand-head')!,eye=logo.querySelector<SVGElement>('.career-brand-eye')!,trace=logo.querySelector<SVGElement>('.career-brand-trace')!,word=logo.querySelector<HTMLElement>('.career-brand-name')!,letters=[...logo.querySelectorAll<HTMLElement>('.career-brand-letter')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let frame:number|undefined,playing=false,start=0;
  function stop(){if(frame!==undefined)cancelAnimationFrame(frame);frame=undefined;playing=false;}
  function render(t:number){
   const rise=progress(t,0,350,smooth),lift=progress(t,350,1100),settle=progress(t,1100,2400,quint);
   const y=t<350?rise*1.2:t<1100?1.2-lift*2:-.8*(1-settle),turn=t<350?rise*.6:t<1100?.6-lift:-.4*(1-settle);
   head.style.transform=t===duration?'none':`translate3d(0,${y}px,0) rotate(${turn}deg)`;
   const glint=progress(t,280,440)*(1-progress(t,440,600,smooth));eye.style.opacity=String(glint*.85);eye.style.transform=`scale(${.6+glint*.5})`;
   const flow=progress(t,520,1050,smooth),decay=progress(t,1050,1350);trace.style.opacity=String(progress(t,520,660)*(1-decay)*.9);trace.style.strokeDashoffset=String(100-flow*100-decay*100);
   word.style.letterSpacing=`${1+.6*(1-progress(t,900,2400,quint))}px`;
   letters.forEach((letter,i)=>{const begin=i===0?900:1020+(i-1)*45,end=begin+600,p=clamp((t-begin)/(end-begin)),arrive=progress(t,begin,end,i===0?back:quint),recoil=Math.sin(p*Math.PI*3)*(1-p)**2;
    letter.style.opacity=String((i===0?.35:.3)+(i===0?.65:.7)*clamp(arrive));letter.style.transform=t>=end?'none':`translate3d(${recoil*1.15}px,${(1-arrive)*(i===0?4.8:4)}px,0) rotate(${recoil*4.5}deg)`;
   });
  }
  function tick(now:number){const t=Math.min(duration,(now-start)*speed);render(t);if(t<duration)frame=requestAnimationFrame(tick);else stop();}
  function play(){if(playing||reduced.matches||document.hidden)return;stop();playing=true;start=performance.now();render(0);frame=requestAnimationFrame(tick);}
  function rest(){stop();render(duration);}
  function visibility(){if(document.hidden)rest();}
  replay.current=play;reduced.addEventListener('change',rest);document.addEventListener('visibilitychange',visibility);play();
  return()=>{stop();replay.current=()=>{};reduced.removeEventListener('change',rest);document.removeEventListener('visibilitychange',visibility);};
 },[]);
 return <div ref={root} className="career-brand" role="img" aria-label="Career 豹头与字标" onMouseEnter={()=>replay.current()}>
  <span className="career-brand-head"><span className="career-brand-vector" aria-hidden="true" dangerouslySetInnerHTML={{__html:leopard.replaceAll('b6-',id+'-')}}/><svg className="career-brand-eye-overlay" viewBox="0 5 353 379" aria-hidden="true"><defs><radialGradient id={id+'-eye'}><stop stopColor="#fff3c4"/><stop offset=".45" stopColor="#ffd67c"/><stop offset="1" stopColor="#e0aa4b" stopOpacity="0"/></radialGradient></defs><circle className="career-brand-eye" cx="237" cy="149" r="9" fill={`url(#${id}-eye)`}/></svg></span>
  <span className="career-brand-name" aria-hidden="true">{[...'Career'].map((letter,i)=><span className="career-brand-letter" key={i}>{letter}</span>)}</span>
  <svg className="career-brand-line" viewBox="0 0 60 84" aria-hidden="true"><defs><linearGradient id={id+'-line'} x1="26" y1="38" x2="14" y2="57" gradientUnits="userSpaceOnUse"><stop stopColor="#edc180"/><stop offset=".5" stopColor="#c79950"/><stop offset="1" stopColor="#72815c"/></linearGradient></defs><path className="career-brand-trace" pathLength="100" d="M26 38C25 46 9 50 14 57" stroke={`url(#${id}-line)`}/></svg>
 </div>;
}

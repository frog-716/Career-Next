import {CareerBrand} from '../design-system/brand';
import {NavigationIcon} from '../design-system/NavigationIcon';
import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import { Link,useLocation } from 'react-router';
import { navigationManifest,resolveRoute,type NavigationId } from './routes';
import { Panel } from '../design-system/Panel';
import styles from './shell.module.css';
import '../design-system/tokens.css';
export { navigationManifest,resolveRoute,resumePath,opportunityPath } from './routes';
export interface ShellProps{pages:Record<NavigationId,ReactNode>;resume?:ReactNode;contextHelp?:ReactNode;auxiliary?:ReactNode;pinned?:NavigationId|null;order?:NavigationId[];onReorder?:(order:NavigationId[])=>Promise<void>;reorderBusy?:boolean;}
/** Hidden views stay mounted so navigation cannot discard an owner editor session. */
export function CareerShell({pages,resume,contextHelp,auxiliary,pinned,order,onReorder,reorderBusy}:ShellProps){
 const route=resolveRoute(useLocation().pathname);
 const base=order&&order.length===4&&new Set(order).size===4?order:navigationManifest.map(entry=>entry.id);
 const ids=pinned?[pinned,...base.filter(id=>id!==pinned)]:base;
 const [preview,setPreview]=useState<NavigationId[]>(),[ghost,setGhost]=useState<{id:NavigationId;left:number;top:number}>();
 const root=useRef<HTMLDivElement>(null),drag=useRef<{id:NavigationId;x:number;y:number;offset:number;started:boolean;order:NavigationId[]}|undefined>(undefined),suppressClick=useRef(false),positions=useRef(new Map<string,number>());
 const shown=preview??ids,entries=shown.map(id=>navigationManifest.find(entry=>entry.id===id)!).filter(Boolean);
 useLayoutEffect(()=>{if(!root.current)return;const items=[...root.current.querySelectorAll<HTMLElement>('[data-module]')],next=new Map<string,number>();for(const item of items){const id=item.dataset.module!,top=item.getBoundingClientRect().top,old=positions.current.get(id);next.set(id,top);if(old!==undefined&&old!==top&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&!item.classList.contains('drag-placeholder'))item.animate([{transform:`translateY(${old-top}px)`},{transform:'none'}],{duration:240,easing:'cubic-bezier(.16,1,.3,1)'});}positions.current=next;},[shown.join(',')]);
 function finish(cancel=false){const current=drag.current;drag.current=undefined;setGhost(undefined);if(!current?.started)return;const next=preview??ids;setPreview(undefined);if(!cancel&&onReorder)void onReorder(next);setTimeout(()=>{suppressClick.current=false;},50);}
 function keyboardMove(id:NavigationId,direction:number){if(!onReorder||reorderBusy)return;const next=[...ids],index=next.indexOf(id),to=index+direction;if(to<0||to>=4||pinned&&(id===pinned||to===0))return;[next[index],next[to]]=[next[to],next[index]];void onReorder(next);}
 return <div className={styles.shell}>
  <nav className={styles.sidebar+' rail'} aria-label="一级导航"><CareerBrand/><div ref={root} className={styles.business+' nav-items'} onPointerMove={event=>{const current=drag.current;if(!current)return;if(!current.started&&Math.hypot(event.clientX-current.x,event.clientY-current.y)>5){current.started=true;suppressClick.current=true;}if(!current.started)return;event.preventDefault();const item=root.current?.querySelector<HTMLElement>(`[data-module="${current.id}"]`);setGhost({id:current.id,left:item?.getBoundingClientRect().left??12,top:event.clientY-current.offset});const others=[...root.current!.querySelectorAll<HTMLElement>('[data-module]')].filter(item=>item.dataset.module!==current.id),before=others.find(item=>event.clientY<item.getBoundingClientRect().top+item.offsetHeight/2),next=(preview??ids).filter(id=>id!==current.id),index=before?next.indexOf(before.dataset.module as NavigationId):next.length;next.splice(Math.max(pinned?1:0,index),0,current.id);setPreview(next);}} onPointerUp={()=>finish()} onPointerCancel={()=>finish(true)}>{entries.map(entry=><Link key={entry.id} to={entry.path} draggable={false} onDragStart={event=>event.preventDefault()} onPointerDown={event=>{if(event.button!==0||!onReorder||reorderBusy||entry.id===pinned)return;const box=event.currentTarget.getBoundingClientRect();drag.current={id:entry.id,x:event.clientX,y:event.clientY,offset:event.clientY-box.top,started:false,order:ids};event.currentTarget.setPointerCapture(event.pointerId);}} onClick={event=>{if(suppressClick.current){event.preventDefault();suppressClick.current=false;}}} onKeyDown={event=>{if(event.key==='Escape'&&drag.current){event.preventDefault();finish(true);}if(event.altKey&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();keyboardMove(entry.id,event.key==='ArrowUp'?-1:1);}}} data-module={entry.id} className={styles.link+' rail-item '+(route.view!=='not-found'&&route.module===entry.id?'active':'')+(ghost?.id===entry.id?' drag-placeholder':'')} aria-current={route.view!=='not-found'&&route.module===entry.id?'page':undefined}><NavigationIcon name={entry.id}/><span className={styles.label}>{entry.label}</span></Link>)}</div><div className={styles.auxiliary} role="group" aria-label="辅助入口">{auxiliary}</div></nav>
  {ghost&&createPortal(<div className="rail-item drag-ghost" aria-hidden="true" style={{left:ghost.left,top:ghost.top}}><NavigationIcon name={ghost.id}/><span>{navigationManifest.find(entry=>entry.id===ghost.id)?.label}</span></div>,document.body)}
  <main className={styles.content}>
   {contextHelp}
   {navigationManifest.map(entry=><div key={entry.id} hidden={route.view==='not-found'||route.view==='resume'||route.module!==entry.id} data-module={entry.id}>{pages[entry.id]}</div>)}
   <div hidden={route.view!=='resume'} data-module="opportunity-resume">{resume??(route.view==='resume'?<Panel label="简历入口"><p>这个简历入口暂不可用，请返回所属机会。</p></Panel>:null)}</div>
   {route.view==='not-found'&&<Panel label="链接错误"><h1>链接暂不可访问</h1><p>请检查对象链接，或使用侧栏返回业务入口。</p></Panel>}
  </main>
 </div>;
}

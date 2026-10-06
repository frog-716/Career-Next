import{useEffect,useRef,useState}from'react';
import{NavigationIcon}from'../../design-system/NavigationIcon';
/** Approved ellipsis entry; existing read-only refresh stays a secondary action. */
export function PipelineActions({onRefresh}:{onRefresh():void}){
 const[open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null);
 useEffect(()=>{const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 return <div ref={root} className="pipeline-actions" onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);root.current?.querySelector('button')?.focus();}}}><button className="icon-button" aria-label="机会更多" aria-expanded={open} onClick={()=>setOpen(true)}><NavigationIcon name="more"/></button><div hidden={!open} role="region" aria-label="机会更多操作" className="pipeline-actions-popover"><button onClick={()=>{setOpen(false);onRefresh();}}>刷新</button></div></div>;
}

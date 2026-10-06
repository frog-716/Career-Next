import {NavigationIcon} from '../../design-system/NavigationIcon';
import {useEffect,useLayoutEffect,useId,useRef,useState,type ReactNode} from 'react';
import '../../design-system/aura-approved.css';
import './avatar-menu.css';
/** A Feishu connection identity is supplied independently of business Profile. No login or remote avatar fetch is performed here. */
export type FeishuConnectionIdentity={name:string;avatar:ReactNode};
export function AvatarMenu({children,onConnection,connection}:{children:ReactNode;onConnection():void;connection?:FeishuConnectionIdentity}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),menu=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),task=useRef<HTMLElement|null>(null),range=useRef<Range|null>(null),latched=useRef(false),id=useId();
 function cancel(){clearTimeout(timer.current);}
 function show(){cancel();if(open)return;task.current=document.activeElement as HTMLElement;const selection=window.getSelection();range.current=selection?.rangeCount?selection.getRangeAt(0).cloneRange():null;setOpen(true);}
 function restore(){const element=task.current;if(!element?.isConnected)return;element.focus({preventScroll:true});if(element.isContentEditable&&range.current){try{const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range.current);}catch{/* Changed owner DOM cannot accept stale ranges. */}}}
 useLayoutEffect(()=>{if(!open)return;function place(){if(root.current?.closest('nav.rail'))return;const panel=menu.current,button=root.current?.querySelector('button');if(!panel||!button)return;panel.style.bottom='auto';const box=button.getBoundingClientRect(),height=panel.offsetHeight;panel.style.left=Math.max(10,Math.min(innerWidth-panel.offsetWidth-10,box.left))+'px';panel.style.top=Math.max(10,Math.min(innerHeight-height-10,box.top-height-12>10?box.top-height-12:box.bottom+10))+'px';}place();window.addEventListener('resize',place);return()=>window.removeEventListener('resize',place);},[open]);
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node)){latched.current=false;setOpen(false);}};document.addEventListener('pointerdown',outside);return()=>{cancel();document.removeEventListener('pointerdown',outside);};},[]);
 const avatar=connection?.avatar??<NavigationIcon name="person"/>;
 return <div ref={root} className="career-connection account" onMouseEnter={show} onMouseLeave={()=>{cancel();if(!latched.current)timer.current=setTimeout(()=>setOpen(false),180);}}>
  <button className="career-avatar avatar-button" aria-label="连接与辅助菜单" aria-haspopup="menu" aria-expanded={open} aria-controls={id} onMouseDown={e=>e.preventDefault()} onClick={()=>{if(latched.current){latched.current=false;setOpen(false);restore();}else{latched.current=true;show();}}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();latched.current=true;show();requestAnimationFrame(()=>menu.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus());}}}>{avatar}</button>
  {connection&&<span className="career-connection-name">{connection.name}</span>}
  <div ref={menu} id={id} hidden={!open} className="career-avatar-menu account-menu profile-popover" role="menu" aria-label="连接与辅助菜单" onMouseDown={e=>e.preventDefault()} onClickCapture={e=>{const target=(e.target as HTMLElement).closest('[role=menuitem]');if(target&&menu.current?.contains(target)){cancel();latched.current=false;restore();setOpen(false);}}} onKeyDown={e=>{
   if(e.key==='Escape'){e.preventDefault();latched.current=false;setOpen(false);restore();return;}
   if(e.key==='Tab'){latched.current=false;setOpen(false);return;}
   if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const items=[...menu.current!.querySelectorAll<HTMLElement>('[role=menuitem]')];const i=items.indexOf(document.activeElement as HTMLElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();
  }}>
   <button className="menu-connection" role="menuitem" onClick={onConnection}><span className="menu-avatar">{avatar}</span><span className="menu-connection-copy"><strong>{connection?connection.name:'连接资料'}</strong><small>{connection?'飞书连接身份':'飞书是扩展资料来源'}</small></span></button>
   <div className="account-menu-divider"/>{children}
  </div>
 </div>;
}

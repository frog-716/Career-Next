import {useState,type ReactNode} from 'react';
import { Link,useLocation } from 'react-router';
import { navigationManifest,resolveRoute,type NavigationId } from './routes';
import { Panel } from '../design-system/Panel';
import styles from './shell.module.css';
import '../design-system/tokens.css';
export { navigationManifest,resolveRoute,resumePath } from './routes';
export interface ShellProps{pages:Record<NavigationId,ReactNode>;resume?:ReactNode;pinned?:NavigationId|null;onPin?:(id:NavigationId|null)=>void;pinBusy?:boolean;order?:NavigationId[];onReorder?:(order:NavigationId[])=>void}
/** Hidden views stay mounted so navigation cannot discard an owner editor session. */
export function CareerShell({pages,resume,pinned,onPin,pinBusy,order,onReorder}:ShellProps){
 const [collapsed,setCollapsed]=useState(false);const route=resolveRoute(useLocation().pathname);
 const base=order&&order.length===4&&new Set(order).size===4?order:navigationManifest.map(entry=>entry.id);
 const ids=pinned?[pinned,...base.filter(id=>id!==pinned)]:base;const entries=ids.map(id=>navigationManifest.find(entry=>entry.id===id)!).filter(Boolean);
 function move(id:NavigationId){const index=base.indexOf(id);if(index<1)return;const next=[...base];[next[index-1],next[index]]=[next[index]!,next[index-1]!];onReorder?.(next);}
 return <div className={`${styles.shell} ${collapsed?styles.collapsed:''}`}>
  <nav className={styles.sidebar} aria-label="一级导航"><button aria-label={collapsed?'展开侧栏':'收起侧栏'} onClick={()=>setCollapsed(!collapsed)}>{collapsed?'›':'‹'}</button>{entries.map(entry=><div key={entry.id}><Link to={entry.path} className={styles.link} aria-current={route.view!=='not-found'&&route.module===entry.id?'page':undefined}><span className={styles.icon} aria-hidden="true">{entry.icon}</span><span className={styles.label}>{entry.label}</span></Link>{onPin&&<button disabled={pinBusy} aria-label={pinned===entry.id?`取消${entry.label}置顶首页`:`置顶${entry.label}首页`} aria-pressed={pinned===entry.id} onClick={()=>onPin(pinned===entry.id?null:entry.id)}>{pinned===entry.id?'★':'☆'}</button>}{onReorder&&<button disabled={pinBusy||base.indexOf(entry.id)===0||entry.id===pinned} aria-label={`上移${entry.label}`} onClick={()=>move(entry.id)}>↑</button>}</div>)}</nav>
  <main className={styles.content}>
   {navigationManifest.map(entry=><div key={entry.id} hidden={route.view!=='module'||route.module!==entry.id} data-module={entry.id}>{pages[entry.id]}</div>)}
   <div hidden={route.view!=='resume'} data-module="opportunity-resume">{resume??(route.view==='resume'?<Panel label="简历入口"><p>这个简历入口暂不可用，请返回所属机会。</p></Panel>:null)}</div>
   {route.view==='not-found'&&<Panel label="链接错误"><h1>链接暂不可访问</h1><p>请检查对象链接，或使用侧栏返回业务入口。</p></Panel>}
  </main>
 </div>;
}

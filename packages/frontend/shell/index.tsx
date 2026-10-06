import {CareerBrand} from '../design-system/brand';
import {NavigationIcon} from '../design-system/NavigationIcon';
import {type ReactNode} from 'react';
import { Link,useLocation } from 'react-router';
import { navigationManifest,resolveRoute,type NavigationId } from './routes';
import { Panel } from '../design-system/Panel';
import styles from './shell.module.css';
import '../design-system/tokens.css';
export { navigationManifest,resolveRoute,resumePath,opportunityPath } from './routes';
export interface ShellProps{pages:Record<NavigationId,ReactNode>;resume?:ReactNode;contextHelp?:ReactNode;auxiliary?:ReactNode;pinned?:NavigationId|null;order?:NavigationId[];}
/** Hidden views stay mounted so navigation cannot discard an owner editor session. */
export function CareerShell({pages,resume,contextHelp,auxiliary,pinned,order}:ShellProps){
 const route=resolveRoute(useLocation().pathname);
 const base=order&&order.length===4&&new Set(order).size===4?order:navigationManifest.map(entry=>entry.id);
 const ids=pinned?[pinned,...base.filter(id=>id!==pinned)]:base;const entries=ids.map(id=>navigationManifest.find(entry=>entry.id===id)!).filter(Boolean);
 return <div className={styles.shell}>
  <nav className={styles.sidebar+' rail'} aria-label="一级导航"><CareerBrand/><div className={styles.business+' nav-items'}>{entries.map(entry=><Link key={entry.id} to={entry.path} data-module={entry.id} className={styles.link+' rail-item '+(route.view!=='not-found'&&route.module===entry.id?'active':'')} aria-current={route.view!=='not-found'&&route.module===entry.id?'page':undefined}><NavigationIcon name={entry.id}/><span className={styles.label}>{entry.label}</span></Link>)}</div><div className={styles.auxiliary} role="group" aria-label="辅助入口">{auxiliary}</div></nav>
  <main className={styles.content}>
   {contextHelp}
   {navigationManifest.map(entry=><div key={entry.id} hidden={route.view==='not-found'||route.view==='resume'||route.module!==entry.id} data-module={entry.id}>{pages[entry.id]}</div>)}
   <div hidden={route.view!=='resume'} data-module="opportunity-resume">{resume??(route.view==='resume'?<Panel label="简历入口"><p>这个简历入口暂不可用，请返回所属机会。</p></Panel>:null)}</div>
   {route.view==='not-found'&&<Panel label="链接错误"><h1>链接暂不可访问</h1><p>请检查对象链接，或使用侧栏返回业务入口。</p></Panel>}
  </main>
 </div>;
}

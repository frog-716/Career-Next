import type { ReactNode } from 'react';
import { Link,useLocation } from 'react-router';
import { navigationManifest,resolveRoute,type NavigationId } from './routes';
import { Panel } from '../design-system/Panel';
import styles from './shell.module.css';
import '../design-system/tokens.css';
export { navigationManifest,resolveRoute,resumePath } from './routes';
export interface ShellProps{pages:Record<NavigationId,ReactNode>;resume?:ReactNode}
/** Hidden views stay mounted so navigation cannot discard an owner editor session. */
export function CareerShell({pages,resume}:ShellProps){
 const route=resolveRoute(useLocation().pathname);
 return <div className={styles.shell}>
  <nav className={styles.sidebar} aria-label="一级导航">{navigationManifest.map(entry=><Link key={entry.id} to={entry.path} className={styles.link} aria-current={route.view!=='not-found'&&route.module===entry.id?'page':undefined}><span className={styles.icon} aria-hidden="true">{entry.icon}</span><span>{entry.label}</span></Link>)}</nav>
  <main className={styles.content}>
   {navigationManifest.map(entry=><div key={entry.id} hidden={route.view!=='module'||route.module!==entry.id} data-module={entry.id}>{pages[entry.id]}</div>)}
   <div hidden={route.view!=='resume'} data-module="opportunity-resume">{resume??(route.view==='resume'?<Panel label="简历入口"><p>这个简历入口暂不可用，请返回所属机会。</p></Panel>:null)}</div>
   {route.view==='not-found'&&<Panel label="链接错误"><h1>链接暂不可访问</h1><p>请检查对象链接，或使用侧栏返回业务入口。</p></Panel>}
  </main>
 </div>;
}

import {BusinessModuleSchema} from '../../contracts/registry';
import {Identity} from '../../contracts/common/runtime';
import {PurgeNotification} from '../../contracts/application/schema';
/** Browser memory only: no saved keys, capability URLs, localStorage tokens or automatic command replay. */
export async function installBrowserBridge(){
 let capability:string|undefined,bootstrap:Promise<void>|undefined,workspace:string|undefined;
 const listeners=new Set<(notice:PurgeNotification)=>void>();
 async function bindSession(){if(bootstrap)return bootstrap;bootstrap=(async()=>{const response=await fetch('/api/bootstrap',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',redirect:'error'});if(!response.ok)throw Error('disconnected');const value=await response.json();if(typeof value.capability!=='string')throw Error('invalid_capability');capability=value.capability;})();try{await bootstrap;}finally{bootstrap=undefined;}}
 async function call(endpoint:string,input:unknown={}){
  if(!capability)await bindSession();
  let response:Response;try{response=await fetch('/api/'+endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Career-Capability':capability!},body:JSON.stringify(input),redirect:'error'});}catch{window.dispatchEvent(new Event('career-backend-disconnected'));throw Error('disconnected');}
  const result=await response.json();if(!response.ok||!result.ok){if(result.error==='invalid_capability')capability=undefined;throw Error(result.error||'disconnected');}return result.result;
 }
 async function ready(){const value=Identity.parse(await call('ready'));if(workspace&&workspace!==value.workspaceInstance)throw Error('workspace_changed_reload_required');workspace=value.workspaceInstance;return value;}
 async function reconnect(){capability=undefined;await bindSession();const value=Identity.parse(await call('reconnect'));if(workspace&&workspace!==value.workspaceInstance)throw Error('workspace_changed_reload_required');workspace=value.workspaceInstance;window.dispatchEvent(new Event('career-connection-changed'));return value;}
 window.career={ready,reconnect,onPurge(callback){listeners.add(callback);return()=>{listeners.delete(callback);};},request:async(module,input)=>{const result=await call('business/'+BusinessModuleSchema.parse(module),input);if(module==='application'&&(result?.kind==='restored'||result?.kind==='failure'&&result?.code==='restore_failed_reconnected')){workspace=undefined;}return result;}};
 window.careerMaterials={ready,reconnect,request:input=>call('materials',input)};
 window.careerSentFiles={select:()=>call('sent-file')};
 window.careerSecrets={request:input=>call('secrets/deepseek',input)};
 window.careerTavilySecrets={request:input=>call('secrets/tavily',input)};
 window.careerSearch={request:input=>call('search/local',input)};
 window.careerTavilySearch={request:input=>call('search/tavily',input)};
 await bindSession();
 let stopped=false;
 async function notifications(){if(stopped)return;try{if(workspace){const notices=await call('events');for(const notice of notices){const parsed=PurgeNotification.safeParse(notice);if(parsed.success)for(const callback of listeners)callback(parsed.data);else if(notice?.kind==='workspace_changed'||notice?.kind==='reload_required')window.dispatchEvent(new Event('career-workspace-invalidated'));}}}catch{/* A notification poll never retries a command or invokes egress. */}finally{if(!stopped)setTimeout(notifications,1000);}}
 window.addEventListener('pagehide',()=>{stopped=true;if(capability)void fetch('/api/close-tab',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Career-Capability':capability},body:'{}',keepalive:true,redirect:'error'}).catch(()=>{});});
 window.addEventListener('pageshow',event=>{if(event.persisted){stopped=false;capability=undefined;void ready().then(()=>notifications()).catch(()=>window.dispatchEvent(new Event('career-workspace-invalidated')));}});void notifications();
}

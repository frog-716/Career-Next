import {BusinessModuleSchema} from '../../contracts/registry';
import {Identity} from '../../contracts/common/runtime';
import {PurgeNotification} from '../../contracts/application/schema';
import {ProviderConnectionTestResult,type ProviderConnectionTestInput} from '../../contracts/ai/connection-test';
import {FeishuConnectionStatus,FeishuCurrentIdentity} from '../../contracts/platform/feishu-identity';
import {FeishuSearchRequest,FeishuSearchResult,FeishuDocumentMetadata} from '../../contracts/platform/feishu-discovery';
import {BitablePreviewSelectionRequest,BitablePreviewRequest,BitablePreviewSelectionResult,BitablePreviewResult} from '../../contracts/platform/feishu-bitable-preview';
import {BitableTablesRequest,BitableTableRequest,BitableTablesResult,BitableViewsResult,BitableFieldsResult} from '../../contracts/platform/feishu-bitable';
import type {} from '../../contracts/common/file-bridge';
import {chooseBrowserFile} from './browser-files';
/** Browser memory only: no saved keys, capability URLs, localStorage tokens or automatic command replay. */
export async function installBrowserBridge(){
 let capability:string|undefined,bootstrap:Promise<void>|undefined,workspace:string|undefined,browserFiles=false,browserPdf=false,hostControl=false;
 const listeners=new Set<(notice:PurgeNotification)=>void>();
 async function bindSession(){if(bootstrap)return bootstrap;bootstrap=(async()=>{const response=await fetch('/api/bootstrap',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',redirect:'error'});if(!response.ok)throw Error('disconnected');const value=await response.json();if(typeof value.capability!=='string')throw Error('invalid_capability');capability=value.capability;browserFiles=value.browserFiles===true;browserPdf=value.browserPdf===true;hostControl=value.hostControl===true;})();try{await bootstrap;}finally{bootstrap=undefined;}}
 async function call(endpoint:string,input:unknown={}){
  if(!capability)await bindSession();
  let response:Response;try{response=await fetch('/api/'+endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Career-Capability':capability!},body:JSON.stringify(input),redirect:'error'});}catch{window.dispatchEvent(new Event('career-backend-disconnected'));throw Error('disconnected');}
  const result=await response.json();if(!response.ok||!result.ok){if(result.error==='invalid_capability')capability=undefined;throw Error(result.error||'disconnected');}return result.result;
 }
 async function ready(){const value=Identity.parse(await call('ready'));if(workspace&&workspace!==value.workspaceInstance)throw Error('workspace_changed_reload_required');workspace=value.workspaceInstance;return value;}
 async function reconnect(){capability=undefined;await bindSession();const value=Identity.parse(await call('reconnect'));if(workspace&&workspace!==value.workspaceInstance)throw Error('workspace_changed_reload_required');workspace=value.workspaceInstance;window.dispatchEvent(new Event('career-connection-changed'));return value;}
 window.career={developmentDiagnostics:false,ready,reconnect,onPurge(callback){listeners.add(callback);return()=>{listeners.delete(callback);};},request:async(module,input)=>{const result=await call('business/'+BusinessModuleSchema.parse(module),input);if(module==='application'&&(result?.kind==='restored'||result?.kind==='failure'&&result?.code==='restore_failed_reconnected')){workspace=undefined;}return result;}};
 async function upload(endpoint:string,file:File,target?:unknown){if(!capability)await bindSession();const response=await fetch('/api/'+endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-Career-Capability':capability!,'X-Career-Upload-Metadata':encodeURIComponent(JSON.stringify({name:file.name,...target?{target}:{}}))},body:file,redirect:'error'});const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'file_failed');return result.result;}
 window.careerMaterials={ready,reconnect,request:async input=>{if(input.operation!=='select')return call('materials',input);if(!browserFiles)throw Error('file_picker_unavailable');const file=await chooseBrowserFile('.txt,.md',256*1024);return file?upload('files/materials',file,input.target):{kind:'cancelled'};}};
 window.careerSentFiles={select:async()=>{if(!browserFiles)throw Error('file_picker_unavailable');const file=await chooseBrowserFile('.pdf,.txt,.md,.png,.jpg,.jpeg,.webp',16*1024*1024);return file?upload('files/sent',file):undefined;}};
 window.careerSecrets={request:input=>call('secrets/deepseek',input)};
 window.careerTavilySecrets={request:input=>call('secrets/tavily',input)};
 window.careerConnectionTest={request:async input=>ProviderConnectionTestResult.parse(await call('connection/test',input as ProviderConnectionTestInput))};
 window.careerSearch={request:input=>call('search/local',input)};
 window.careerTavilySearch={request:input=>call('search/tavily',input)};
 window.careerFeishu={
  getConnectionStatus:async()=>FeishuConnectionStatus.parse(await call('feishu/status')),
  getCurrentIdentity:async()=>FeishuCurrentIdentity.parse(await call('feishu/identity')),
  connect:async()=>FeishuConnectionStatus.parse(await call('feishu/connect')),
  getAvatar:async()=>{
   if(!capability)await bindSession();
   let response:Response;try{response=await fetch('/api/feishu/avatar',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Career-Capability':capability!},body:'{}',redirect:'error'});}catch{window.dispatchEvent(new Event('career-backend-disconnected'));throw Error('disconnected');}
   if(!response.ok){let code='avatar_unavailable';try{const result=await response.json();if(result.error==='invalid_capability')capability=undefined;else if(result.error==='disconnected')code='disconnected';}catch{}if(code==='disconnected')throw Error(code);return undefined;}
   const blob=await response.blob();if(!blob.type.startsWith('image/'))return undefined;return URL.createObjectURL(blob);
  },
 };
 window.careerFeishuDiscovery={searchDocuments:async input=>FeishuSearchResult.parse(await call('feishu/search',FeishuSearchRequest.parse(input)))};
 window.careerFeishuBitablePreview={
  selectBitablePreview:async input=>BitablePreviewSelectionResult.parse(await call('feishu/bitable/select-preview',BitablePreviewSelectionRequest.parse(input))),
  previewBitableRecords:async input=>BitablePreviewResult.parse(await call('feishu/bitable/preview',BitablePreviewRequest.parse(input))),
 };
 window.careerFeishuBitable={
  getSelectedBitable:async()=>FeishuDocumentMetadata.nullable().parse(await call('feishu/bitable/selected')),
  listBitableTables:async input=>BitableTablesResult.parse(await call('feishu/bitable/tables',BitableTablesRequest.parse(input))),
  listBitableViews:async input=>BitableViewsResult.parse(await call('feishu/bitable/views',BitableTableRequest.parse(input))),
  listBitableFields:async input=>BitableFieldsResult.parse(await call('feishu/bitable/fields',BitableTableRequest.parse(input))),
 };
 await bindSession();
 if(hostControl)window.careerHost={stop:async()=>{await call('host/stop',{confirmed:true});}};
 if(browserPdf)window.careerPdf={async download(resumeId,versionId){if(!capability)await bindSession();const response=await fetch('/api/files/resume-pdf',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Career-Capability':capability!},body:JSON.stringify({resumeId,versionId}),redirect:'error'});if(!response.ok)throw Error('download_failed');const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='Career-Resume.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}};
 let stopped=false;
 async function notifications(){if(stopped)return;try{if(workspace){const notices=await call('events');for(const notice of notices){const parsed=PurgeNotification.safeParse(notice);if(parsed.success)for(const callback of listeners)callback(parsed.data);else if(notice?.kind==='workspace_changed'||notice?.kind==='reload_required')window.dispatchEvent(new Event('career-workspace-invalidated'));}}}catch{/* A notification poll never retries a command or invokes egress. */}finally{if(!stopped)setTimeout(notifications,1000);}}
 window.addEventListener('pagehide',()=>{stopped=true;if(capability)void fetch('/api/close-tab',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Career-Capability':capability},body:'{}',keepalive:true,redirect:'error'}).catch(()=>{});});
 window.addEventListener('pageshow',event=>{if(event.persisted){stopped=false;capability=undefined;void ready().then(()=>notifications()).catch(()=>window.dispatchEvent(new Event('career-workspace-invalidated')));}});void notifications();
}

import { app, BrowserWindow, ipcMain, protocol, utilityProcess, MessageChannelMain, dialog, Menu } from 'electron';
import type { UtilityProcess, MessagePortMain, IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, rename, open } from 'node:fs/promises';
import path from 'node:path';
import { Identity, Request, Result } from '../../../packages/contracts/materials/schema';
import type { Identity as RuntimeIdentity, Request as MaterialRequest, Result as MaterialResult } from '../../../packages/contracts/materials/schema';
import { BusinessModuleSchema,parseBusinessRequest,parseBusinessResult } from '../../../packages/contracts/registry';
import type { BusinessModule } from '../../../packages/contracts/common/bridge';
import {Result as ResumeResult,Request as ResumeRequest} from '../../../packages/contracts/resume/schema';
import {printResume} from '../capabilities/print-resume';
import {activeWorkspace} from '../capabilities/active-workspace';
import {createManagedCopies,durableJson} from '../../../packages/backend/platform/backup/managed-copies';
import {Result as DataResult,PurgeNotification} from '../../../packages/contracts/application/schema';
import {SentFileCandidate} from '../../../packages/contracts/opportunity/submission/file-selection';
import { selectMaterial } from '../capabilities/select-material';
app.setName('Career Next');
// Standard Electron profile switch permits isolated data directories; never enables test capabilities.
if(app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData',path.resolve(app.commandLine.getSwitchValue('user-data-dir')));
const locked=app.requestSingleInstanceLock();
if(!locked) app.quit();
protocol.registerSchemesAsPrivileged([{scheme:'career',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const url='career://app/index.html';
let window: BrowserWindow, backend: UtilityProcess | undefined, port: MessagePortMain | undefined, identity: RuntimeIdentity | undefined;
const appWindows=new Set<BrowserWindow>(),windowWorkspaces=new Map<number,string>();
let connecting: Promise<RuntimeIdentity> | undefined;
let quitting=false, quitReady=false, quitRequested=false;
const pending=new Map<string,{resolve(result: unknown):void; reject(error:Error):void; timer:ReturnType<typeof setTimeout>}>();
function disconnect() {
  port?.close(); port=undefined; identity=undefined;
  for(const item of pending.values()) {clearTimeout(item.timer);item.reject(new Error('disconnected'));} pending.clear();
}
function trusted(event:IpcMainInvokeEvent,handshake=false){const owner=BrowserWindow.fromWebContents(event.sender);if(!owner||!appWindows.has(owner)||event.senderFrame!==owner.webContents.mainFrame||event.senderFrame.url.split('#')[0]!==url||!handshake&&windowWorkspaces.get(owner.id)!==identity?.workspaceInstance)throw Error('invalid_capability');return owner;}
function createAppWindow(){const owner=new BrowserWindow({width:850,height:720,webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,devTools:false}});appWindows.add(owner);window=owner;owner.on('closed',()=>{appWindows.delete(owner);windowWorkspaces.delete(owner.id);if(!appWindows.size)void shutdown();else window=[...appWindows].at(-1)!;});owner.webContents.on('will-prevent-unload',event=>{const choice=dialog.showMessageBoxSync(owner,{type:'question',message:'还有未保存或待核对的输入',detail:'继续编辑可以保留当前输入；关闭或重新载入会丢弃尚未提交的内容。',buttons:['继续编辑','丢弃未保存输入并关闭或重新载入'],defaultId:0,cancelId:0,noLink:true});if(choice===1)event.preventDefault();else quitRequested=false;});owner.webContents.on('did-navigate',()=>{windowWorkspaces.delete(owner.id);});owner.webContents.setWindowOpenHandler(()=>({action:'deny'}));owner.webContents.on('will-navigate',event=>event.preventDefault());owner.webContents.on('will-frame-navigate',event=>event.preventDefault());owner.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));return owner;}
async function connect(): Promise<RuntimeIdentity> {
  if(connecting) return connecting;
  connecting=(async()=>{
    disconnect();
    const dataRoot=app.getPath('userData'),active=await activeWorkspace(dataRoot),root=active.root;
    const copies=createManagedCopies(dataRoot),copy=copies.register({relativePath:path.relative(dataRoot,root),kind:'current_workspace',state:'candidate'});
    await mkdir(root,{recursive:true,mode:0o700});
    if(!backend?.pid) {
      const child=utilityProcess.fork(path.join(__dirname,'utility.cjs'),[root,dataRoot],{serviceName:'Career Materials Backend',stdio:'pipe',allowLoadingUnsignedLibraries:false});
      backend=child;
      child.on('exit',()=>{ if(backend===child){ backend=undefined; disconnect(); } });
    }
    const channel=new MessageChannelMain(); port=channel.port1;
    const activePort=port;
    const ready=new Promise<RuntimeIdentity>((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('disconnected')),15000);
      activePort.on('message',event=>{
        if(port!==activePort) return;
        if(event.data.ready) {try{identity=Identity.parse(event.data.ready);clearTimeout(timeout);resolve(identity);}catch{clearTimeout(timeout);reject(new Error('invalid_request'));}return;}
        const item=pending.get(event.data.requestId);if(!item) return;
        clearTimeout(item.timer);pending.delete(event.data.requestId);
        if(!identity || JSON.stringify(event.data.identity)!==JSON.stringify(identity)){ item.reject(new Error('invalid_capability'));return; }
        try { if(event.data.error){item.reject(new Error(event.data.error));return;} item.resolve(event.data.result); } catch { item.reject(new Error('invalid_request')); }
      });
    });
    activePort.start();backend.postMessage({connect:true},[channel.port2]);
    const current=await ready;
    if(active.expected&&active.expected!==current.workspaceInstance)throw Error('active_pointer_identity_mismatch');
    copies.update(copy.id,{state:'ready'});
    if(active.initial)durableJson(path.join(dataRoot,'active-workspace-pointer.json'),{copyId:copy.id,relativePath:path.relative(dataRoot,root),workspaceInstance:current.workspaceInstance});
    return current;
  })();
  try{return await connecting;}finally{connecting=undefined;}
}
async function send(request: MaterialRequest,owner:BrowserWindow=window): Promise<MaterialResult> {
  const bound=identity;if(!bound||!port||!backend?.pid||quitting) throw new Error('disconnected');
  let selectedFile: string|undefined;
  if(request.operation==='select') selectedFile=await selectMaterial(owner);
  if(identity!==bound||!port) throw new Error('invalid_capability');
  const requestId=randomUUID();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('disconnected'));},15000);
    pending.set(requestId,{resolve: value=>{try{resolve(Result.parse(value));}catch{reject(Error('invalid_request'));}},reject,timer});port!.postMessage({requestId,identity:bound,request,selectedFile});
  });
}
async function sendBusiness(module:BusinessModule,input:unknown):Promise<unknown>{
 const bound=identity;if(!bound||!port||!backend?.pid||quitting)throw Error('disconnected');
 const request=parseBusinessRequest(module,input);
 const requestId=randomUUID();
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('disconnected'));},15000);
  pending.set(requestId,{resolve:value=>{try{resolve(parseBusinessResult(module,value));}catch{reject(Error('invalid_request'));}},reject,timer});
  port!.postMessage({requestId,identity:bound,module,request});
 });
}
const printing=new Map<string,Promise<unknown>>();
async function sendPrint(printAction:'html'|'complete'|'fail',commandId:string,pdf?:Uint8Array):Promise<unknown>{
 const bound=identity;if(!bound||!port||!backend?.pid||quitting)throw Error('disconnected');
 const requestId=randomUUID();
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('disconnected'));},15000);
  pending.set(requestId,{resolve,reject,timer});port!.postMessage({requestId,identity:bound,printAction,commandId,pdf});
 });
}
async function businessWithPrint(module:BusinessModule,input:unknown){
 const result=await sendBusiness(module,input);
 if(module==='application'&&result&&typeof result==='object'&&'kind'in result&&(result.kind==='restored'||result.kind==='failure'&&'code'in result&&result.code==='restore_failed_reconnected')){await connect();}if(module!=='resume')return result;
 const request=ResumeRequest.parse(input),parsed=ResumeResult.parse(result);
 if((request.operation!=='resume.name-version'&&request.operation!=='resume.export')||parsed.status!=='pending-job')return parsed;
 const bound=identity;if(!bound)throw Error('disconnected');
 const key=bound.connectionGeneration+'/'+request.commandId;
 const previous=printing.get(key);if(previous)return previous;
 const job=(async()=>{
  try{
   const payload=await sendPrint('html',request.commandId);
   if(!payload||typeof payload!=='object'||!('html'in payload)||typeof payload.html!=='string')throw Error('invalid_request');
   const bytes=await printResume(payload.html);
   if(identity!==bound)throw Error('invalid_capability');
   return ResumeResult.parse(await sendPrint('complete',request.commandId,bytes));
  }catch{
   if(identity!==bound)throw Error('disconnected');
   return ResumeResult.parse(await sendPrint('fail',request.commandId));
  }
 })();printing.set(key,job);void job.finally(()=>printing.delete(key)).catch(()=>undefined);return job;
}
if(locked) app.whenReady().then(async()=>{
  const root=path.join(__dirname,'../materials-renderer');
  protocol.handle('career',async request=>{
    try{
      const resource=new URL(request.url),filename=path.resolve(root,`.${decodeURIComponent(resource.pathname)}`);
      if(resource.host!=='app'||!filename.startsWith(root+path.sep)) return new Response('Denied',{status:403});
      const type=filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':'text/html';
      return new Response(new Uint8Array(await readFile(filename)),{headers:{'content-type':type,'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'"}});
    }catch{return new Response('Not found',{status:404});}
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{role:'appMenu'},{role:'editMenu'},{label:'视图',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},{label:'文件',submenu:[{label:'新建窗口',accelerator:'CmdOrCtrl+Shift+N',click:()=>{if(identity&&!quitting)void createAppWindow().loadURL(url);}},{role:'close'}]},{role:'windowMenu'}]));
  window=createAppWindow();
  ipcMain.handle('materials:ready',event=>{const owner=trusted(event,true);if(identity&&windowWorkspaces.has(owner.id)&&windowWorkspaces.get(owner.id)!==identity.workspaceInstance)throw Error('workspace_changed_reload_required');if(!identity)throw new Error('disconnected');windowWorkspaces.set(owner.id,identity.workspaceInstance);return identity;});
  ipcMain.handle('materials:reconnect',async event=>{const owner=trusted(event,true);if(identity&&windowWorkspaces.has(owner.id)&&windowWorkspaces.get(owner.id)!==identity.workspaceInstance)throw Error('workspace_changed_reload_required');const previous=windowWorkspaces.get(owner.id),next=await connect();if(previous&&previous!==next.workspaceInstance)throw Error('workspace_changed_reload_required');windowWorkspaces.set(owner.id,next.workspaceInstance);return next;});
  ipcMain.handle('materials:request',(event,input)=>{const owner=trusted(event);if(JSON.stringify(input).length>2048)throw new Error('invalid_request');return send(Request.parse(input),owner);});
  ipcMain.handle('career:sent-file',async event=>{const owner=trusted(event);const bound=identity;if(!bound||!port)throw Error('disconnected');const choice=await dialog.showOpenDialog(owner,{properties:['openFile'],filters:[{name:'实际发送材料',extensions:['pdf','txt','md','png','jpg','jpeg','webp']}]});if(choice.canceled)return undefined;if(identity!==bound||!port)throw Error('invalid_capability');const requestId=randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('disconnected'));},15000);pending.set(requestId,{resolve:value=>resolve(SentFileCandidate.parse(value)),reject,timer});port!.postMessage({requestId,identity:bound,sentFileAction:'select',selectedFile:choice.filePaths[0]});});});
  ipcMain.handle('career:request',async(event,module,input)=>{const owner=trusted(event),workspaceBefore=identity?.workspaceInstance;if(JSON.stringify(input).length>1024*1024)throw Error('invalid_request');const result=await businessWithPrint(BusinessModuleSchema.parse(module),input);
   if(module==='application'){const data=DataResult.parse(result);const refs=data.kind==='purged'?data.references:data.kind==='failure'?data.purgeReferences:undefined;if(refs?.length&&identity?.workspaceInstance===workspaceBefore){const notice=PurgeNotification.parse({workspaceInstance:workspaceBefore,references:refs});for(const target of appWindows)if(windowWorkspaces.get(target.id)===workspaceBefore)target.webContents.send('career:purged',notice);}
    if(data.kind==='restored'||data.kind==='failure'&&data.code==='restore_failed_reconnected'&&identity?.workspaceInstance!==workspaceBefore){if(identity)windowWorkspaces.set(owner.id,identity.workspaceInstance);for(const other of appWindows)if(other!==owner)other.webContents.reload();}
   }return result;});
  await connect();await window.loadURL(url);
}).catch(()=>{ console.error('CAREER_STARTUP_FAILED');app.exit(1); });
app.on('window-all-closed',()=>app.quit());
async function shutdown(){
 if(quitting)return;quitting=true;
 disconnect();for(const item of BrowserWindow.getAllWindows())item.destroy();
 const exited=new Promise<void>(resolve=>{if(!backend?.pid)return resolve();backend.once('exit',()=>resolve());backend.kill();});
 await exited;quitReady=true;app.quit();
}
app.on('before-quit',event=>{
 if(quitReady)return;event.preventDefault();if(quitRequested)return;quitRequested=true;
 if(appWindows.size)for(const owner of [...appWindows])owner.close();else void shutdown();
});

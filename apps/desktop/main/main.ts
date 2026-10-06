import { app, BrowserWindow, ipcMain, protocol, utilityProcess, MessageChannelMain, dialog, Menu, safeStorage } from 'electron';
import type { UtilityProcess, MessagePortMain, IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'node:crypto';
import {execFile} from 'node:child_process';
import {createBrowserHost,type BrowserContext} from '../browser/server';
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
import {createSecretVault} from '../capabilities/secret-vault';
import {createTavilyCredentials} from '../capabilities/tavily-credentials';
import {createSecretCoordinator} from '../capabilities/secret-coordinator';
import {resolveStartupProviderBinding} from '../capabilities/provider-startup';
import {TavilyRequest,TavilyResult} from '../../../packages/contracts/ai/tavily-search';
import {SecretInput,CredentialFailure,credentialAuthorizationSafetyMs} from '../../../packages/contracts/ai/secret-input';
import {ProviderBinding} from '../../../packages/backend/platform/providers/binding';
import type {SecretBridge} from '../../../packages/contracts/ai/secret-input';
import {LocalSearchRequest,LocalSearchResult} from '../../../packages/contracts/application/local-search';
app.setName('Career Next');
// Standard Electron profile switch permits isolated data directories; never enables test capabilities.
if(app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData',path.resolve(app.commandLine.getSwitchValue('user-data-dir')));
const developmentDiagnostics=app.commandLine.hasSwitch('career-development-diagnostics')&&app.commandLine.hasSwitch('user-data-dir');
const desktopUI=app.commandLine.hasSwitch('career-desktop-ui');
let browserHost:Awaited<ReturnType<typeof createBrowserHost>>|undefined;
const browserHandlers:Record<string,(input:unknown,context:BrowserContext)=>Promise<unknown>>={};
const locked=app.requestSingleInstanceLock();
if(!locked) app.quit();
protocol.registerSchemesAsPrivileged([{scheme:'career',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const url='career://app/index.html';
let window: BrowserWindow, backend: UtilityProcess | undefined, port: MessagePortMain | undefined, identity: RuntimeIdentity | undefined;
const appWindows=new Set<BrowserWindow>(),windowWorkspaces=new Map<number,string>();
let secrets!:ReturnType<typeof createSecretVault>;let tavilySecrets!:ReturnType<typeof createSecretVault>;
let connecting: Promise<RuntimeIdentity> | undefined;
let quitting=false, quitReady=false, quitRequested=false;
const pending=new Map<string,{resolve(result: unknown):void; reject(error:Error):void; timer:ReturnType<typeof setTimeout>}>();
function disconnect() {
  void secrets?.request({operation:'cancel'}).catch(()=>{});void tavilySecrets?.request({operation:'cancel'}).catch(()=>{});
  port?.close(); port=undefined; identity=undefined;
  for(const item of pending.values()) {clearTimeout(item.timer);item.reject(new Error('disconnected'));} pending.clear();
}
function trusted(event:IpcMainInvokeEvent,handshake=false){const owner=BrowserWindow.fromWebContents(event.sender);if(!owner||!appWindows.has(owner)||event.senderFrame!==owner.webContents.mainFrame||event.senderFrame.url.split('#')[0]!==url||!handshake&&windowWorkspaces.get(owner.id)!==identity?.workspaceInstance)throw Error('invalid_capability');return owner;}
function createAppWindow(){const owner=new BrowserWindow({width:850,height:720,webPreferences:{additionalArguments:developmentDiagnostics?['--career-ui-development-diagnostics']:[],preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,devTools:false}});appWindows.add(owner);window=owner;owner.on('closed',()=>{appWindows.delete(owner);windowWorkspaces.delete(owner.id);if(!appWindows.size&&desktopUI)void shutdown();else window=[...appWindows].at(-1)!;});owner.webContents.on('will-prevent-unload',event=>{const choice=dialog.showMessageBoxSync(owner,{type:'question',message:'还有未保存或待核对的输入',detail:'继续编辑可以保留当前输入；关闭或重新载入会丢弃尚未提交的内容。',buttons:['继续编辑','丢弃未保存输入并关闭或重新载入'],defaultId:0,cancelId:0,noLink:true});if(choice===1)event.preventDefault();else quitRequested=false;});owner.webContents.on('did-navigate',()=>{windowWorkspaces.delete(owner.id);});owner.webContents.setWindowOpenHandler(()=>({action:'deny'}));owner.webContents.on('will-navigate',event=>event.preventDefault());owner.webContents.on('will-frame-navigate',event=>event.preventDefault());owner.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));return owner;}
async function validateActive(root:string,expected:string){
 const check=utilityProcess.fork(path.join(__dirname,'workspace-check.cjs'),[root,expected],{serviceName:'Career Readonly Workspace Check',stdio:'ignore',allowLoadingUnsignedLibraries:false});
 await new Promise<void>((resolve,reject)=>{let settled=false;const finish=(valid:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);if(check.pid)try{process.kill(check.pid,'SIGKILL');}catch{};valid?resolve():reject(Error('active_pointer_invalid'));};const timer=setTimeout(()=>finish(false),1500);check.on('message',value=>finish(value?.valid===true));check.once('exit',()=>finish(false));});
}
async function connect(): Promise<RuntimeIdentity> {
  if(connecting) return connecting;
  connecting=(async()=>{
    disconnect();
    const dataRoot=app.getPath('userData');let recoveryBackup:string|undefined;let active:Awaited<ReturnType<typeof activeWorkspace>>;
    try{active=await activeWorkspace(dataRoot);if(active.expected)await validateActive(active.root,active.expected);}catch{
      // Stop an existing backend before offering recovery; reconnect must never reuse its old writer.
      if(backend?.pid){const prior=backend;await new Promise<void>(resolve=>{prior.once('exit',()=>resolve());prior.kill();});backend=undefined;}
      // No business connection or egress is admitted until an explicit verified recovery choice.
      const choices=createManagedCopies(dataRoot).list().filter(copy=>copy.kind==='backup'&&copy.state==='ready');
      if(!choices.length)throw Error('recovery_selection_required');
      const selected=await dialog.showMessageBox({type:'warning',message:'资料指针不可用：当前处于恢复只读模式',detail:'尚未打开任何业务资料写连接。请选择一个完整备份，验证通过后才切换；不会按目录时间猜测资料库。',buttons:['保持只读',...choices.map(copy=>'验证并恢复备份 '+copy.createdAt)],defaultId:0,cancelId:0,noLink:true});
      if(selected.response===0||!choices[selected.response-1])throw Error('recovery_selection_required');
      recoveryBackup=choices[selected.response-1]!.id;active={root:path.join(dataRoot,'recovery',randomUUID()),initial:false};
    }
    const root=active.root;
    const copies=createManagedCopies(dataRoot),copy=copies.register({relativePath:path.relative(dataRoot,root),kind:'current_workspace',state:'candidate'});
    await mkdir(root,{recursive:true,mode:0o700});
    if(!backend?.pid) {
      const config=await resolveStartupProviderBinding(path.join(dataRoot,'security'),()=>secrets.request({operation:'status'}));
      const child=utilityProcess.fork(path.join(__dirname,'utility.cjs'),[root,dataRoot,recoveryBackup??'',JSON.stringify(config)],{serviceName:'Career Materials Backend',stdio:'pipe',allowLoadingUnsignedLibraries:false});
      backend=child;
      child.on('exit',()=>{ if(backend===child){ backend=undefined; disconnect(); } });
    }
    const channel=new MessageChannelMain(); port=channel.port1;
    const activePort=port;
    const ready=new Promise<RuntimeIdentity>((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('disconnected')),15000);
      activePort.on('message',event=>{
        if(port!==activePort) return;
        if(event.data.credentialRequest){
          const request=event.data.credentialRequest;
          if(!identity||JSON.stringify(event.data.identity)!==JSON.stringify(identity)||typeof request.credentialId!=='string'||typeof request.generation!=='string')return;
          const bound=identity;
          void (request.service==='tavily'?tavilySecrets:request.service==='deepseek'||request.service===undefined?secrets:undefined)?.readCredential(request.generation).then(value=>{if(port===activePort&&identity===bound&&!quitting)activePort.postMessage({identity:bound,credentialResponse:{credentialId:request.credentialId,value}});},error=>{const failure=CredentialFailure.safeParse(error instanceof Error?error.message:undefined);if(port===activePort&&identity===bound)activePort.postMessage({identity:bound,credentialResponse:{credentialId:request.credentialId,error:failure.success?failure.data:'credential_unavailable'}});});return;
        }
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
    if(!recoveryBackup)createManagedCopies(dataRoot).update(copy.id,{state:'ready'});
    if(active.initial)durableJson(path.join(dataRoot,'active-workspace-pointer.json'),{copyId:copy.id,relativePath:path.relative(dataRoot,root),workspaceInstance:current.workspaceInstance});
    return current;
  })();
  try{return await connecting;}finally{connecting=undefined;}
}
async function send(request: MaterialRequest,owner:BrowserWindow|undefined=window): Promise<MaterialResult> {
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
async function configureProvider(binding:ProviderBinding){const bound=identity;if(!bound||!port||!backend?.pid||quitting)throw Error('disconnected');const requestId=randomUUID();await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('disconnected'));},15000);pending.set(requestId,{resolve:()=>resolve(),reject,timer});port!.postMessage({requestId,identity:bound,providerAction:'configure',binding:ProviderBinding.parse(binding)});});}
async function invalidateTavily(){const bound=identity,activePort=port;if(!bound||!activePort||!backend?.pid||quitting)throw Error('disconnected');const requestId=randomUUID();await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('disconnected'));},15000);pending.set(requestId,{resolve:()=>resolve(),reject,timer});activePort.postMessage({requestId,identity:bound,externalSearchAction:'invalidate'});});}
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
async function openChrome(){
 if(!browserHost||quitting||app.commandLine.hasSwitch('career-no-browser-open'))return;
 await new Promise<void>((resolve,reject)=>execFile('/usr/bin/open',['-a','Google Chrome',browserHost!.url],error=>error?reject(Error('chrome_unavailable')):resolve()));
}
function register(channel:string,handler:(owner:BrowserWindow|undefined,...args:any[])=>unknown){
 if(desktopUI)ipcMain.handle(channel,(event,...args)=>handler(trusted(event,channel==='materials:ready'||channel==='materials:reconnect'),...args));
 const endpoints:Record<string,string>={'materials:ready':'ready','materials:reconnect':'reconnect','materials:request':'materials','career:secret-input':'secrets/deepseek','career:tavily-secret-input':'secrets/tavily','career:tavily-search':'search/tavily','career:local-search':'search/local','career:sent-file':'sent-file'};
 const invoke=async(input:unknown,context:BrowserContext,module?:BusinessModule)=>{
  const before=identity?.workspaceInstance;
  const result=module?await handler(undefined,module,input):await handler(undefined,input);
  if(channel==='materials:ready'||channel==='materials:reconnect'){if(!identity)throw Error('disconnected');context.bind(identity.workspaceInstance);}
  if(module==='application'){
   const parsed=DataResult.parse(result),refs=parsed.kind==='purged'?parsed.references:parsed.kind==='failure'?parsed.purgeReferences:undefined;
   if(before&&refs?.length)context.notify(PurgeNotification.parse({workspaceInstance:before,references:refs}),before);
   if(before&&identity&&before!==identity.workspaceInstance){context.notify({kind:'workspace_changed'},before,true);context.replaceBinding(identity.workspaceInstance);}
  }
  return result;
 };
 if(channel==='career:request')for(const module of BusinessModuleSchema.options)browserHandlers['business/'+module]=(input,context)=>invoke(input,context,module);
 else{const endpoint=endpoints[channel];if(!endpoint)throw Error('invalid_capability');browserHandlers[endpoint]=(input,context)=>invoke(input,context);}
}
if(locked) app.whenReady().then(async()=>{
  const root=path.join(__dirname,'../materials-renderer');
  protocol.handle('career',async request=>{
    try{
      const resource=new URL(request.url);if(resource.pathname==='/recovery.html')return new Response('<!doctype html><meta charset="utf-8"><title>Career 恢复只读模式</title><h1>资料尚未打开</h1><p>当前资料指针不可用，业务写入和外发均已关闭。</p><p>重新启动后可明确选择完整备份；验证通过才会切换。原资料和备份仍保留。</p>',{headers:{'content-type':'text/html','Content-Security-Policy':"default-src 'none'; script-src 'none'; connect-src 'none'"}});const filename=path.resolve(root,`.${decodeURIComponent(resource.pathname)}`);
      if(resource.host!=='app'||!filename.startsWith(root+path.sep)) return new Response('Denied',{status:403});
      const type=filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':'text/html';
      return new Response(new Uint8Array(await readFile(filename)),{headers:{'content-type':type,'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'"}});
    }catch{return new Response('Not found',{status:404});}
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([{role:'appMenu'},{role:'editMenu'},{label:'视图',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},{label:'文件',submenu:[{label:desktopUI?'新建窗口':'在 Chrome 打开',accelerator:'CmdOrCtrl+Shift+N',click:()=>{if(identity&&!quitting){if(desktopUI)void createAppWindow().loadURL(url);else void openChrome();}}},{role:'close'}]},{role:'windowMenu'}]));
  if(desktopUI)window=createAppWindow();
  secrets=createSecretVault(path.join(app.getPath('userData'),'security'),{available:()=>safeStorage.isAsyncEncryptionAvailable(),encrypt:input=>safeStorage.encryptStringAsync(input),decrypt:async input=>(await safeStorage.decryptStringAsync(input)).result});
  const secretCoordinator=createSecretCoordinator(secrets,configureProvider);
  register('career:secret-input',async(_owner,input:unknown)=>{const parsed=SecretInput.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};return secretCoordinator.request(parsed.data);});
  // Separate device vault: configuring Search must never replace or rebind the model credential.
  // This entry point only stores a Key; it has no network or backend dispatch capability.
  tavilySecrets=createSecretVault(path.join(app.getPath('userData'),'security-tavily'),{available:()=>safeStorage.isAsyncEncryptionAvailable(),encrypt:input=>safeStorage.encryptStringAsync(input),decrypt:async input=>(await safeStorage.decryptStringAsync(input)).result},undefined,'tavily');
  const tavilyCredentials=createTavilyCredentials(tavilySecrets,invalidateTavily);
  register('career:tavily-secret-input',async(_owner,input:unknown)=>{const parsed=SecretInput.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};return tavilyCredentials.request(parsed.data);});
  register('career:tavily-search',async(_owner,input:unknown)=>{const request=TavilyRequest.parse(input),bound=identity,activePort=port;if(!bound||!activePort||!backend?.pid||quitting)throw Error('disconnected');const generation=request.operation==='receipt'?undefined:await tavilyCredentials.generationForDispatch().catch(()=>undefined);if(identity!==bound||port!==activePort)throw Error('disconnected');if(request.operation==='run'&&!generation)return TavilyResult.parse({kind:'failure',code:'credential_unavailable'});const requestId=randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('credential_timeout'));},request.operation==='receipt'||request.operation==='preview'?15000:credentialAuthorizationSafetyMs+125000);pending.set(requestId,{resolve:value=>{try{resolve(TavilyResult.parse(value));}catch{reject(Error('invalid_request'));}},reject,timer});activePort.postMessage({requestId,identity:bound,externalSearchAction:'tavily',request,credentialGeneration:generation});});});
  register('career:local-search',async(event,input:unknown)=>{
   const bound=identity;if(!bound||!port||!backend?.pid||quitting)throw Error('disconnected');const request=LocalSearchRequest.parse(input),requestId=randomUUID();
   return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('disconnected'));},15000);pending.set(requestId,{resolve:value=>{try{resolve(LocalSearchResult.parse(value));}catch{reject(Error('invalid_request'));}},reject,timer});port!.postMessage({requestId,identity:bound,searchAction:'query',request});});
  });
  register('materials:ready',owner=>{if(identity&&owner&&windowWorkspaces.has(owner.id)&&windowWorkspaces.get(owner.id)!==identity.workspaceInstance)throw Error('workspace_changed_reload_required');if(!identity)throw new Error('disconnected');if(owner)windowWorkspaces.set(owner.id,identity.workspaceInstance);return identity;});
  register('materials:reconnect',async owner=>{if(identity&&owner&&windowWorkspaces.has(owner.id)&&windowWorkspaces.get(owner.id)!==identity.workspaceInstance)throw Error('workspace_changed_reload_required');const previous=owner?windowWorkspaces.get(owner.id):undefined,next=desktopUI?await connect():identity??await connect();if(previous&&previous!==next.workspaceInstance)throw Error('workspace_changed_reload_required');if(owner)windowWorkspaces.set(owner.id,next.workspaceInstance);return next;});
  register('materials:request',(owner,input)=>{if(JSON.stringify(input).length>2048)throw new Error('invalid_request');return send(Request.parse(input),owner);});
  register('career:sent-file',async owner=>{const bound=identity;if(!bound||!port)throw Error('disconnected');const choice=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'实际发送材料',extensions:['pdf','txt','md','png','jpg','jpeg','webp']}]});if(choice.canceled)return undefined;if(identity!==bound||!port)throw Error('invalid_capability');const requestId=randomUUID();return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('disconnected'));},15000);pending.set(requestId,{resolve:value=>resolve(SentFileCandidate.parse(value)),reject,timer});port!.postMessage({requestId,identity:bound,sentFileAction:'select',selectedFile:choice.filePaths[0]});});});
  register('career:request',async(owner,module,input)=>{const workspaceBefore=identity?.workspaceInstance;if(JSON.stringify(input).length>1024*1024)throw Error('invalid_request');const result=await businessWithPrint(BusinessModuleSchema.parse(module),input);
   if(module==='application'){const data=DataResult.parse(result);const refs=data.kind==='purged'?data.references:data.kind==='failure'?data.purgeReferences:undefined;if(refs?.length&&identity?.workspaceInstance===workspaceBefore){const notice=PurgeNotification.parse({workspaceInstance:workspaceBefore,references:refs});for(const target of appWindows)if(windowWorkspaces.get(target.id)===workspaceBefore)target.webContents.send('career:purged',notice);}
    if(data.kind==='restored'||data.kind==='failure'&&data.code==='restore_failed_reconnected'&&identity?.workspaceInstance!==workspaceBefore){if(identity&&owner)windowWorkspaces.set(owner.id,identity.workspaceInstance);for(const other of appWindows)if(other!==owner)other.webContents.reload();}
   }return result;});
  await connect();
  if(desktopUI)await window.loadURL(url);else {
   const file=path.join(app.getPath('userData'),'browser-host.json');let preferred=47631;try{const saved=JSON.parse(await readFile(file,'utf8'));if(Number.isInteger(saved.port)&&saved.port>1024&&saved.port<65536)preferred=saved.port;}catch{}
   try{browserHost=await createBrowserHost({root,port:preferred,identity:()=>identity,handlers:browserHandlers});}catch(error){if((error as NodeJS.ErrnoException).code!=='EADDRINUSE')throw error;browserHost=await createBrowserHost({root,port:0,identity:()=>identity,handlers:browserHandlers});}
   durableJson(file,{port:Number(new URL(browserHost.url).port),pid:process.pid,instance:browserHost.instance});
   await openChrome();
  }
}).catch(async()=>{ disconnect();backend?.kill();backend=undefined;console.error('CAREER_STARTUP_FAILED');if(window&&!window.isDestroyed())await window.loadURL('career://app/recovery.html');else app.exit(1); });
app.on('window-all-closed',()=>{if(desktopUI)app.quit();});
app.on('second-instance',()=>{if(desktopUI){window?.show();window?.focus();}else void openChrome();});
app.on('activate',()=>{if(!desktopUI)void openChrome();});
process.on('SIGTERM',()=>void shutdown());
process.on('SIGINT',()=>void shutdown());
async function shutdown(){
 if(quitting)return;quitting=true;
 disconnect();await browserHost?.close();for(const item of BrowserWindow.getAllWindows())item.destroy();
 const exited=new Promise<void>(resolve=>{if(!backend?.pid)return resolve();backend.once('exit',()=>resolve());backend.kill();});
 await exited;quitReady=true;app.quit();
}
app.on('before-quit',event=>{
 if(quitReady)return;event.preventDefault();if(quitRequested)return;quitRequested=true;
 if(appWindows.size)for(const owner of [...appWindows])owner.close();else void shutdown();
});

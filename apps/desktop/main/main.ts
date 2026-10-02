import { app, BrowserWindow, ipcMain, protocol, utilityProcess, MessageChannelMain, dialog } from 'electron';
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
import { selectMaterial } from '../capabilities/select-material';
app.setName('Career Next');
// Standard Electron profile switch permits isolated data directories; never enables test capabilities.
if(app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData',path.resolve(app.commandLine.getSwitchValue('user-data-dir')));
const locked=app.requestSingleInstanceLock();
if(!locked) app.quit();
protocol.registerSchemesAsPrivileged([{scheme:'career',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const url='career://app/index.html';
let window: BrowserWindow, backend: UtilityProcess | undefined, port: MessagePortMain | undefined, identity: RuntimeIdentity | undefined;
let connecting: Promise<RuntimeIdentity> | undefined;
let quitting=false, quitReady=false, quitRequested=false;
const pending=new Map<string,{resolve(result: unknown):void; reject(error:Error):void; timer:ReturnType<typeof setTimeout>}>();
function disconnect() {
  port?.close(); port=undefined; identity=undefined;
  for(const item of pending.values()) {clearTimeout(item.timer);item.reject(new Error('disconnected'));} pending.clear();
}
function trusted(event: IpcMainInvokeEvent) {
  if(event.sender!==window.webContents || event.senderFrame!==window.webContents.mainFrame || event.senderFrame.url.split('#')[0]!==url) throw new Error('invalid_capability');
}
async function connect(): Promise<RuntimeIdentity> {
  if(connecting) return connecting;
  connecting=(async()=>{
    disconnect();
    const root=path.join(app.getPath('userData'),'workspaces','local');
    await mkdir(root,{recursive:true,mode:0o700});
    if(!backend?.pid) {
      const child=utilityProcess.fork(path.join(__dirname,'utility.cjs'),[root],{serviceName:'Career Materials Backend',stdio:'pipe',allowLoadingUnsignedLibraries:false});
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
    // One verified local workspace pointer, written only after backend lock/migration/recovery/ready.
    const pointer=path.join(app.getPath('userData'),'active-workspace-pointer.json');
    const temp=pointer+'.pending'; const handle=await open(temp,'w',0o600);
    try{await handle.writeFile(JSON.stringify({copy:'local',workspaceInstance:current.workspaceInstance}));await handle.sync();}finally{await handle.close();}
    await rename(temp,pointer);const dir=await open(app.getPath('userData'),'r');try{await dir.sync();}finally{await dir.close();}
    return current;
  })();
  try{return await connecting;}finally{connecting=undefined;}
}
async function send(request: MaterialRequest): Promise<MaterialResult> {
  const bound=identity;if(!bound||!port||!backend?.pid||quitting) throw new Error('disconnected');
  let selectedFile: string|undefined;
  if(request.operation==='select') selectedFile=await selectMaterial(window);
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
 if(module!=='resume')return result;
 const request=ResumeRequest.parse(input),parsed=ResumeResult.parse(result);
 if(request.operation!=='resume.name-version'||parsed.status!=='pending-job')return parsed;
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
  window=new BrowserWindow({width:850,height:720,webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,devTools:false}});
  window.on('closed',()=>{void shutdown();});
  window.webContents.on('will-prevent-unload',event=>{const choice=dialog.showMessageBoxSync(window,{type:'question',message:'还有未保存或待核对的输入',detail:'继续编辑可以保留当前输入；退出会丢弃尚未提交的内容。',buttons:['继续编辑','丢弃未保存输入并退出'],defaultId:0,cancelId:0,noLink:true});if(choice===1)event.preventDefault();else quitRequested=false;});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',event=>event.preventDefault());window.webContents.on('will-frame-navigate',event=>event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  ipcMain.handle('materials:ready',event=>{trusted(event);if(!identity)throw new Error('disconnected');return identity;});
  ipcMain.handle('materials:reconnect',event=>{trusted(event);return connect();});
  ipcMain.handle('materials:request',(event,input)=>{trusted(event);if(JSON.stringify(input).length>2048)throw new Error('invalid_request');return send(Request.parse(input));});
  ipcMain.handle('career:request',(event,module,input)=>{trusted(event);if(JSON.stringify(input).length>1024*1024)throw Error('invalid_request');return businessWithPrint(BusinessModuleSchema.parse(module),input);});
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
 if(window&&!window.isDestroyed())window.close();else void shutdown();
});

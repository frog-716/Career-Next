import { contextBridge, ipcRenderer } from 'electron';
import type { MaterialsBridge } from '../../../packages/contracts/materials/schema';
const bridge: MaterialsBridge = {
  ready: () => ipcRenderer.invoke('materials:ready'),
  request: input => ipcRenderer.invoke('materials:request',input),
  reconnect: () => ipcRenderer.invoke('materials:reconnect'),
};
contextBridge.exposeInMainWorld('careerMaterials',bridge);

import type { CareerBridge } from '../../../packages/contracts/common/bridge';
const career:CareerBridge={developmentDiagnostics:process.argv.includes('--career-ui-development-diagnostics'),onPurge(callback){const receive=(_event:unknown,notice:import('../../../packages/contracts/application/schema').PurgeNotification)=>callback(notice);ipcRenderer.on('career:purged',receive);return ()=>{ipcRenderer.removeListener('career:purged',receive);};},ready:bridge.ready,reconnect:bridge.reconnect,request:(module,input)=>ipcRenderer.invoke('career:request',module,input)};
contextBridge.exposeInMainWorld('career',career);

contextBridge.exposeInMainWorld('careerSentFiles',{select:()=>ipcRenderer.invoke('career:sent-file')});

contextBridge.exposeInMainWorld('careerSecrets',{request:(input:import('zod').infer<typeof import('../../../packages/contracts/ai/secret-input').SecretInput>)=>ipcRenderer.invoke('career:secret-input',input)});
contextBridge.exposeInMainWorld('careerTavilySecrets',{request:(input:import('zod').infer<typeof import('../../../packages/contracts/ai/secret-input').SecretInput>)=>ipcRenderer.invoke('career:tavily-secret-input',input)});
contextBridge.exposeInMainWorld('careerSearch',{request:(input:import('../../../packages/contracts/application/local-search').LocalSearchRequest)=>ipcRenderer.invoke('career:local-search',input)});

contextBridge.exposeInMainWorld('careerTavilySearch',{request:(input:import('../../../packages/contracts/ai/tavily-search').TavilyRequest)=>ipcRenderer.invoke('career:tavily-search',input)});

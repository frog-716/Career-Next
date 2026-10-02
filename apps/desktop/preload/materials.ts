import { contextBridge, ipcRenderer } from 'electron';
import type { MaterialsBridge } from '../../../packages/contracts/materials/schema';
const bridge: MaterialsBridge = {
  ready: () => ipcRenderer.invoke('materials:ready'),
  request: input => ipcRenderer.invoke('materials:request',input),
  reconnect: () => ipcRenderer.invoke('materials:reconnect'),
};
contextBridge.exposeInMainWorld('careerMaterials',bridge);

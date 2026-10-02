import { contextBridge, ipcRenderer } from 'electron';
import type { ProbeBridge } from '../../../packages/contracts/probe/g0';

// No raw ipcRenderer, arbitrary channels, filesystem or secret read capability.
const bridge: ProbeBridge = {
  request: input => ipcRenderer.invoke('g0:request', input),
  reconnect: () => ipcRenderer.invoke('g0:reconnect'),
  saveSecret: input => ipcRenderer.invoke('g0:secret-write', input),
  secretStatus: () => ipcRenderer.invoke('g0:secret-status'),
  print: () => ipcRenderer.invoke('g0:print'),
};
contextBridge.exposeInMainWorld('careerG0', bridge);

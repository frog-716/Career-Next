// Entire entrypoint is a G0 feasibility probe, not Career's production main.
import { app, BrowserWindow, ipcMain, MessageChannelMain, protocol, session, utilityProcess } from 'electron';
import type { IpcMainInvokeEvent, MessagePortMain, UtilityProcess } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProbeRequest, ProbeResponse } from '../../../packages/contracts/probe/g0';
import type { ProbeRequest as Request, ProbeResponse as ProbeResult } from '../../../packages/contracts/probe/g0';
import { secretAdapter } from './secret';
import { printSnapshot } from './print';

const directory = mkdtempSync(path.join(tmpdir(), 'career-next-g0-'));
app.setName('Career Next G0');
app.setPath('userData', directory);
protocol.registerSchemesAsPrivileged([{ scheme: 'career-g0', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const rendererURL = 'career-g0://app/index.html';
let window: BrowserWindow;
let backend: UtilityProcess | undefined;
let port: MessagePortMain | undefined;
const pending = new Map<string, { resolve(result: ProbeResult): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();

function rejectPending() {
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('G0_BACKEND_DISCONNECTED')); }
  pending.clear();
}
function request(input: Request): Promise<ProbeResult> {
  if (!port || !backend?.pid) return Promise.reject(new Error('G0_BACKEND_DISCONNECTED'));
  const id = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('G0_TIMEOUT')); }, 10_000);
    pending.set(id, { resolve, reject, timer });
    port!.postMessage({ id, input: ProbeRequest.parse(input) });
  });
}
async function connect() {
  if (backend?.pid) throw new Error('G0_BACKEND_STILL_RUNNING');
  port?.close();
  rejectPending();
  const child = utilityProcess.fork(path.join(__dirname, 'utility.cjs'), [path.join(directory, 'probe.sqlite')], {
    serviceName: 'Career G0 Backend', stdio: 'pipe', allowLoadingUnsignedLibraries: false,
  });
  backend = child;
  child.on('exit', () => { if (backend === child) { port?.close(); port = undefined; backend = undefined; rejectPending(); } });
  const channel = new MessageChannelMain();
  port = channel.port1;
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('G0_BACKEND_READY_TIMEOUT')), 10_000);
    channel.port1.on('message', event => {
      if (event.data.ready) { clearTimeout(timer); resolve(); return; }
      const entry = pending.get(event.data.id);
      if (!entry) return;
      clearTimeout(entry.timer); pending.delete(event.data.id);
      if (event.data.error) entry.reject(new Error('G0_REQUEST_FAILED'));
      else { try { entry.resolve(ProbeResponse.parse(event.data.result)); } catch { entry.reject(new Error('G0_INVALID_RESPONSE')); } }
    });
  });
  channel.port1.start();
  child.postMessage({ connect: true }, [channel.port2]);
  await ready;
}
function trusted(event: IpcMainInvokeEvent) {
  if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== rendererURL)
    throw new Error('G0_UNTRUSTED_SENDER');
}

app.whenReady().then(async () => {
  const root = path.join(__dirname, '../renderer');
  protocol.handle('career-g0', req => {
    const url = new URL(req.url);
    const filename = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (url.host !== 'app' || !filename.startsWith(root + path.sep)) return new Response('Denied', { status: 403 });
    try {
      const mime = filename.endsWith('.js') ? 'text/javascript' : filename.endsWith('.css') ? 'text/css' : 'text/html';
      return new Response(new Uint8Array(readFileSync(filename)), { headers: {
        'content-type': mime, 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'",
      } });
    } catch { return new Response('Not found', { status: 404 }); }
  });
  window = new BrowserWindow({ width: 650, height: 600, webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true,
    nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, devTools: false,
  } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-frame-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  const secrets = secretAdapter(directory);
  ipcMain.handle('g0:request', (event, input) => { trusted(event); return request(ProbeRequest.parse(input)); });
  ipcMain.handle('g0:reconnect', async event => { trusted(event); await connect(); return { connected: true }; });
  ipcMain.handle('g0:secret-write', async (event, input: unknown) => { trusted(event); return secrets.save(input); });
  ipcMain.handle('g0:secret-status', event => { trusted(event); return secrets.status(); });
  ipcMain.handle('g0:print', async event => {
    trusted(event);
    const result = await request({ kind: 'snapshot' });
    return printSnapshot(directory, result.snapshot!);
  });
  await connect();
  await window.loadURL(rendererURL);
}).catch(() => { console.error('G0_STARTUP_FAILED'); app.exit(1); });

app.on('window-all-closed', () => app.quit());
let shuttingDown = false;
let readyToQuit = false;
app.on('before-quit', event => {
  if (readyToQuit) return;
  event.preventDefault();
  if (shuttingDown) return;
  shuttingDown = true;
  port?.close(); rejectPending();
  const exited = new Promise<void>(resolve => {
    if (!backend?.pid) return resolve();
    backend.once('exit', () => resolve());
    backend.kill();
  });
  for (const item of BrowserWindow.getAllWindows()) item.destroy();
  void Promise.all([exited, session.defaultSession.clearStorageData(), session.defaultSession.closeAllConnections()])
    .finally(() => { readyToQuit = true; app.quit(); });
});
app.on('will-quit', () => rmSync(directory, { recursive: true, force: true }));

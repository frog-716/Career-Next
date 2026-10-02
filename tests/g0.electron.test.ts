// External test driver only. Never bundled into the packaged G0 app.
import { it, expect } from 'vitest';
import { _electron } from 'playwright';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

it('runs the real isolated G0 process/native/PDF/Secret/security chain', async () => {
  const packaged = process.env.CAREER_G0_PACKAGED === '1';
  const executablePath = packaged ? path.resolve('out/CareerNextG0-darwin-arm64/CareerNextG0.app/Contents/MacOS/CareerNextG0') : undefined;
  const application = await _electron.launch({ executablePath, args: packaged ? [] : ['.'], timeout: 30_000 });
  let directory = '';
  try {
    const page = await application.firstWindow();
    await page.locator('h1').waitFor();
    directory = await application.evaluate(({ app }) => app.getPath('userData'));
    const runtime = await application.evaluate(() => ({ arch: process.arch, electron: process.versions.electron, node: process.versions.node }));
    expect(runtime.arch).toBe('arm64'); expect(runtime.electron).toBe('44.5.1');
    const isolation = await page.evaluate(() => ({
      node: typeof (globalThis as unknown as { require?: unknown }).require,
      process: typeof (globalThis as unknown as { process?: unknown }).process,
      keys: Object.keys(window.careerG0).sort(),
    }));
    expect(isolation.node).toBe('undefined'); expect(isolation.process).toBe('undefined');
    expect(isolation.keys).toEqual(['print', 'reconnect', 'request', 'saveSecret', 'secretStatus']);
    const sandbox = await application.evaluate(({ app, BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0]!.webContents;
      return { sandboxed: app.getAppMetrics().find(p => p.pid === contents.getOSProcessId())?.sandboxed,
        devtoolsOpen: contents.isDevToolsOpened() };
    });
    expect(sandbox.sandboxed).toBe(true); expect(sandbox.devtoolsOpen).toBe(false);
    await application.evaluate(async ({ BrowserWindow }) => {
      await BrowserWindow.getAllWindows()[0]!.webContents.executeJavaScriptInIsolatedWorld(999,
        [{ code: 'window.careerG0 = undefined' }]);
    });
    expect(await page.evaluate(() => typeof window.careerG0)).toBe('object');
    await page.locator('#probe-text').fill('中文输入与焦点');
    await page.locator('#probe-text').focus();
    expect(await page.locator('#probe-text').evaluate(element => element === document.activeElement)).toBe(true);
    await page.getByText('发送 typed request', { exact: true }).click();
    await expect.poll(() => page.locator('#probe-result').textContent()).toContain('中文输入与焦点');
    const echo = await page.evaluate(() => window.careerG0.request({ kind: 'echo', text: 'typed request' }));
    expect(echo.echo).toBe('typed request');
    const db = await page.evaluate(() => window.careerG0.request({ kind: 'transaction' }));
    expect(db.count).toBe(1); expect(db.sqlite).toBe('3.53.4');
    const concurrent = await page.evaluate(() => Promise.all([
      window.careerG0.request({ kind: 'transaction' }), window.careerG0.request({ kind: 'transaction' }),
    ]));
    expect(concurrent.map(result => result.count)).toEqual([2, 3]);
    // A premature reconnect must preserve the still-live connection.
    await page.evaluate(async () => { try { await window.careerG0.reconnect(); } catch { /* expected */ } });
    expect((await page.evaluate(() => window.careerG0.request({ kind: 'status' }))).count).toBe(3);
    const invalid = await page.evaluate(async () => {
      try { await window.careerG0.request({ kind: 'echo', text: 'x', extra: 'forbidden' } as never); return false; }
      catch { return true; }
    });
    expect(invalid).toBe(true);
    const stop = await page.evaluate(async () => {
      await window.careerG0.request({ kind: 'slow-start' });
      const start = performance.now();
      const result = await window.careerG0.request({ kind: 'stop' });
      return { ...result, elapsedMs: performance.now() - start };
    });
    expect(stop.workerRunning).toBe(true); expect(stop.stopped).toBe(true); expect(stop.elapsedMs).toBeLessThan(2_500);
    const metrics = await application.evaluate(({ app }) => app.getAppMetrics().map(p => ({ type: p.type, name: p.name, pid: p.pid, memory: p.memory })));
    const backend = metrics.find(p => p.name === 'Career G0 Backend');
    expect(backend).toBeTruthy();
    process.kill(backend!.pid, 'SIGKILL');
    await expect.poll(async () => page.evaluate(async () => {
      try { await window.careerG0.request({ kind: 'status' }); return false; } catch { return true; }
    })).toBe(true);
    await page.evaluate(() => window.careerG0.reconnect());
    const restarted = await page.evaluate(() => window.careerG0.request({ kind: 'status' }));
    expect(restarted.generation).not.toBe(db.generation); expect(restarted.count).toBe(3);
    const resourceProbe = await application.evaluateHandle(async ({ app, BrowserWindow }) => {
      const rss = () => app.getAppMetrics().reduce((sum, p) => sum + p.memory.workingSetSize, 0);
      const idleKB = rss();
      const second = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
      await second.loadURL('career-g0://app/index.html');
      const twoWindowsKB = rss();
      second.destroy();
      const samples = [rss()];
      const timer = setInterval(() => samples.push(rss()), 20);
      const printerChecks: Promise<{ capability: string; node: string }>[] = [];
      const listener = (_event: Electron.Event, printer: Electron.BrowserWindow) => {
        printerChecks.push(new Promise(resolve => printer.webContents.once('did-finish-load', async () => {
          resolve(await printer.webContents.executeJavaScript('({capability: typeof window.careerG0, node: typeof window.require})'));
        })));
      };
      app.on('browser-window-created', listener);
      return { idleKB, twoWindowsKB, samples, timer, printerChecks, listener };
    });
    const beforeWindows = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    const pdf = await page.evaluate(() => window.careerG0.print());
    const resources = await application.evaluate(async ({ app }, probe) => {
      clearInterval(probe.timer);
      app.off('browser-window-created', probe.listener);
      return { idleKB: probe.idleKB, twoWindowsKB: probe.twoWindowsKB, pdfPeakSampleKB: Math.max(...probe.samples),
        printBoundary: await Promise.all(probe.printerChecks) };
    }, resourceProbe);
    await resourceProbe.dispose();
    expect(resources.printBoundary).toEqual([{ capability: 'undefined', node: 'undefined' }]);
    const bytes = readFileSync(path.join(directory, pdf.filename));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(pdf.hash);
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
    const pdfDocument = await loading.promise;
    const content = await (await pdfDocument.getPage(1)).getTextContent();
    // macOS CJK PDF glyph maps include compatibility radicals; preserve selectable text and compare canonical meaning.
    const text = content.items.map(item => 'str' in item ? item.str : '').join('').normalize('NFKC');
    expect(text).toContain('中文文字可选择'); expect(text).toContain(pdf.snapshotId);
    await loading.destroy();
    expect(pdf.released).toBe(true);
    expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(beforeWindows);
    const secret = await page.evaluate(async () => {
      const input = 'fictional-g0-' + Array.from(crypto.getRandomValues(new Uint8Array(24))).map(v => v.toString(16).padStart(2, '0')).join('');
      const saved = await window.careerG0.saveSecret(input);
      const status = await window.careerG0.secretStatus();
      return { configured: saved.configured && status.configured, statusKeys: Object.keys(status), leaked: JSON.stringify(status).includes(input) };
    });
    expect(secret.configured).toBe(true); expect(secret.statusKeys).toEqual(['configured']); expect(secret.leaked).toBe(false);
    expect(readFileSync(path.join(directory, 'g0-secret.encrypted')).includes(Buffer.from('fictional-g0-'))).toBe(false);
    const popupCount = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    await page.evaluate(() => window.open('https://example.com'));
    expect(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(popupCount);
    await page.evaluate(() => { location.href = 'https://example.com'; });
    await page.waitForTimeout(100);
    expect(page.url()).toBe('career-g0://app/index.html');
    const untrusted = await application.evaluate(async ({ app, BrowserWindow }) => {
      const foreign = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
      try {
        await foreign.loadURL('data:text/html,external-content');
        const external = await foreign.webContents.executeJavaScript('typeof window.careerG0');
        await foreign.loadFile(app.getAppPath() + '/dist/renderer/index.html');
        const file = await foreign.webContents.executeJavaScript('typeof window.careerG0');
        return { external, file };
      } finally { foreign.destroy(); }
    });
    expect(untrusted).toEqual({ external: 'undefined', file: 'undefined' });
    const senderRejected = await application.evaluate(async ({ app, BrowserWindow }) => {
      const foreign = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true,
        nodeIntegration: false, preload: app.getAppPath() + '/dist/desktop/preload.cjs' } });
      try {
        await foreign.loadURL('data:text/html,untrusted-sender');
        return await foreign.webContents.executeJavaScript('(async () => { try { await window.careerG0.request({kind:"status"}); return false; } catch { return true; } })()');
      } finally { foreign.destroy(); }
    });
    expect(senderRejected).toBe(true);
    const evidence = { runtime, mode: packaged ? 'packaged' : 'dev', sqlite: db.sqlite, stopMs: Math.round(stop.elapsedMs),
      pdfSelectableChinese: true, snapshotBound: true, secretStatusOnly: true, reconnectNoReplay: true, resources, processMemory: metrics.map(({ pid: _pid, ...p }) => p) };
    writeFileSync(path.join(tmpdir(), `career-next-g0-${packaged ? 'packaged' : 'dev'}.json`), JSON.stringify(evidence, null, 2) + '\n');
  } finally { await application.close(); }
  // Chromium subprocesses can flush storage after Main has exited.
  await new Promise(resolve => setTimeout(resolve, 500));
  expect(existsSync(directory)).toBe(false);
}, 120_000);

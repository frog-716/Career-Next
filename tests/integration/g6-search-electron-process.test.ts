import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

it('actual Electron utility execPath can launch the fixed readonly helper in RunAsNode mode', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'career-g6-search-electron-'));
  await mkdir(path.resolve('dist/g6-search-tests'), { recursive: true });
  const executable = process.env.CAREER_SEARCH_PROBE_ELECTRON ?? path.resolve('node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
  await writeFile(path.join(root, 'main.cjs'), `const {app,utilityProcess}=require('electron');
app.setPath('userData',${JSON.stringify(path.join(root, 'userData'))});
app.whenReady().then(()=>{const child=utilityProcess.fork(${JSON.stringify(path.join(root, 'utility.cjs'))},[],{stdio:'pipe'});
child.on('message',value=>{require('node:fs').writeFileSync(${JSON.stringify(path.join(root, 'result.json'))},JSON.stringify(value));child.kill();app.quit();});
child.on('exit',code=>{if(code!==0)app.exit(code||1);});});`);
  await writeFile(path.join(root, 'utility.cjs'), `const child=require('node:child_process').fork(${JSON.stringify(path.join(root, 'readonly.cjs'))},[],{execArgv:[],env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},stdio:['ignore','ignore','ignore','ipc']});
child.once('message',value=>process.parentPort.postMessage({utilityExecPath:process.execPath,helper:value}));`);
  await writeFile(path.join(root, 'readonly.cjs'), `process.send({alive:true,execPath:process.execPath,electron:process.versions.electron},()=>process.exit(0));`);
  const environment = { ...process.env }; delete environment.ELECTRON_RUN_AS_NODE;
  const app = spawn(executable, [path.join(root, 'main.cjs')], { env: environment, stdio: 'ignore' });
  const exit = await new Promise<number | null>((resolve, reject) => {
    const timer = setTimeout(() => { app.kill('SIGKILL'); reject(Error('isolated Electron probe timed out')); }, 10000);
    app.once('exit', code => { clearTimeout(timer); resolve(code); });
    app.once('error', error => { clearTimeout(timer); reject(error); });
  });
  expect(exit).toBe(0);
  const result = JSON.parse(await readFile(path.join(root, 'result.json'), 'utf8'));
  expect(result.helper.alive).toBe(true); expect(result.helper.electron).toBe('44.5.1');
  expect(result.helper.execPath).toBe(result.utilityExecPath);
  await writeFile(path.resolve('dist/g6-search-tests/electron-process-evidence.json'), JSON.stringify({ root, result }, null, 2));
}, 15000);

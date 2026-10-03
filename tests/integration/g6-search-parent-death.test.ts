import { beforeAll, expect, it } from 'vitest';
import { build } from 'vite';
import Database from 'better-sqlite3';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import path from 'node:path';

const output = path.resolve('dist/g6-search-parent-death');
const delay = () => new Promise(resolve => setTimeout(resolve, 10));
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  for (const [entry, file] of [['tests/g6-search-parent-driver.ts', 'parent.mjs'], ['tests/g6-search-long-worker.ts', 'long.mjs']]) await build({ configFile: false, logLevel: 'error', build: { outDir: output, emptyOutDir: false, target: 'node24', lib: { entry, formats: ['es'], fileName: () => file }, rolldownOptions: { external: [/^node:/, 'better-sqlite3'] } } });
});
it('actual parent SIGKILL cannot leave a readonly helper orphaned in native SQL', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'career-g6-search-parent-death-'));
  const filename = path.join(root, 'career.sqlite');
  const db = new Database(filename); db.exec('CREATE TABLE isolated(id INTEGER)'); db.close();
  const parent = spawn(process.execPath, [path.join(output, 'parent.mjs'), root, path.join(output, 'long.mjs')], { stdio: 'ignore' });
  const exited = new Promise<{ code: number | null; signal: string | null }>(resolve => parent.once('exit', (code, signal) => resolve({ code, signal })));
  let childPid = 0;
  try {
    for (let n = 0; n < 300; n++) {
      childPid = Number(await readFile(filename + '.query-pid', 'utf8').catch(() => '0'));
      if (childPid) break;
      await delay();
    }
    expect(childPid).toBeGreaterThan(1);
    expect(await readFile(filename + '.query-started', 'utf8')).toBe('actual readonly native SQL began');
    expect(alive(childPid)).toBe(true);
    const started = performance.now(); parent.kill('SIGKILL');
    const parentExit = await exited;
    while (alive(childPid) && performance.now() - started < 500) await delay();
    const helperAliveAfterDeadline = alive(childPid), elapsedMs = performance.now() - started;
    await writeFile(path.join(output, 'evidence.json'), JSON.stringify({ root, parentPid: parent.pid, childPid, parentExit, elapsedMs, helperAliveAfterDeadline, startedActualNativeSQL: true }, null, 2));
    expect(parentExit).toEqual({ code: null, signal: 'SIGKILL' });
    expect(helperAliveAfterDeadline).toBe(false);
  } finally {
    if (parent.exitCode === null && parent.signalCode === null) parent.kill('SIGKILL');
    if (childPid && alive(childPid)) process.kill(childPid, 'SIGKILL');
    await exited;
  }
}, 10000);
it('an alive host with no timeout cannot leave native SQL running past the independent child deadline', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'career-g6-search-self-deadline-'));
  const filename = path.join(root, 'career.sqlite');
  const db = new Database(filename); db.exec('CREATE TABLE isolated(id INTEGER)'); db.close();
  const parent = spawn(process.execPath, [path.join(output, 'parent.mjs'), root, path.join(output, 'long.mjs'), 'watchdog-only'], { stdio: 'ignore' });
  const exited = new Promise<void>(resolve => parent.once('exit', () => resolve()));
  let childPid = 0;
  try {
    const started = performance.now(); let helperExit: unknown;
    for (let n = 0; n < 300; n++) {
      childPid = Number(await readFile(filename + '.query-pid', 'utf8').catch(() => '0')) || childPid;
      const value = await readFile(filename + '.helper-exit', 'utf8').catch(() => '');
      if (value) { helperExit = JSON.parse(value); break; }
      await delay();
    }
    expect(childPid).toBeGreaterThan(1);
    expect(await readFile(filename + '.query-started', 'utf8')).toBe('actual readonly native SQL began');
    expect(helperExit).toEqual({ code: null, signal: 'SIGKILL' });
    expect(alive(parent.pid!)).toBe(true); expect(alive(childPid)).toBe(false);
    const elapsedMs = performance.now() - started;
    expect(elapsedMs).toBeLessThan(1500);
    await writeFile(path.join(output, 'deadline-evidence.json'), JSON.stringify({ root, parentPid: parent.pid, childPid, helperExit, elapsedMs, hostAlive: true, hostTimer: false, childDeadlineMs: 300 }, null, 2));
  } finally {
    if (parent.exitCode === null && parent.signalCode === null) parent.kill('SIGKILL');
    if (childPid && alive(childPid)) process.kill(childPid, 'SIGKILL');
    await exited;
  }
}, 10000);

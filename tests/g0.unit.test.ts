import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProbeRequest, ProbeResponse } from '../packages/contracts/probe/g0';
import { probeTransaction } from '../packages/backend/probe/sqlite';

describe('G0 contract and independent backend', () => {
  it('rejects arbitrary operations, paths, secrets and oversized payloads', () => {
    for (const input of [{ kind: 'execute', sql: 'DROP TABLE x' }, { kind: 'echo', text: 'x', secret: 'value' },
      { kind: 'echo', text: 'x'.repeat(81) }, { kind: 'transaction', path: '/tmp/other' }])
      expect(ProbeRequest.safeParse(input).success).toBe(false);
    expect(ProbeResponse.safeParse({ generation: 'g0', secret: 'value' }).success).toBe(false);
  });
  it('commits and reads with real better-sqlite3 and Kysely without Electron/renderer', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'career-g0-unit-'));
    try {
      const filename = path.join(directory, 'probe.sqlite');
      expect((await probeTransaction(filename, true)).count).toBe(1);
      expect((await probeTransaction(filename, false)).count).toBe(1);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it('keeps the built renderer/preload isolated and testing tooling out of package', () => {
    const preload = readFileSync('apps/desktop/probe/preload.ts', 'utf8');
    expect(preload).not.toMatch(/exposeInMainWorld\([^,]+,\s*ipcRenderer\)/);
    expect(preload).not.toContain('node:fs');
    const main = readFileSync('apps/desktop/probe/main.ts', 'utf8');
    expect(main).not.toMatch(/remote-debugging-port|--inspect|ELECTRON_TEST|allowLoadingUnsignedLibraries:\s*true/);
    expect(main).not.toMatch(/from ['"]better-sqlite3/);
  });
});

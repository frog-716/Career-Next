import { it, expect } from 'vitest';
import { build } from 'vite';
import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createMaterialsBackend } from '../../packages/backend/domains/materials/public';
import { createRuntimeBackend } from '../../packages/backend/bootstrap/runtime';

// Career-Next's released G1 checkpoint, not the historical Career repository.
// Build its actual writer and dependencies, rather than simulating G1 with G2 code.
const releasedG1 = '3d7d6fee9e2f116dd8e6399b7714b16bb91a564c';
async function buildReleasedWriter(directory: string) {
  const files = [
    'packages/backend/bootstrap/writer.ts',
    'packages/backend/platform/database/database.ts',
    'packages/backend/platform/database/ledger.ts',
    'packages/backend/domains/materials/migration.ts',
    'packages/backend/domains/materials/store.ts',
    'packages/contracts/materials/schema.ts',
  ];
  for (const filename of files) {
    const destination = path.join(directory, filename);
    await mkdir(path.dirname(destination), { recursive: true });
    const source = execFileSync('git', ['show', `${releasedG1}:${filename}`], { cwd: process.cwd() });
    await writeFile(destination, source);
  }
  const artifact = path.join(directory, 'built/g1-writer.cjs');
  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      outDir: path.dirname(artifact), target: 'node24',
      lib: { entry: path.join(directory, files[0]), formats: ['cjs'], fileName: () => path.basename(artifact) },
      rolldownOptions: { external: [/^node:/, 'better-sqlite3'] },
    },
  });
  return artifact;
}

function inspectClosedWorkspace<T>(directory: string, inspect: (db: Database.Database) => T): T {
  const db = new Database(path.join(directory, 'career.sqlite'), { readonly: true });
  try { return inspect(db); } finally { db.close(); }
}
type ManagedCopy = {
  id: string; relativePath: string; purpose: string; state: string;
  fromVersion: number; toVersion: number; recordedAt: string;
};
async function registeredCopies(directory: string): Promise<ManagedCopy[]> {
  return (JSON.parse(await readFile(path.join(directory, 'managed-copies.json'), 'utf8')) as { copies: ManagedCopy[] }).copies;
}

it('upgrades a genuine released G1 Raw/receipt workspace, retains its registered recovery copy and survives another G2 restart', async () => {
  // Keep build artifacts beneath the repo so the external native module resolves
  // from its installed node_modules; both fixture and workspace are disposable.
  await mkdir(path.resolve('dist/test-support'), { recursive: true });
  const buildRoot = await mkdtemp(path.resolve('dist/test-support/g1-released-'));
  const fixture = await mkdtemp(path.join(tmpdir(), 'career-g1-g2-upgrade-'));
  const directory = path.join(fixture, 'workspace');
  const bytes = Buffer.from('这是 G1 已确认的不可变原件。\nOriginal bytes, not verified facts.\n', 'utf8');
  const filename = path.join(fixture, '原件.txt');
  let g1: Awaited<ReturnType<typeof createMaterialsBackend>> | undefined;
  let g2: Awaited<ReturnType<typeof createRuntimeBackend>> | undefined;
  try {
    const releasedWriter = await buildReleasedWriter(buildRoot);
    await writeFile(filename, bytes);
    g1 = await createMaterialsBackend(directory, undefined, releasedWriter);
    const originalSession = await g1.connectHuman();
    const preview = await g1.selectFile(originalSession, filename);
    const input = { commandId: randomUUID(), importId: preview.importId, expectedRevision: 1 as const, digest: preview.digest };
    const receipt = await g1.confirm(originalSession, input);
    expect(receipt.status).toBe('committed');
    if (receipt.status !== 'committed') throw Error('G1 fixture failed to commit');
    const raw = await g1.read(originalSession, receipt.materialId);
    expect(await g1.resolveSource(originalSession, raw.source)).toEqual(raw);
    expect(await g1.receipt(originalSession, input.commandId)).toEqual(receipt);
    await g1.close(); g1 = undefined;

    // Read-only inspection is restricted to a stopped writer and the platform
    // upgrade/retention seams. All Raw creation and reads use its public API.
    const blobId = inspectClosedWorkspace(directory, db => {
      expect(db.pragma('user_version', { simple: true })).toBe(1);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name='platform_migration_batches'").get()).toBeUndefined();
      expect(db.prepare('SELECT status FROM platform_receipts WHERE command_id=?').get(input.commandId)).toEqual({ status: 'committed' });
      const retained = db.prepare('SELECT blob_id FROM platform_retention WHERE owner=? AND object_id=?').get('materials', raw.id) as { blob_id: string };
      return retained.blob_id;
    });
    expect(await readFile(path.join(directory, 'blobs', blobId))).toEqual(bytes);

    const latestWriter = path.resolve('dist/application/writer.cjs');
    g2 = await createRuntimeBackend(directory, latestWriter);
    const currentSession = await g2.connectHuman();
    expect(currentSession.workspaceInstance).toBe(originalSession.workspaceInstance);
    expect(currentSession.backendGeneration).not.toBe(originalSession.backendGeneration);
    expect(await g2.materials.list(currentSession)).toHaveLength(1);
    expect(await g2.materials.read(currentSession, raw.id)).toEqual(raw);
    expect(await g2.materials.resolveSource(currentSession, raw.source)).toEqual(raw);
    expect(await g2.materials.receipt(currentSession, input.commandId)).toEqual(receipt);
    expect(await g2.materials.confirm(currentSession, input)).toEqual(receipt);
    expect(await g2.materials.collectGarbage()).toBe(0);
    expect(await readFile(path.join(directory, 'blobs', blobId))).toEqual(bytes);
    await g2.close(); g2 = undefined;

    inspectClosedWorkspace(directory, db => {
      expect(db.pragma('user_version', { simple: true })).toBe(2);
      expect(db.prepare('SELECT version,name FROM platform_migration_batches ORDER BY version').all()).toEqual([
        { version: 1, name: '001-g1' }, { version: 2, name: '002-g2-first-batch' },
      ]);
      expect(db.prepare('SELECT id,batch_version FROM platform_migration_fragments ORDER BY rowid').all()).toEqual([
        'platform.commands.v1', 'platform.artifacts.v2', 'employment.initial.v1', 'project.initial.v1',
        'opportunity.initial.v1', 'profile.initial.v1', 'resume.initial.v1', 'wiki.initial.v1',
      ].map(id => ({ id, batch_version: 2 })));
      expect(db.prepare('SELECT blob_id FROM platform_artifact_retention WHERE owner=? AND object_id=?').get('materials', raw.id)).toEqual({ blob_id: blobId });
      expect(db.prepare('SELECT status,object_id FROM platform_artifact_receipts WHERE command_id=?').get(input.commandId)).toEqual({ status: 'committed', object_id: raw.id });
      expect(db.pragma('foreign_key_check')).toEqual([]);
    });
    const copies = await registeredCopies(directory);
    expect(copies).toHaveLength(1);
    expect(copies[0]).toMatchObject({ purpose: 'schema-upgrade', state: 'ready', fromVersion: 1, toVersion: 2 });
    expect(copies[0].relativePath).toMatch(/^recovery\/upgrade-1-[0-9a-f-]+$/);
    const recovery = path.join(directory, copies[0].relativePath);
    expect(JSON.parse(await readFile(path.join(recovery, 'upgrade.json'), 'utf8'))).toEqual({ fromVersion: 1, toVersion: 2 });
    expect(await readFile(path.join(recovery, 'blobs', blobId))).toEqual(bytes);
    inspectClosedWorkspace(recovery, db => {
      expect(db.pragma('user_version', { simple: true })).toBe(1);
      expect(db.prepare('SELECT instance FROM platform_workspace').get()).toEqual({ instance: originalSession.workspaceInstance });
      expect(db.prepare('SELECT status FROM platform_receipts WHERE command_id=?').get(input.commandId)).toEqual({ status: 'committed' });
    });

    g2 = await createRuntimeBackend(directory, latestWriter);
    const restarted = await g2.connectHuman();
    expect(restarted.workspaceInstance).toBe(originalSession.workspaceInstance);
    expect(restarted.backendGeneration).not.toBe(currentSession.backendGeneration);
    expect(await g2.materials.read(restarted, raw.id)).toEqual(raw);
    expect(await g2.materials.resolveSource(restarted, receipt.source)).toEqual(raw);
    expect(await g2.materials.receipt(restarted, input.commandId)).toEqual(receipt);
    expect(await g2.materials.collectGarbage()).toBe(0);
    expect(await readFile(path.join(directory, 'blobs', blobId))).toEqual(bytes);
    expect(await registeredCopies(directory)).toEqual(copies);
    expect(await readFile(path.join(recovery, 'blobs', blobId))).toEqual(bytes);
  } finally {
    await g1?.close(); await g2?.close();
    await rm(fixture, { recursive: true, force: true });
    await rm(buildRoot, { recursive: true, force: true });
  }
}, 60_000);

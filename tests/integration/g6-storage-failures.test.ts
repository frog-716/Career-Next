import { beforeAll, expect, it } from 'vitest';
import { fork, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, writeFile, open } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { build } from 'vite';
import { createMaterialsBackend } from '../../packages/backend/domains/materials/public';
import { createBlobBroker } from '../../packages/backend/platform/files/blobs';
import type { ProductionSinkAdapter } from '../../packages/backend/platform/files/staging';
import { startWriter } from '../../packages/backend/platform/database/client';
import type { Store, HumanSession } from '../../packages/backend/domains/materials/store';
import { createLedger } from '../../packages/backend/platform/database/ledger';
import { openWorkspace } from '../../packages/backend/platform/database/database';
import { materialsMigration } from '../../packages/backend/domains/materials/migration';
import { releases } from '../../packages/backend/bootstrap/releases';
import { commandMigration, commandReceipt, executeCommand } from '../../packages/backend/platform/commands/receipts';
import { createWriterCommands } from '../../packages/backend/bootstrap/writer-commands';
import { Result as OpportunityResult } from '../../packages/contracts/opportunity/schema';
import { Result as ResumeResult } from '../../packages/contracts/resume/schema';

const output = path.resolve('dist/g6-storage');
const normalWriter = path.resolve('dist/application/writer.cjs');
const evidence: object[] = [];
beforeAll(async () => {
  await mkdir(output, { recursive: true });
  for (const entry of ['driver', 'writer']) await build({ configFile: false, logLevel: 'error', build: {
    outDir: output, emptyOutDir: false, target: 'node24',
    lib: { entry: `tests/fixtures/g6-storage-${entry}.ts`, formats: ['es'], fileName: () => `${entry}.mjs` },
    rolldownOptions: { external: [/^node:/, 'better-sqlite3'] },
  } });
}, 30000);
async function record(value: object) {
  evidence.push(value);
  await writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2));
}
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'career-g6-storage-'));
  const directory = path.join(root, 'workspace'), filename = path.join(root, 'evidence.txt');
  await mkdir(directory);
  await writeFile(filename, 'G6 隔离原文，not real user data.');
  return { root, directory, filename };
}
async function untilCheckpoint(child: ChildProcess, directory: string) {
  let stderr = ''; child.stderr?.on('data', bytes => { stderr += String(bytes); });
  for (let attempt = 0; attempt < 500; attempt++) {
    if (child.exitCode !== null || child.signalCode !== null) throw Error(`driver exited: ${stderr}`);
    try { return JSON.parse(await readFile(path.join(directory, 'g6-checkpoint.json'), 'utf8')) as { point: string }; }
    catch { await new Promise(resolve => setTimeout(resolve, 10)); }
  }
  throw Error(`checkpoint timeout: ${stderr}`);
}

const cuts = [
  ['F1-01', 'staging-before', false], ['F1-02', 'staging-after', false],
  ['F1-03', 'hold-after', false], ['F1-04', 'publish-before', false],
  ['F1-05', 'publish-after', false], ['F1-06', 'commit-before', false],
  ['F1-07', 'commit-after', true], ['F1-08', 'handoff-before', false],
  ['F1-09', 'handoff-after', false], ['F1-11', 'receipt-after', true],
] as const;
it.each(cuts)('%s: SIGKILL at %s recovers the original receipt without replay', async (id, cut, committed) => {
  const f = await fixture();
  const child = fork(path.join(output, 'driver.mjs'), [f.directory, f.filename, cut, path.join(output, 'writer.mjs')], {
    execPath: path.resolve('node_modules/node/bin/node'), stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  let backend: Awaited<ReturnType<typeof createMaterialsBackend>> | undefined;
  try {
    const point = await untilCheckpoint(child, f.directory);
    expect(point.point).toBe(cut);
    const old = JSON.parse(await readFile(path.join(f.directory, 'g6-session.json'), 'utf8')) as HumanSession;
    const intent = await readFile(path.join(f.directory, 'g6-intent.json'), 'utf8').then(JSON.parse).catch(() => undefined);
    const beforeBlobs = await readdir(path.join(f.directory, 'blobs'));
    const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    child.kill('SIGKILL'); const termination = await exit;
    expect(termination.signal).toBe('SIGKILL');
    backend = await createMaterialsBackend(f.directory, undefined, normalWriter);
    const session = await backend.connectHuman();
    expect(session.workspaceInstance).toBe(old.workspaceInstance);
    expect(session.backendGeneration).not.toBe(old.backendGeneration);
    expect(session.connectionGeneration).not.toBe(old.connectionGeneration);
    await expect(backend.list(old)).rejects.toThrow('invalid_capability');
    const list = await backend.list(session);
    expect(list).toHaveLength(committed ? 1 : 0);
    let receipt: unknown;
    if (intent) {
      receipt = await backend.receipt(session, intent.commandId);
      expect(receipt).toMatchObject({ status: committed ? 'committed' : 'failed' });
      if (committed) {
        const raw = await backend.read(session, list[0]!.id);
        expect(raw.text).toBe('G6 隔离原文，not real user data.');
        expect(await backend.confirm(session, intent)).toEqual(receipt);
        expect(await backend.list(session)).toHaveLength(1);
      }
    }
    expect(await backend.stagingCount()).toBe(0);
    expect(await readdir(path.join(f.directory, 'blobs'))).toHaveLength(committed ? 1 : 0);
    expect(await backend.collectGarbage()).toBe(0);
    await record({ id, cut, root: f.root, termination, beforeBlobs, receipt, afterCount: list.length, status: 'PASS' });
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exit = new Promise<void>(resolve => child.once('exit', () => resolve()));
      child.kill('SIGKILL'); await exit;
    }
    await backend?.close();
    // Evidence is isolated fixture content and retained for review, not app userData.
  }
}, 15000);

it('F1-12 / F1-13: committed response loss converges through receipt after backend restart, never a new command', async () => {
  const f = await fixture();
  const real = await startWriter<Store>(f.directory, randomUUID(), normalWriter);
  let dropped = false;
  const writer = { ...real, async call(method: keyof Store, ...args: unknown[]) {
    const result = await (real.call as (...args: unknown[]) => Promise<unknown>)(method, ...args);
    if (method === 'commit' && !dropped) { dropped = true; throw Error('disconnected'); }
    return result;
  } } as typeof real;
  let backend = await createMaterialsBackend(f.directory, undefined, undefined, writer);
  try {
    const session = await backend.connectHuman(), preview = await backend.selectFile(session, f.filename);
    const input = { commandId: randomUUID(), importId: preview.importId, digest: preview.digest, expectedRevision: 1 as const };
    const result = await backend.confirm(session, input);
    expect(dropped).toBe(true); expect(result.status).toBe('committed');
    await backend.close(); backend = await createMaterialsBackend(f.directory, undefined, normalWriter);
    const current = await backend.connectHuman();
    expect(await backend.receipt(current, input.commandId)).toEqual(result);
    expect(await backend.confirm(current, input)).toEqual(result);
    expect(await backend.list(current)).toHaveLength(1);
    await expect(backend.confirm(current, { ...input, digest: '0'.repeat(64) })).rejects.toThrow('conflict');
    await record({ id: 'F1-12', root: f.root, result, repeatedSameCommand: true, status: 'PASS' });
  } finally { await backend.close(); }
});

it('F1-10: held blobs resist concurrent GC; an old delete claim cannot retain or delete a new incarnation', async () => {
  const f = await fixture();
  const workspace = await openWorkspace(f.directory, materialsMigration, releases);
  const db = workspace.database, ledger = createLedger(db), broker = createBlobBroker(f.directory, 1024);
  await broker.initialize(); const bytes = Buffer.from('same immutable bytes');
  const digest = createHash('sha256').update(bytes).digest('hex'), oldId = randomUUID(), newId = randomUUID();
  try {
    db.transaction(() => ledger.hold(randomUUID(), 'old', oldId, digest, bytes.length, 'producer'))();
    expect(db.transaction(() => ledger.claim())()).toEqual([]);
    const oldCommand = (ledger.describeOperation('materials.confirm', 'old'))[0]!.commandId;
    await broker.publishBytes(oldId, bytes, digest, async () => undefined);
    db.transaction(() => ledger.published(oldId, oldCommand))();
    expect(db.transaction(() => ledger.claim())()).toEqual([]);
    db.transaction(() => ledger.fail(oldCommand, 'storage_failed'))();
    const claim = db.transaction(() => ledger.claim())(); expect(claim).toEqual([oldId]);
    expect(() => db.transaction(() => ledger.hold(randomUUID(), 'reused', oldId, digest, bytes.length, 'new'))()).toThrow();
    expect(() => db.transaction(() => ledger.retainExisting(oldId, randomUUID(), 'actual-artifact'))()).toThrow('invalid_capability');
    const newCommand = randomUUID();
    db.transaction(() => ledger.hold(newCommand, 'new', newId, digest, bytes.length, 'new'))();
    await broker.publishBytes(newId, bytes, digest, async () => undefined);
    db.transaction(() => ledger.published(newId, newCommand))();
    await Promise.all(claim.map(id => broker.remove(id))); db.transaction(() => ledger.deleted(oldId))();
    expect(await broker.readBytes(newId, digest)).toEqual(bytes);
    expect(db.transaction(() => ledger.claim())()).toEqual([]);
    db.transaction(() => ledger.retain(newId, randomUUID(), newCommand))();
    expect(db.transaction(() => ledger.claim())()).toEqual([]);
    await record({ id: 'F1-10', root: f.root, oldId, newId, claim, status: 'PASS' });
  } finally { workspace.close(); }
});
it('F1-03 / F1-10: concurrent public GC requests cannot claim a live published hold or its later committed retention', async () => {
  const f = await fixture(); let reached!: () => void, release!: () => void;
  const published = new Promise<void>(resolve => { reached = resolve; });
  const pause = new Promise<void>(resolve => { release = resolve; });
  const backend = await createMaterialsBackend(f.directory, (root, maximum) => {
    const broker = createBlobBroker(root, maximum);
    return { ...broker, async publish(...args) { await broker.publish(...args); reached(); await pause; } };
  }, normalWriter);
  try {
    const session = await backend.connectHuman(), preview = await backend.selectFile(session, f.filename);
    const input = { commandId: randomUUID(), importId: preview.importId, expectedRevision: 1 as const, digest: preview.digest };
    const saving = backend.confirm(session, input); await published;
    expect(await Promise.all([backend.collectGarbage(), backend.collectGarbage()])).toEqual([0, 0]);
    expect(await backend.confirm(session, input)).toEqual({ status: 'pending', commandId: input.commandId });
    expect(await readdir(path.join(f.directory, 'blobs'))).toHaveLength(1);
    release(); const result = await saving; expect(result.status).toBe('committed');
    expect(await Promise.all([backend.collectGarbage(), backend.collectGarbage()])).toEqual([0, 0]);
    if (result.status !== 'committed') throw Error('save failed');
    expect((await backend.read(session, result.materialId)).text).toBe('G6 隔离原文，not real user data.');
    await record({ id: 'F1-10-public-concurrent', root: f.root, gcRequests: 4, commandId: input.commandId, status: 'PASS' });
  } finally { release(); await backend.close(); }
});

function quotaSink(quota: number): ProductionSinkAdapter {
  let consumed = 0;
  return { withLease: work => work(), async controlledSink(filename) {
    const handle = await open(filename, 'wx', 0o600);
    return { async append(bytes) {
      if (consumed + bytes.length > quota) throw Object.assign(Error('Controlled filesystem quota exhausted'), { code: 'ENOSPC' });
      consumed += bytes.length; await handle.writeFile(bytes);
    }, async close() { await handle.sync(); await handle.close(); } };
  } };
}
it('F1-01 / F1-02: partial staging ENOSPC closes the descriptor and cleans the candidate without formal Raw', async () => {
  const f = await fixture(); await writeFile(f.filename, '大'.repeat(18000));
  const backend = await createMaterialsBackend(f.directory, undefined, normalWriter, undefined, async () => quotaSink(16384));
  try {
    const session = await backend.connectHuman();
    await expect(backend.selectFile(session, f.filename)).rejects.toThrow('file_failed');
    expect(await backend.list(session)).toEqual([]);
    expect(await backend.stagingCount()).toBe(0);
    expect(await readdir(path.join(f.directory, 'blobs'))).toEqual([]);
    await record({ id: 'F1-02-partial-staging', root: f.root, quotaBytes: 16384, status: 'PASS' });
  } finally { await backend.close(); }
});
it('F1-02: a staged-byte hash mismatch cannot produce a formal Raw or success receipt', async () => {
  const f = await fixture(); const backend = await createMaterialsBackend(f.directory, undefined, normalWriter);
  try {
    const session = await backend.connectHuman(), preview = await backend.selectFile(session, f.filename);
    await writeFile(path.join(f.directory, 'staging', preview.importId), 'corrupted isolated staging bytes');
    const input = { commandId: randomUUID(), importId: preview.importId, expectedRevision: 1 as const, digest: preview.digest };
    expect(await backend.confirm(session, input)).toEqual({ status: 'failed', commandId: input.commandId, code: 'storage_failed' });
    expect(await backend.list(session)).toEqual([]);
    expect(await readdir(path.join(f.directory, 'blobs'))).toEqual([]);
    await record({ id: 'F1-02-hash-mismatch', root: f.root, commandId: input.commandId, status: 'PASS' });
  } finally { await backend.close(); }
});
it('F1-16: quota ENOSPC during real blob writing creates failed receipt and no formal material', async () => {
  const f = await fixture(); let selections = 0;
  const backend = await createMaterialsBackend(f.directory, undefined, normalWriter, undefined, async () => quotaSink(++selections === 1 ? 1024 : 0));
  try {
    const session = await backend.connectHuman(), preview = await backend.selectFile(session, f.filename);
    const input = { commandId: randomUUID(), importId: preview.importId, expectedRevision: 1 as const, digest: preview.digest };
    expect(await backend.confirm(session, input)).toEqual({ status: 'failed', commandId: input.commandId, code: 'storage_failed' });
    expect(await backend.list(session)).toEqual([]);
    expect(await readdir(path.join(f.directory, 'blobs'))).toEqual([]);
    expect((await backend.receipt(session, input.commandId)).status).toBe('failed');
    await record({ id: 'F1-16', root: f.root, quotaBytes: 0, status: 'PASS' });
  } finally { await backend.close(); }
});
it('F1-15: real SQLite page quota returns SQLITE_FULL and rolls owner mutation and receipt back', async () => {
  const f = await fixture(), db = new Database(path.join(f.root, 'quota.sqlite'));
  try {
    db.pragma('journal_mode = WAL'); db.pragma('synchronous = FULL');
    db.exec(`${commandMigration} CREATE TABLE fixture_owner (id TEXT PRIMARY KEY, body TEXT NOT NULL);`);
    const before = db.pragma('page_count', { simple: true }); db.pragma(`max_page_count = ${before}`);
    const id = randomUUID(); let code: string | undefined;
    try { executeCommand(db, 'fixture_owner', id, { action: 'save' }, () => {
      db.prepare('INSERT INTO fixture_owner VALUES (?,?)').run(id, '大'.repeat(100000)); return { status: 'saved' };
    }); } catch (error) { code = (error as { code?: string }).code; }
    expect(code).toBe('SQLITE_FULL');
    expect(commandReceipt(db, 'fixture_owner', id)).toBeUndefined();
    expect(db.prepare('SELECT count(*) AS n FROM fixture_owner').get()).toEqual({ n: 0 });
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    await record({ id: 'F1-15', root: f.root, pageQuota: before, errorCode: code, integrity: 'ok', status: 'PASS' });
  } finally { db.close(); }
});
it('F1-15: actual Materials confirm receives SQLITE_FULL inside its commit and retains a failed original receipt', async () => {
  const f = await fixture();
  const child = fork(path.join(output, 'driver.mjs'), [f.directory, f.filename, 'sqlite-full', path.join(output, 'writer.mjs')], {
    execPath: path.resolve('node_modules/node/bin/node'), stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  let stderr = ''; child.stderr?.on('data', bytes => { stderr += String(bytes); });
  const exit = await new Promise<number | null>(resolve => child.once('exit', code => resolve(code)));
  expect(exit, stderr).toBe(0);
  const error = JSON.parse(await readFile(path.join(f.directory, 'g6-adapter-error.json'), 'utf8'));
  expect(error.code).toBe('SQLITE_FULL');
  const response = JSON.parse(await readFile(path.join(f.directory, 'g6-response.json'), 'utf8'));
  expect(response.status).toBe('failed'); expect(response.code).toBe('db_failed');
  const backend = await createMaterialsBackend(f.directory, undefined, normalWriter);
  try {
    const session = await backend.connectHuman();
    expect(await backend.list(session)).toEqual([]);
    expect(await backend.receipt(session, response.commandId)).toEqual(response);
    expect(await readdir(path.join(f.directory, 'blobs'))).toEqual([]);
    const db = new Database(path.join(f.directory, 'career.sqlite'), { readonly: true });
    try { expect(db.pragma('integrity_check', { simple: true })).toBe('ok'); }
    finally { db.close(); }
    await record({ id: 'F1-15-owner', root: f.root, errorCode: error.code, response, status: 'PASS' });
  } finally { await backend.close(); }
}, 10000);
it('F1-17: PDF candidate quota failure leaves no published artifact or partially staged PDF', async () => {
  const f = await fixture(); const broker = createBlobBroker(f.root, 65536, quotaSink(16384)); await broker.initialize();
  const bytes = Buffer.from(`%PDF-1.7\n${'bounded PDF fixture '.repeat(2000)}\n%%EOF`);
  const digest = createHash('sha256').update(bytes).digest('hex');
  await expect(broker.publishBytes(randomUUID(), bytes, digest, async () => undefined)).rejects.toMatchObject({ code: 'ENOSPC' });
  expect(await readdir(path.join(f.root, 'blobs'))).toEqual([]);
  expect(await readdir(path.join(f.root, 'staging'))).toEqual([]);
  await record({ id: 'F1-17', root: f.root, quotaBytes: 16384, bytes: bytes.length, status: 'PASS', seam: 'PDF candidate file adapter' });
});
it('F1-17: PDF ENOSPC fails the original frozen job without creating a named version or success receipt', async () => {
  const f = await fixture(), workspace = await openWorkspace(f.directory, materialsMigration, releases);
  try {
    const store = createWriterCommands(workspace.database, workspace.workspaceInstance, randomUUID()), session = store.connect();
    const company = OpportunityResult.parse(await store.business(session, 'opportunity', { operation: 'company.create', commandId: randomUUID(), name: 'G6 isolated company' }));
    if (company.kind !== 'company') throw Error('fixture company');
    const opportunity = OpportunityResult.parse(await store.business(session, 'opportunity', { operation: 'create', commandId: randomUUID(), companyId: company.company.id, role: 'G6 isolated role' }));
    if (opportunity.kind !== 'opportunity') throw Error('fixture opportunity');
    const opened = ResumeResult.parse(await store.business(session, 'resume', { operation: 'resume.open', commandId: randomUUID(), opportunityId: opportunity.opportunity.id }));
    if (opened.status !== 'document') throw Error('fixture resume');
    const commandId = randomUUID();
    const job = ResumeResult.parse(await store.business(session, 'resume', { operation: 'resume.name-version', commandId, resumeId: opened.document.id, expectedRevision: opened.document.revision, expectedProfileRevision: opened.profile.revision, name: 'quota failed version' }));
    expect(job.status).toBe('pending-job');
    const bytes = Buffer.from(`%PDF-1.7\n${'PDF fixture '.repeat(3000)}\n%%EOF`);
    const artifact = { blobId: randomUUID(), digest: createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
    expect(store.pdfPrepare(session, commandId, artifact).kind).toBe('publish');
    const broker = createBlobBroker(f.directory, 65536, quotaSink(16384)); await broker.initialize();
    await expect(broker.publishBytes(artifact.blobId, bytes, artifact.digest, async () => store.persistenceAssert(store.producerToken(commandId)))).rejects.toMatchObject({ code: 'ENOSPC' });
    expect(store.pdfFail(commandId)).toEqual({ status: 'failure', code: 'pdf-failed' });
    expect(await store.business(session, 'resume', { operation: 'resume.receipt', commandId })).toEqual({ status: 'failure', code: 'pdf-failed' });
    expect(await store.business(session, 'resume', { operation: 'resume.versions', resumeId: opened.document.id })).toEqual({ status: 'versions', versions: [] });
    for (const id of store.claimGarbage()) { await broker.remove(id); store.deleted(id); }
    expect(await readdir(path.join(f.directory, 'blobs'))).toEqual([]);
    expect(await readdir(path.join(f.directory, 'staging'))).toEqual([]);
    await record({ id: 'F1-17-owner', root: f.root, commandId, quotaBytes: 16384, status: 'PASS', seam: 'PDF frozen owner job + actual candidate sink' });
  } finally { workspace.close(); }
});

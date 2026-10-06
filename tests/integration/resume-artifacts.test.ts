import { beforeAll, it, expect } from 'vitest';
import { build } from 'vite';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRuntimeBackend } from '../../packages/backend/bootstrap/runtime';
import type { HumanSession } from '../../packages/backend/platform/runtime/sessions';
import { Result as OpportunityResult } from '../../packages/contracts/opportunity/schema';
import { Result as ResumeResult } from '../../packages/contracts/resume/schema';
import { Result as ProfileResult } from '../../packages/contracts/profile/schema';

// A bounded platform binary fixture only. Real Chromium PDF/text/CJK evidence is a separate desktop test.
const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids [3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox [0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
const writerArtifact = path.resolve('dist/test-support/resume-artifacts-writer.cjs');
type Runtime = Awaited<ReturnType<typeof createRuntimeBackend>>;
beforeAll(async () => {
  // Build the actual production writer into an isolated test artifact; never replace application output.
  await build({ configFile: false, logLevel: 'silent', build: {
    outDir: 'dist/test-support', emptyOutDir: false, target: 'node24',
    lib: { entry: 'packages/backend/bootstrap/writer.ts', formats: ['cjs'], fileName: () => 'resume-artifacts-writer.cjs' },
    rolldownOptions: { external: [/^node:/, 'better-sqlite3'] },
  } });
}, 20000);
async function newDocument(runtime: Runtime, session: HumanSession) {
  const company = OpportunityResult.parse(await runtime.business(session, 'opportunity', { operation: 'company.create', commandId: randomUUID(), name: 'PDF 技术测试公司' }));
  if (company.kind !== 'company') throw Error('Company creation failed');
  const opportunity = OpportunityResult.parse(await runtime.business(session, 'opportunity', { operation: 'create', commandId: randomUUID(), companyId: company.company.id, role: '技术测试岗位' }));
  if (opportunity.kind !== 'opportunity') throw Error('Opportunity creation failed');
  const opened = ResumeResult.parse(await runtime.business(session, 'resume', { operation: 'resume.open', commandId: randomUUID(), opportunityId: opportunity.opportunity.id }));
  if (opened.status !== 'document') throw Error('Resume open failed');
  return opened;
}
async function prepare(runtime: Runtime, session: HumanSession, commandId = randomUUID()) {
  const opened = await newDocument(runtime, session);
  const intent = { operation: 'resume.name-version', commandId, resumeId: opened.document.id, expectedRevision: opened.document.revision, expectedProfileRevision: opened.profile.revision, name: '平台文件验证版' };
  const result = ResumeResult.parse(await runtime.business(session, 'resume', intent));
  if (result.status !== 'pending-job') throw Error('Frozen job creation failed');
  return { opened, intent, job: result.job };
}
it('a held PDF commits its original owner, exact bytes and frozen Profile; GC and restart retain it', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'career-resume-artifacts-'));
  const workspace = path.join(root, 'workspace');
  const start = () => createRuntimeBackend(workspace, writerArtifact);
  let runtime = await start();
  try {
    let session = await runtime.connectHuman();
    const profile = ProfileResult.parse(await runtime.business(session, 'profile', { operation: 'profile.save', commandId: randomUUID(), expectedRevision: 0, name: '冻结前姓名', contact: 'old@example.test', links: [] }));
    expect(profile.status).toBe('profile');
    const { opened, intent, job } = await prepare(runtime, session);
    expect((await runtime.printHtml(session, intent.commandId)).html).toContain('冻结前姓名');
    const completed = ResumeResult.parse(await runtime.completePdf(session, intent.commandId, pdfBytes));
    if (completed.status !== 'version') throw Error('Version commit failed');
    expect(completed.version).toMatchObject({ id: intent.commandId, resumeId: opened.document.id, snapshot: { id: job.id, resumeRevision: job.resumeRevision, profileRevision: 1, profile: { name: '冻结前姓名', contact: 'old@example.test' } }, pdf: { size: pdfBytes.length, digest: createHash('sha256').update(pdfBytes).digest('hex') } });
    const filename = path.join(workspace, 'blobs', completed.version.pdf.blobId);
    expect(await readFile(filename)).toEqual(pdfBytes);
    expect(ResumeResult.parse(await runtime.business(session, 'resume', { operation: 'resume.receipt', commandId: intent.commandId }))).toEqual(completed);
    expect(ResumeResult.parse(await runtime.business(session, 'resume', intent))).toEqual(completed);
    await runtime.business(session, 'profile', { operation: 'profile.save', commandId: randomUUID(), expectedRevision: 1, name: '当前姓名', contact: 'new@example.test', links: [] });
    expect(ResumeResult.parse(await runtime.business(session, 'resume', { operation: 'resume.read', resumeId: opened.document.id }))).toMatchObject({ status: 'document', profile: { name: '当前姓名', contact: 'new@example.test' } });
    expect(ResumeResult.parse(await runtime.business(session, 'resume', { operation: 'resume.version', resumeId: opened.document.id, versionId: intent.commandId }))).toEqual(completed);
    expect(await runtime.materials.collectGarbage()).toBe(0);
    await runtime.close(); runtime = await start(); session = await runtime.connectHuman();
    expect(ResumeResult.parse(await runtime.business(session, 'resume', { operation: 'resume.version', resumeId: opened.document.id, versionId: intent.commandId }))).toEqual(completed);
    expect(await runtime.materials.collectGarbage()).toBe(0);
    expect(await readFile(filename)).toEqual(pdfBytes);
  } finally { await runtime.close(); await rm(root, { recursive: true, force: true }); }
});
it('invalid PDF and explicit print failure cannot create a completed version or retained blob', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'career-resume-invalid-pdf-'));
  const runtime = await createRuntimeBackend(root, writerArtifact);
  try {
    const session = await runtime.connectHuman();
    const first = await prepare(runtime, session);
    expect(await runtime.completePdf(session, first.intent.commandId, Buffer.from('not PDF'))).toEqual({ status: 'failure', code: 'pdf-failed' });
    expect(ResumeResult.parse(await runtime.business(session, 'resume', { operation: 'resume.versions', resumeId: first.opened.document.id }))).toEqual({ status: 'versions', versions: [] });
    expect(await runtime.business(session, 'resume', { operation: 'resume.receipt', commandId: first.intent.commandId })).toEqual({ status: 'failure', code: 'pdf-failed' });
    const second = await prepare(runtime, session);
    expect(await runtime.failPdf(session, second.intent.commandId)).toEqual({ status: 'failure', code: 'pdf-failed' });
    expect(await readdir(path.join(root, 'blobs'))).toEqual([]);
  } finally { await runtime.close(); await rm(root, { recursive: true, force: true }); }
});
it('reconnect or backend restart fails pending jobs, and forged or retired sessions cannot complete a fresh job', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'career-resume-session-pdf-'));
  const start = () => createRuntimeBackend(root, writerArtifact);
  let runtime = await start();
  try {
    const old = await runtime.connectHuman(); const first = await prepare(runtime, old);
    let session = await runtime.connectHuman();
    expect(await runtime.business(session, 'resume', { operation: 'resume.receipt', commandId: first.intent.commandId })).toEqual({ status: 'failure', code: 'pdf-failed' });
    await expect(runtime.completePdf(old, first.intent.commandId, pdfBytes)).rejects.toThrow('invalid_capability');
    const fresh = await prepare(runtime, session);
    await expect(runtime.completePdf(old, fresh.intent.commandId, pdfBytes)).rejects.toThrow('invalid_capability');
    await expect(runtime.completePdf({ ...session, actor: { kind: 'human', token: randomUUID() } }, fresh.intent.commandId, pdfBytes)).rejects.toThrow('invalid_capability');
    expect(await runtime.business(session, 'resume', { operation: 'resume.receipt', commandId: fresh.intent.commandId })).toMatchObject({ status: 'pending-job', job: { id: fresh.job.id } });
    expect(await runtime.completePdf(session, fresh.intent.commandId, pdfBytes)).toMatchObject({ status: 'version', version: { id: fresh.intent.commandId } });
    const unfinished = await prepare(runtime, session);
    await runtime.close(); runtime = await start(); session = await runtime.connectHuman();
    expect(await runtime.business(session, 'resume', { operation: 'resume.receipt', commandId: unfinished.intent.commandId })).toEqual({ status: 'failure', code: 'pdf-failed' });
    expect(await runtime.business(session, 'resume', { operation: 'resume.versions', resumeId: unfinished.opened.document.id })).toEqual({ status: 'versions', versions: [] });
  } finally { await runtime.close(); await rm(root, { recursive: true, force: true }); }
});
it('the same command UUID in Materials and Resume remains two isolated owner receipts', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'career-resume-material-collision-'));
  const runtime = await createRuntimeBackend(path.join(root, 'workspace'), writerArtifact);
  try {
    const session = await runtime.connectHuman(); const commandId = randomUUID();
    const source = path.join(root, 'source.txt'); await writeFile(source, '独立 Raw 技术测试原件');
    const preview = await runtime.materials.selectFile(session, source);
    const rawReceipt = await runtime.materials.confirm(session, { commandId, importId: preview.importId, expectedRevision: 1, digest: preview.digest });
    if (rawReceipt.status !== 'committed') throw Error('Materials confirmation failed');
    expect(await runtime.business(session, 'resume', { operation: 'resume.receipt', commandId })).toEqual({ status: 'not-found' });
    const named = await prepare(runtime, session, commandId);
    const version = await runtime.completePdf(session, commandId, pdfBytes);
    expect(version).toMatchObject({ status: 'version', version: { id: commandId, resumeId: named.opened.document.id } });
    expect(await runtime.materials.receipt(session, commandId)).toEqual(rawReceipt);
    expect(await runtime.business(session, 'resume', { operation: 'resume.receipt', commandId })).toEqual(version);
    expect((await runtime.materials.read(session, rawReceipt.materialId)).text).toBe('独立 Raw 技术测试原件');
    expect(await runtime.materials.collectGarbage()).toBe(0);
  } finally { await runtime.close(); await rm(root, { recursive: true, force: true }); }
});

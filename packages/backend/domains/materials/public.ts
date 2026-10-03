import {controlledFeishuCandidates,controlledFeishuBody} from '../../platform/imports/controlled-feishu';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { startWriter } from '../../platform/database/client';
import { createBlobBroker } from '../../platform/files/blobs';
import { Confirm, SourceRef, Raw, Preview, MAX_TEXT_BYTES, type Receipt } from '../../../contracts/materials/schema';
import type {ProductionSinkAdapter} from '../../platform/files/staging';
import { staging } from '../../platform/files/staging';
import type { HumanSession, Store } from './store';

export async function createMaterialsBackend(root: string, makeBlobs: typeof createBlobBroker = createBlobBroker, writerArtifact?: string, providedWriter?: Awaited<ReturnType<typeof startWriter<Store>>>,sinkFor?:(id:string)=>Promise<ProductionSinkAdapter>) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const writer = providedWriter ?? await startWriter<Store>(root, randomUUID(), writerArtifact);
  const blobs = makeBlobs(root, MAX_TEXT_BYTES);
  const files = staging(root, MAX_TEXT_BYTES);
  async function collectGarbage() {
    const claimed = await writer.call('claimGarbage');
    for (const id of claimed) { await blobs.remove(id); await writer.call('deleted', id); }
    return claimed.length;
  }
  try {
    await blobs.initialize();
    await files.initialize();
    for (const id of await writer.call('recover')) await files.remove(id);
    await files.cleanupAbandoned();
    await collectGarbage();
  } catch (error) {
    await writer.close();
    throw error;
  }
  let closing = false;
  const operations = new Set<Promise<unknown>>();
  const saves = new Map<string, Set<Promise<Receipt>>>();
  const selections = new Map<string, Promise<Preview>>();
  function track<T>(job: Promise<T>) {
    operations.add(job);
    void job.finally(() => operations.delete(job)).catch(() => undefined);
    return job;
  }
  async function read(session: HumanSession, id: string) {
    const { blobId, ...metadata } = await writer.call('read', session, id);
    const text = await blobs.read(blobId, metadata.digest);
    await writer.call('read', session, id);
    return Raw.parse({ ...metadata, text });
  }
  async function selectFile(session: HumanSession, filename: string,target?:import('../../../contracts/materials/schema').ImportTarget) {
    if (!['.txt', '.md'].includes(path.extname(filename).toLowerCase())) throw new Error('unsupported_file');
    const id = await writer.call('begin', session, path.basename(filename),target);
    const job=(async()=>{try {
      const file = await files.select(id, filename, () => writer.call('valid', session, id),await sinkFor?.(id));
      const preview = Preview.parse({ ...file, importId: id, revision: 1, saved: false,...target?{target}:{} });
      await writer.call('preview', session, preview);
      return preview;
    } catch (error) {
      await writer.call('cancel', session, id).catch(() => undefined);
      await files.remove(id).catch(() => undefined);
      throw new Error(error instanceof Error && ['unsupported_file', 'invalid_capability'].includes(error.message) ? error.message : 'file_failed');
    }})();
    selections.set(id,job);
    try{return await job;}finally{selections.delete(id);}
  }
  return {
    fixtureCandidates(target:import('../../../contracts/materials/schema').ImportTarget){return {kind:'fixture-candidates' as const,target,adapter:'controlled-feishu-shaped-fixture; no network' as const,candidates:controlledFeishuCandidates()};},
    fixtureBody(session:HumanSession,target:import('../../../contracts/materials/schema').ImportTarget,candidateId:string){return track((async()=>{const document=controlledFeishuBody(candidateId);if(!document)throw Error('not_found');const id=await writer.call('begin',session,document.title,target);try{const value=await files.text(id,document.title,document.body,()=>writer.call('valid',session,id),await sinkFor?.(id));const preview=Preview.parse({...value,importId:id,target,revision:1,saved:false});await writer.call('preview',session,preview);return preview;}catch(error){await writer.call('cancel',session,id).catch(()=>{});await files.remove(id).catch(()=>{});throw error;}})());},
    pendingImports:()=>writer.call('pendingImports'),
    importPurgeImpact:(id:string)=>writer.call('importPurgeImpact',id),
    async purgeImport(id:string){
      await writer.call('purgeImport',id);
      await Promise.allSettled([...(saves.get(id)??[]),...(selections.has(id)?[selections.get(id)!]:[])]);
      await files.remove(id);
      await collectGarbage();
    },
    async connectHuman() {
      if (closing) throw new Error('disconnected');
      const session = await writer.call('connect');
      await Promise.allSettled([...operations]);
      await files.cleanupAbandoned();
      return session;
    },
    selectFile(session: HumanSession, filename: string,target?:import('../../../contracts/materials/schema').ImportTarget) {
      if (closing) return Promise.reject(new Error('disconnected'));
      return track(selectFile(session, filename,target));
    },
    async cancel(session: HumanSession, id: string) {
      await writer.call('cancel', session, id);
      await Promise.allSettled([...(saves.get(id) ?? [])]);
      await files.remove(id);
    },
    list: (session: HumanSession) => writer.call('list', session),
    confirm(session: HumanSession, input: Confirm) {
      if (closing) return Promise.reject(new Error('disconnected'));
      input = Confirm.parse(input);
      const job = (async () => {
        const prepared = await writer.call('prepare', session, input);
        if (prepared.kind === 'receipt') return prepared.receipt;
        try {
          await blobs.publish(input.importId, prepared.blobId, prepared.size, input.digest, () => writer.call('valid', session, input.importId),await sinkFor?.(input.importId));
          await writer.call('published', session, input, prepared.blobId);
          const receipt = await writer.call('commit', session, input, prepared.blobId);
          await files.remove(input.importId).catch(() => undefined);
          return receipt;
        } catch (error) {
          const code = error instanceof Error && ['invalid_capability', 'db_failed', 'conflict'].includes(error.message) ? error.message as 'invalid_capability' | 'db_failed' | 'conflict' : 'storage_failed';
          await writer.call('fail', input.commandId, code);
          // A durable deletion claim survives an unavailable filesystem and is retried on startup.
          await collectGarbage().catch(() => undefined);
          return writer.call('receipt', session, input.commandId);
        }
      })();
      const active = saves.get(input.importId) ?? new Set<Promise<Receipt>>();
      saves.set(input.importId, active);
      active.add(job);
      void job.finally(() => {
        active.delete(job);
        if (active.size === 0) saves.delete(input.importId);
      }).catch(() => undefined);
      return track(job);
    },
    receipt: (session: HumanSession, id: string) => writer.call('receipt', session, id),
    read: (session: HumanSession, id: string) => track(read(session, id)),
    async resolveSource(session: HumanSession, input: SourceRef) {
      const ref = SourceRef.parse(input);
      return track(read(session, ref.objectId));
    },
    collectGarbage: () => track(collectGarbage()),
    stagingCount: () => files.count(),
    async close() { closing = true; await Promise.allSettled([...operations]); await writer.close(); },
  };
}
export type MaterialsBackend = Awaited<ReturnType<typeof createMaterialsBackend>>;

export {validateCandidate,candidateRelations} from './candidate-validation';

export {importTargetMigration} from './targets';

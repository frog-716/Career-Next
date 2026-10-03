// Isolated backend process under test; the supervisor supplies SIGKILL.
import { writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createMaterialsBackend } from '../../packages/backend/domains/materials/public';
import { createBlobBroker } from '../../packages/backend/platform/files/blobs';
import { startWriter } from '../../packages/backend/platform/database/client';
import type { Store } from '../../packages/backend/domains/materials/store';
import type { ProductionSinkAdapter } from '../../packages/backend/platform/files/staging';

const [root, filename, cut, artifact] = process.argv.slice(2) as [string, string, string, string];
process.env.G6_STORAGE_CUT = cut;
function halt(point: string) {
  if (cut !== point) return;
  writeFileSync(path.join(root, 'g6-checkpoint.json'), JSON.stringify({ point }));
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
}
const realWriter = await startWriter<Store>(root, randomUUID(), artifact);
const writer = {
  ...realWriter,
  async call(method: keyof Store, ...args: unknown[]) {
    const result = await (realWriter.call as (...args: unknown[]) => Promise<unknown>)(method, ...args);
    if (method === 'prepare') halt('hold-after');
    if (method === 'commit') halt('commit-after');
    if (method === 'receipt') halt('receipt-after');
    return result;
  },
} as typeof realWriter;
const adapter: ProductionSinkAdapter = {
  withLease: work => work(),
  async controlledSink(filename) {
    const publishing = path.basename(filename).startsWith('publish-');
    if (!publishing) halt('staging-before');
    const handle = await open(filename, 'wx', 0o600);
    return {
      append: bytes => handle.writeFile(bytes),
      async close() {
        await handle.sync(); await handle.close();
        halt(publishing ? 'publish-before' : 'staging-after');
      },
    };
  },
};
const backend = await createMaterialsBackend(root, (root, maxBytes) => {
  const real = createBlobBroker(root, maxBytes);
  return { ...real, async publish(...args) { await real.publish(...args); halt('publish-after'); } };
}, undefined, writer, async () => adapter);
const session = await backend.connectHuman();
writeFileSync(path.join(root, 'g6-session.json'), JSON.stringify(session));
const preview = await backend.selectFile(session, filename);
const input = { commandId: randomUUID(), importId: preview.importId, expectedRevision: 1 as const, digest: preview.digest };
writeFileSync(path.join(root, 'g6-intent.json'), JSON.stringify(input));
const result = await backend.confirm(session, input);
writeFileSync(path.join(root, 'g6-response.json'), JSON.stringify(result));
if (cut === 'receipt-after') await backend.receipt(session, input.commandId);
await backend.close();

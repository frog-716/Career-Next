// External integration driver only; never included in the application package.
import path from 'node:path';
import { createMaterialsBackend } from '../../packages/backend/domains/materials/public';
import { createBlobBroker } from '../../packages/backend/platform/files/blobs';
const commandId = crypto.randomUUID();
const backend = await createMaterialsBackend(process.argv[2]!, (root,maxBytes) => {
  const real = createBlobBroker(root,maxBytes);
  return { ...real, async publish(...args) {
    await real.publish(...args);
    process.send?.({ commandId, blobId: args[1] });
    await new Promise<void>(() => undefined);
  } };
}, path.resolve('dist/application/writer.cjs'));
const session = await backend.connectHuman();
const preview = await backend.selectFile(session, process.argv[3]!);
await backend.confirm(session, { commandId,importId:preview.importId,expectedRevision:1,digest:preview.digest });

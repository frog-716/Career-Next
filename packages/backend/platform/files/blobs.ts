import { open, mkdir, link, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { syncDirectory, withFileLease, writeCandidate, type ProductionSinkAdapter } from './staging';

export function createBlobBroker(root: string, maxBytes: number, adapter?: ProductionSinkAdapter) {
  const directory = path.join(root, 'blobs');
  async function publishCandidate(blobId: string, bytes: Buffer, check: () => Promise<unknown>, operationAdapter?: ProductionSinkAdapter) {
    const temporary = path.join(root, 'staging', `publish-${blobId}`);
    try {
      await writeCandidate(temporary, bytes, check, operationAdapter);
      // Publication and directory persistence share one tracked lease; purge drains it before unlinking.
      await withFileLease(operationAdapter, async () => {
        await check();
        await link(temporary, path.join(directory, blobId));
        await syncDirectory(directory);
      });
    } finally { await rm(temporary, { force: true }); }
  }
  return {
    async initialize() { await withFileLease(adapter, () => mkdir(directory, { recursive: true, mode: 0o700 })); },
    async publish(importId: string, blobId: string, expectedSize: number, digest: string, check: () => Promise<unknown>, operationAdapter = adapter) {
      if (!uuid.test(importId) || !uuid.test(blobId)) throw Error('storage_failed');
      const bytes = await readBounded(path.join(root, 'staging', importId), maxBytes, check, operationAdapter);
      if (bytes.length !== expectedSize || createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error('storage_failed');
      await publishCandidate(blobId, bytes, check, operationAdapter);
    },
    async publishBytes(blobId: string, input: Uint8Array, digest: string, check: () => Promise<unknown>, operationAdapter = adapter) {
      if (!uuid.test(blobId) || input.byteLength === 0 || input.byteLength > maxBytes) throw Error('storage_failed');
      const bytes = Buffer.from(input);
      if (createHash('sha256').update(bytes).digest('hex') !== digest) throw Error('storage_failed');
      await withFileLease(operationAdapter, async () => { await check(); await mkdir(path.join(root, 'staging'), { recursive: true, mode: 0o700 }); });
      await publishCandidate(blobId, bytes, check, operationAdapter);
    },
    async readBytes(blobId: string, digest: string, operationAdapter = adapter) {
      if (!uuid.test(blobId)) throw Error('content_unavailable');
      const bytes = await readBounded(path.join(directory, blobId), maxBytes, undefined, operationAdapter);
      if (createHash('sha256').update(bytes).digest('hex') !== digest) throw Error('content_unavailable');
      return bytes;
    },
    async read(blobId: string, digest: string, operationAdapter = adapter) {
      try {
        if (!uuid.test(blobId)) throw Error('content_unavailable');
        const bytes = await readBounded(path.join(directory, blobId), maxBytes, undefined, operationAdapter);
        if (createHash('sha256').update(bytes).digest('hex') !== digest) throw Error('content_unavailable');
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch { throw Error('content_unavailable'); }
    },
    async remove(blobId: string) {
      if (!uuid.test(blobId)) throw Error('content_unavailable');
      await rm(path.join(directory, blobId), { force: true });
      await syncDirectory(directory);
    },
  };
}
async function readBounded(filename: string, maxBytes: number, check?: () => Promise<unknown>, adapter?: ProductionSinkAdapter) {
  return withFileLease(adapter, async () => {
    await check?.();
    const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > maxBytes) throw Error('storage_failed');
      const bytes = Buffer.alloc(maxBytes + 1);
      let count = 0;
      while (count < bytes.length) {
        await check?.();
        const { bytesRead } = await handle.read(bytes, count, Math.min(16_384, bytes.length - count), count);
        if (!bytesRead) break;
        count += bytesRead;
      }
      if (count > maxBytes) throw Error('storage_failed');
      await check?.();
      return bytes.subarray(0, count);
    } finally { await handle.close(); }
  });
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

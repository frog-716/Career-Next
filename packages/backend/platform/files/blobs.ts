import { open, mkdir, link, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { syncDirectory } from './staging';

export function createBlobBroker(root: string, maxBytes: number) {
  const directory = path.join(root, 'blobs');
  return {
    async initialize() { await mkdir(directory, { recursive: true, mode: 0o700 }); },
    async publish(importId: string, blobId: string, expectedSize: number, digest: string, check: () => Promise<unknown>) {
      const bytes = await readBounded(path.join(root, 'staging', importId), maxBytes, check);
      if (bytes.length !== expectedSize || createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error('storage_failed');
      const temporary = path.join(root, 'staging', `publish-${blobId}`);
      try {
        const output = await open(temporary, 'wx', 0o600);
        try {
          for (let offset = 0; offset < bytes.length; offset += 16_384) {
            await check();
            await output.writeFile(bytes.subarray(offset, offset + 16_384));
          }
          await output.sync();
        } finally { await output.close(); }
        await check();
        await link(temporary, path.join(directory, blobId));
        await syncDirectory(directory);
      } finally { await rm(temporary, { force: true }); }
    },
    async read(blobId: string, digest: string) {
      try {
        const bytes = await readBounded(path.join(directory, blobId), maxBytes);
        if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error('content_unavailable');
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch { throw new Error('content_unavailable'); }
    },
    async remove(blobId: string) {
      await rm(path.join(directory, blobId), { force: true });
      await syncDirectory(directory);
    },
  };
}

async function readBounded(filename: string, maxBytes: number, check?: () => Promise<unknown>) {
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > maxBytes) throw new Error('storage_failed');
    const bytes = Buffer.alloc(maxBytes + 1);
    let count = 0;
    while (count < bytes.length) {
      await check?.();
      const { bytesRead } = await handle.read(bytes, count, Math.min(16_384, bytes.length - count), count);
      if (!bytesRead) break;
      count += bytesRead;
    }
    if (count > maxBytes) throw new Error('storage_failed');
    return bytes.subarray(0, count);
  } finally { await handle.close(); }
}

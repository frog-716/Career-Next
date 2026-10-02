import { constants } from 'node:fs';
import { open, mkdir, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export async function syncDirectory(directory: string) {
  const handle = await open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

export function staging(root: string, maxBytes: number) {
  const directory = path.join(root, 'staging');
  return {
    async initialize() { await mkdir(directory, { recursive: true, mode: 0o700 }); },
    async select(id: string, filename: string, check: () => Promise<unknown>) {
      const target = path.join(directory, id);
      const source = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
      let bytes: Buffer;
      try {
        const info = await source.stat();
        if (!info.isFile() || info.size > maxBytes) throw new Error('unsupported_file');
        bytes = Buffer.alloc(maxBytes + 1);
        let count = 0;
        while (count < bytes.length) {
          await check();
          const { bytesRead } = await source.read(bytes, count, Math.min(16_384, bytes.length - count), count);
          if (!bytesRead) break;
          count += bytesRead;
        }
        if (count > maxBytes) throw new Error('unsupported_file');
        bytes = bytes.subarray(0, count);
      } finally { await source.close(); }
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new Error('unsupported_file'); }
      if (text.includes('\0')) throw new Error('unsupported_file');
      const handle = await open(target, 'wx', 0o600);
      try {
        for (let offset = 0; offset < bytes.length; offset += 16_384) {
          await check();
          await handle.writeFile(bytes.subarray(offset, offset + 16_384));
        }
        await handle.sync();
      } finally { await handle.close(); }
      await syncDirectory(directory);
      return { name: path.basename(filename), size: bytes.length, digest: createHash('sha256').update(bytes).digest('hex'), text };
    },
    async remove(id: string) { await rm(path.join(directory, id), { force: true }); },
    async cleanupAbandoned() {
      for (const name of await readdir(directory)) {
        if (/^(?:publish-)?[a-f0-9-]{36}$/.test(name)) await rm(path.join(directory, name), { force: true });
      }
      await syncDirectory(directory);
    },
    async count() { return (await readdir(directory)).length; },
  };
}

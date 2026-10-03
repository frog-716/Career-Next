import { constants } from 'node:fs';
import { open, mkdir, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

/** Injected by the trusted producer coordinator; paths never come from renderer DTOs. */
export interface ProductionSinkAdapter {
  controlledSink(internalPath: string): Promise<{
    append(bytes: Uint8Array): Promise<void>;
    close(): Promise<void>;
  }>;
  withLease<T>(work: () => Promise<T>): Promise<T>;
}
export async function withFileLease<T>(adapter: ProductionSinkAdapter | undefined, work: () => Promise<T>) {
  return adapter ? adapter.withLease(work) : work();
}
export async function syncDirectory(directory: string) {
  const handle = await open(directory, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}
/** All production body-bearing write descriptors belong to the controlled sink. */
export async function writeCandidate(filename: string, bytes: Uint8Array, check: () => Promise<unknown>, adapter?: ProductionSinkAdapter) {
  await check();
  if (adapter) {
    const sink = await adapter.controlledSink(filename);
    try {
      for (let offset = 0; offset < bytes.length; offset += 16_384) {
        await check();
        await sink.append(bytes.subarray(offset, offset + 16_384));
      }
    } finally { await sink.close(); }
  } else {
    // Compatibility for isolated brokers; production always supplies the coordinator adapter.
    const handle = await open(filename, 'wx', 0o600);
    try {
      for (let offset = 0; offset < bytes.length; offset += 16_384) {
        await check();
        await handle.writeFile(bytes.subarray(offset, offset + 16_384));
      }
      await handle.sync();
    } finally { await handle.close(); }
  }
}
export function staging(root: string, maxBytes: number, adapter?: ProductionSinkAdapter) {
  const directory = path.join(root, 'staging');
  return {
    async initialize() { await withFileLease(adapter, () => mkdir(directory, { recursive: true, mode: 0o700 })); },
    async text(id:string,name:string,text:string,check:()=>Promise<unknown>,operationAdapter=adapter){if(!uuid.test(id))throw Error('unsupported_file');const bytes=Buffer.from(text,'utf8');if(bytes.length>maxBytes||text.includes('\0'))throw Error('unsupported_file');await writeCandidate(path.join(directory,id),bytes,check,operationAdapter);await withFileLease(operationAdapter,async()=>{await check();await syncDirectory(directory);});return {name,size:bytes.length,digest:createHash('sha256').update(bytes).digest('hex'),text};},
    async select(id: string, filename: string, check: () => Promise<unknown>, operationAdapter = adapter) {
      if (!uuid.test(id)) throw Error('unsupported_file');
      const target = path.join(directory, id);
      const bytes = await withFileLease(operationAdapter, async () => {
        await check();
        const source = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          const info = await source.stat();
          if (!info.isFile() || info.size > maxBytes) throw new Error('unsupported_file');
          const buffer = Buffer.alloc(maxBytes + 1);
          let count = 0;
          while (count < buffer.length) {
            await check();
            const { bytesRead } = await source.read(buffer, count, Math.min(16_384, buffer.length - count), count);
            if (!bytesRead) break;
            count += bytesRead;
          }
          if (count > maxBytes) throw new Error('unsupported_file');
          await check();
          return buffer.subarray(0, count);
        } finally { await source.close(); }
      });
      let text: string;
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { throw new Error('unsupported_file'); }
      if (text.includes('\0')) throw new Error('unsupported_file');
      await writeCandidate(target, bytes, check, operationAdapter);
      await withFileLease(operationAdapter, async () => { await check(); await syncDirectory(directory); });
      return { name: path.basename(filename), size: bytes.length, digest: createHash('sha256').update(bytes).digest('hex'), text };
    },
    async remove(id: string) { if (!uuid.test(id)) throw Error('unsupported_file'); await rm(path.join(directory, id), { force: true }); },
    async cleanupAbandoned() {
      for (const name of await readdir(directory)) {
        if (/^(?:publish-)?[a-f0-9-]{36}$/.test(name)) await rm(path.join(directory, name), { force: true });
      }
      await syncDirectory(directory);
    },
    async count() { return (await readdir(directory)).length; },
  };
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

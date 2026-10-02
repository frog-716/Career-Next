import { safeStorage } from 'electron';
import { writeFile, readFile, access } from 'node:fs/promises';
import path from 'node:path';

// Trusted G0 adapter: dedicated write path, ciphertext only, no public getter.
export function secretAdapter(directory: string) {
  const filename = path.join(directory, 'g0-secret.encrypted');
  return {
    async save(input: unknown) {
      if (typeof input !== 'string' || input.length < 16 || input.length > 512) throw new Error('G0_INVALID_SECRET');
      if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('G0_SECURE_STORAGE_UNAVAILABLE');
      const encrypted = await safeStorage.encryptStringAsync(input);
      await writeFile(filename, encrypted, { mode: 0o600 });
      const verified = await safeStorage.decryptStringAsync(await readFile(filename));
      if (verified.result !== input) throw new Error('G0_SECRET_ROUNDTRIP_FAILED');
      return { configured: true };
    },
    async status() {
      try { await access(filename); return { configured: true }; }
      catch { return { configured: false }; }
    },
  };
}

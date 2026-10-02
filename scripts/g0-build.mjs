// Independent Vite bundles; Forge is only responsible for packaging.
import { build } from 'vite';
import { mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/desktop', { recursive: true });
for (const [name, entry] of Object.entries({
  main: 'apps/desktop/probe/main.ts', preload: 'apps/desktop/probe/preload.ts',
  utility: 'packages/backend/probe/utility.ts', 'sqlite-worker': 'packages/backend/probe/sqlite-worker.ts',
})) {
  await build({ configFile: false, build: { emptyOutDir: false, outDir: 'dist/desktop', target: 'node24',
    lib: { entry, formats: ['cjs'], fileName: () => `${name}.cjs` },
    rolldownOptions: { external: [/^node:/, 'electron', 'better-sqlite3'] },
  } });
}
await build({ configFile: false, root: 'packages/frontend/probe', base: './',
  build: { outDir: '../../../dist/renderer', emptyOutDir: true },
});

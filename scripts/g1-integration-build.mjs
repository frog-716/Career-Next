import { build } from 'vite';
await build({configFile:false,build:{outDir:'dist/test-support',target:'node24',lib:{entry:'tests/fixtures/publish-crash.ts',formats:['es'],fileName:()=> 'publish-crash.mjs'},rolldownOptions:{external:[/^node:/,'better-sqlite3']}}});
await build({configFile:false,build:{emptyOutDir:false,outDir:'dist/test-support',target:'node24',lib:{entry:'tests/fixtures/e1-pdf-reference.ts',formats:['cjs'],fileName:()=> 'e1-pdf-reference.cjs'},rolldownOptions:{external:[/^node:/,'electron']}}});

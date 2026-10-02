import { build } from 'vite';
await build({configFile:false,build:{outDir:'dist/test-support',target:'node24',lib:{entry:'tests/fixtures/publish-crash.ts',formats:['es'],fileName:()=> 'publish-crash.mjs'},rolldownOptions:{external:[/^node:/,'better-sqlite3']}}});

import { z } from 'zod';
import { businessManifests } from '../packages/contracts/registry.ts';
import { materialsManifest } from '../packages/contracts/materials/manifest.ts';
import { build } from 'vite';
import { rm, mkdir, writeFile } from 'node:fs/promises';
await rm('dist/application',{recursive:true,force:true});
await rm('dist/materials-renderer',{recursive:true,force:true});
const entries={writer:'packages/backend/bootstrap/writer.ts','local-search':'packages/backend/platform/search/worker.ts'};
for(const [name,entry] of Object.entries(entries)) await build({configFile:false,build:{emptyOutDir:false,outDir:'dist/application',target:'node24',lib:{entry,formats:['cjs'],fileName:()=>`${name}.cjs`},rolldownOptions:{external:[/^node:/,'better-sqlite3']}}});
await build({configFile:false,root:'packages/frontend/app',base:'./',build:{outDir:'../../../dist/materials-renderer',emptyOutDir:true}});

for(const manifest of [materialsManifest,...businessManifests]) {
 await mkdir(`dist/contracts/${manifest.module}`,{recursive:true});
 for(const [name,schema] of Object.entries(manifest.schemas))await writeFile(`dist/contracts/${manifest.module}/${name}.json`,JSON.stringify(z.toJSONSchema(schema),null,2)+'\n');
 await writeFile(`dist/contracts/${manifest.module}/operations.json`,JSON.stringify({module:manifest.module,operations:manifest.operations},null,2)+'\n');
}

await import('./e1-build.mjs');

import { z } from 'zod';
import { materialsManifest } from '../packages/contracts/materials/manifest.ts';
import { build } from 'vite';
import { rm, mkdir, writeFile } from 'node:fs/promises';
await rm('dist/application',{recursive:true,force:true});
await rm('dist/materials-renderer',{recursive:true,force:true});
const entries={main:'apps/desktop/main/main.ts',preload:'apps/desktop/preload/materials.ts',utility:'packages/backend/bootstrap/utility.ts',writer:'packages/backend/bootstrap/writer.ts'};
for(const [name,entry] of Object.entries(entries)) await build({configFile:false,build:{emptyOutDir:false,outDir:'dist/application',target:'node24',lib:{entry,formats:['cjs'],fileName:()=>`${name}.cjs`},rolldownOptions:{external:[/^node:/,'electron','better-sqlite3']}}});
await build({configFile:false,root:'packages/frontend/app',base:'./',build:{outDir:'../../../dist/materials-renderer',emptyOutDir:true}});

await mkdir('dist/contracts/materials', {recursive:true});
for (const [name,schema] of Object.entries(materialsManifest.schemas)) {
  await writeFile(`dist/contracts/materials/${name}.json`, JSON.stringify(z.toJSONSchema(schema),null,2)+'\n');
}
await writeFile('dist/contracts/materials/operations.json', JSON.stringify({module:materialsManifest.module,operations:materialsManifest.operations},null,2)+'\n');

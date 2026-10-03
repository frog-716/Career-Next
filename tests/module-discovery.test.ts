import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { findFragments } from '../scripts/module-fragments';

it('mechanical discovery includes independently owned nested Opportunity fragments in stable order', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'career-manifests-'));
  try {
    for(const fragment of ['opportunity/offer/manifest.ts','opportunity/manifest.ts','wiki/manifest.ts','opportunity/interview/manifest.ts','generated/manifest.ts']) {
      await mkdir(path.dirname(path.join(root,fragment)),{recursive:true});
      await writeFile(path.join(root,fragment),'// discovery fixture, not business content');
    }
    const found=await findFragments(pathToFileURL(root+'/'),'manifest.ts');
    expect(found.map(item=>item.path)).toEqual(['opportunity/interview/manifest.ts','opportunity/manifest.ts','opportunity/offer/manifest.ts','wiki/manifest.ts']);
    expect(await findFragments(pathToFileURL(root+'/'),'routes.ts')).toEqual([]);
  }finally{await rm(root,{recursive:true,force:true});}
});

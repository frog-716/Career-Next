import { it, expect } from 'vitest';
import { build } from 'vite';
import Database from 'better-sqlite3';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRuntimeBackend } from '../../packages/backend/bootstrap/runtime';
import { Result as OpportunityResult } from '../../packages/contracts/opportunity/schema';
import { Result as WikiResult } from '../../packages/contracts/wiki/schema';

const releasedG2='e3fd0e1c53db170a847e93a5d9c3f4faead99b2e';
async function releasedWriter(directory:string) {
 const files=execFileSync('git',['ls-tree','-r','--name-only',releasedG2,'packages/backend','packages/contracts','packages/frontend/features','scripts/generate-modules.mjs'],{encoding:'utf8'}).split('\n').filter(file=>!file.includes('/probe/')&&(/^(packages\/(backend|contracts)\/).+\.ts$/.test(file)||file.endsWith('/routes.ts')||file==='scripts/generate-modules.mjs'));
 for(const file of files){const destination=path.join(directory,file);await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,execFileSync('git',['show',releasedG2+':'+file]));}
 execFileSync(process.execPath,[path.join(directory,'scripts/generate-modules.mjs')],{cwd:directory,stdio:'pipe'});
 const output=path.join(directory,'built');
 await build({configFile:false,logLevel:'error',build:{outDir:output,target:'node24',lib:{entry:path.join(directory,'packages/backend/bootstrap/writer.ts'),formats:['cjs'],fileName:()=> 'g2-writer.cjs'},rolldownOptions:{external:[/^node:/,'better-sqlite3']}}});
 await build({configFile:false,logLevel:'error',build:{outDir:output,emptyOutDir:false,target:'node24',lib:{entry:path.join(directory,'packages/backend/bootstrap/runtime.ts'),formats:['cjs'],fileName:()=> 'g2-runtime.cjs'},rolldownOptions:{external:[/^node:/,'better-sqlite3']}}});
 return {writer:path.join(output,'g2-writer.cjs'),runtime:path.join(output,'g2-runtime.cjs')};
}

it('upgrades the actual released G2 writer workspace once while retaining original bytes, public owner identities and receipts',async()=>{
 await mkdir('dist/test-support',{recursive:true});
 const buildRoot=await mkdtemp(path.resolve('dist/test-support/g2-released-'));
 const root=await mkdtemp(path.join(tmpdir(),'career-g2-g3-upgrade-')),workspace=path.join(root,'workspace');
 let runtime:Awaited<ReturnType<typeof createRuntimeBackend>>|undefined;
 try {
  const artifact=await releasedWriter(buildRoot);const released=await import(artifact.runtime) as {createRuntimeBackend:typeof createRuntimeBackend};runtime=await released.createRuntimeBackend(workspace,artifact.writer);
  const session=await runtime.connectHuman();const file=path.join(root,'Evidence.txt');await writeFile(file,'G2 original unchanged through G3.');
  const preview=await runtime.materials.selectFile(session,file);
  const originalIntent={commandId:crypto.randomUUID(),importId:preview.importId,expectedRevision:1 as const,digest:preview.digest};
  const receipt=await runtime.materials.confirm(session,originalIntent);if(receipt.status!=='committed')throw Error('fixture failed');
  const raw=await runtime.materials.read(session,receipt.materialId);
  const c=OpportunityResult.parse(await runtime.business(session,'opportunity',{operation:'company.create',commandId:crypto.randomUUID(),name:'Released G2 Company'}));if(c.kind!=='company')throw Error('fixture company failed');
  const create={operation:'create',commandId:crypto.randomUUID(),companyId:c.company.id,role:'Released role'};
  const o=OpportunityResult.parse(await runtime.business(session,'opportunity',create));if(o.kind!=='opportunity')throw Error('fixture opportunity failed');
  const k=WikiResult.parse(await runtime.business(session,'wiki',{operation:'create',commandId:crypto.randomUUID(),title:'Released knowledge',body:'G2 owned knowledge',scope:'personal',nature:'observation',sources:[{ref:raw.source,purpose:'Original reference'}]}));if(k.kind!=='knowledge')throw Error('fixture wiki failed');
  await runtime.close();runtime=undefined;
  const oldDb=new Database(path.join(workspace,'career.sqlite'),{readonly:true});expect(oldDb.pragma('user_version',{simple:true})).toBe(2);oldDb.close();
  runtime=await createRuntimeBackend(workspace,path.resolve('dist/application/writer.cjs'));
  const current=await runtime.connectHuman();expect(current.workspaceInstance).toBe(session.workspaceInstance);
  expect(await runtime.materials.read(current,raw.id)).toEqual(raw);
  expect(await runtime.materials.receipt(current,originalIntent.commandId)).toEqual(receipt);
  expect(await runtime.business(current,'opportunity',{operation:'read',id:o.opportunity.id})).toEqual(o);
  expect(await runtime.business(current,'opportunity',{operation:'receipt',commandId:create.commandId})).toEqual(o);
  expect(await runtime.business(current,'wiki',{operation:'read',id:k.knowledge.id})).toEqual({...k,knowledge:{...k.knowledge,reviewRequired:false}});
  expect(await runtime.materials.collectGarbage()).toBe(0);
  await runtime.close();runtime=undefined;
  const db=new Database(path.join(workspace,'career.sqlite'),{readonly:true});
  try{expect(db.pragma('user_version',{simple:true})).toBe(4);expect(db.pragma('foreign_key_check')).toEqual([]);expect(db.prepare('SELECT name FROM platform_migration_batches ORDER BY version').all()).toEqual([{name:'001-g1'},{name:'002-g2-first-batch'},{name:'003-g3-submodules'},{name:'004-g4-seams'}]);}finally{db.close();}
  const copies=JSON.parse(await readFile(path.join(workspace,'managed-copies.json'),'utf8')) as {copies:{fromVersion:number;toVersion:number;state:string}[]};
  expect(copies.copies.at(-1)).toMatchObject({fromVersion:2,toVersion:4,state:'ready'});
  runtime=await createRuntimeBackend(workspace,path.resolve('dist/application/writer.cjs'));const restarted=await runtime.connectHuman();expect(await runtime.materials.read(restarted,raw.id)).toEqual(raw);
  expect((JSON.parse(await readFile(path.join(workspace,'managed-copies.json'),'utf8')) as {copies:unknown[]}).copies).toHaveLength(copies.copies.length);
 }finally{await runtime?.close();await rm(root,{recursive:true,force:true});await rm(buildRoot,{recursive:true,force:true});}
},30000);

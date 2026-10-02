import { it,expect } from 'vitest';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRuntimeBackend } from '../../packages/backend/bootstrap/runtime';
import { Result as WikiResult } from '../../packages/contracts/wiki/schema';
import { Result as EmploymentResult } from '../../packages/contracts/employment/schema';
it('the one writer connects true Materials provenance and rejects retired sessions across domains',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-g2-runtime-'));const filename=path.join(root,'source.txt');await writeFile(filename,'独立原件，不是已核实事实');
 const start=()=>createRuntimeBackend(path.join(root,'workspace'),path.resolve('dist/application/writer.cjs'));
 let runtime=await start();
 try{
  let session=await runtime.materials.connectHuman();
  const preview=await runtime.materials.selectFile(session,filename);
  const receipt=await runtime.materials.confirm(session,{commandId:crypto.randomUUID(),importId:preview.importId,expectedRevision:1,digest:preview.digest});
  if(receipt.status!=='committed')throw Error('not committed');
  const create={operation:'create',commandId:crypto.randomUUID(),title:'工作经验',body:'自己的知识表达',scope:'personal',nature:'fact_statement',sources:[{ref:receipt.source,purpose:'原始依据'}]};
  const saved=WikiResult.parse(await runtime.business(session,'wiki',create));expect(saved.kind).toBe('knowledge');if(saved.kind!=='knowledge')throw Error('no knowledge');
  expect(saved.knowledge.verification).toBe('not_verified');
  expect((await runtime.materials.read(session,receipt.materialId)).text).toBe('独立原件，不是已核实事实');
  const employment=EmploymentResult.parse(await runtime.business(session,'employment',{operation:'create',commandId:crypto.randomUUID(),company:'测试工作场所',role:'开发',goal:'真实工作',started:true,start:{kind:'unknown'},plannedEnd:{kind:'date',date:'2030-01-01'}}));expect(employment.kind).toBe('employment');
  const old=session;session=await runtime.materials.connectHuman();
  await expect(runtime.business(old,'wiki',{operation:'list'})).rejects.toThrow('invalid_capability');
  await expect(runtime.business({...session,actor:{kind:'human',token:crypto.randomUUID()}},'employment',{operation:'list'})).rejects.toThrow('invalid_capability');
  await runtime.close();runtime=await start();session=await runtime.materials.connectHuman();
  expect(WikiResult.parse(await runtime.business(session,'wiki',{operation:'read',id:saved.knowledge.id}))).toEqual(saved);
  expect(await runtime.materials.collectGarbage()).toBe(0);
 }finally{await runtime.close();await rm(root,{recursive:true,force:true});}
});

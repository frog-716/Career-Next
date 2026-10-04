import {expect,it} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRuntimeBackend} from '../../packages/backend/bootstrap/runtime';
import {Result as DataResult} from '../../packages/contracts/application/schema';
import Database from 'better-sqlite3';

const origin={kind:'feishu' as const,identity:'user' as const,url:'https://test.feishu.cn/wiki/TESTwikiNode',wikiNodeId:'TESTwikiNode',documentId:'TESTdocumentId',revisionId:25};
const text='# TEST DATA\n\nFictional document, exactly as previewed.  \nNo real personal data.';
const options={automaticBackups:false,providerBinding:{enabled:false,generation:'disabled-for-local-import'}};

it('the formal Materials pipeline preserves cached Feishu identity/revision and exact bytes once across replay and reopening',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'career-j07-feishu-cache-'));
 let runtime=await createRuntimeBackend(path.join(root,'workspaces/local'),path.resolve('dist/application/writer.cjs'),root,options);
 try{
  let session=await runtime.connectHuman();const filename=path.join(root,'TEST-DATA.md');await writeFile(filename,text);
  const preview=await runtime.materials.selectFile(session,filename,{kind:'personal'},origin);
  expect(preview.origin).toEqual(origin);expect(preview.text).toBe(text);
  expect(await runtime.materials.list(session)).toEqual([]);
  const command={commandId:randomUUID(),importId:preview.importId,expectedRevision:1 as const,digest:preview.digest};
  const receipt=await runtime.materials.confirm(session,command);if(receipt.status!=='committed')throw Error('not saved');
  const raw=await runtime.materials.read(session,receipt.materialId);expect(raw).toMatchObject({origin,text,revision:1});
  expect(await runtime.materials.confirm(session,command)).toEqual(receipt);
  expect(await runtime.materials.list(session)).toHaveLength(1);
  const cancelled=await runtime.materials.selectFile(session,filename,{kind:'personal'},origin);
  await runtime.materials.cancel(session,cancelled.importId);
  await expect(runtime.materials.confirm(session,{commandId:randomUUID(),importId:cancelled.importId,expectedRevision:1,digest:cancelled.digest})).rejects.toThrow('invalid_capability');
  expect(await runtime.materials.list(session)).toHaveLength(1);
  await expect(runtime.materials.selectFile(session,filename,{kind:'personal'},{...origin,identity:'bot'} as never)).rejects.toThrow();
  expect(await runtime.materials.list(session)).toHaveLength(1);
  const backup=DataResult.parse(await runtime.business(session,'application',{operation:'data.backup'}));
  if(backup.kind!=='backup')throw Error('backup failed');
  const candidate=DataResult.parse(await runtime.business(session,'application',{operation:'data.restore.prepare',backupId:backup.copy.id}));
  if(candidate.kind!=='restore_candidate')throw Error('restore validation failed');
  const copied=new Database(path.join(root,candidate.copy.relativePath,'career.sqlite'),{readonly:true});
  try{expect(copied.prepare('SELECT origin_json FROM materials_raw WHERE id=?').get(receipt.materialId)).toEqual({origin_json:JSON.stringify(origin)});}finally{copied.close();}
  await runtime.close();runtime=await createRuntimeBackend(path.join(root,'workspaces/local'),path.resolve('dist/application/writer.cjs'),root,options);
  session=await runtime.connectHuman();expect(await runtime.materials.read(session,receipt.materialId)).toEqual(raw);
 }finally{await runtime.close();await rm(root,{recursive:true,force:true});}
},15000);

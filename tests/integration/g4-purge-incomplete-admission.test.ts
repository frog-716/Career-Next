import {expect,it} from 'vitest';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {openWorkspace} from '../../packages/backend/platform/database/database';
import {materialsMigration} from '../../packages/backend/domains/materials/migration';
import {releases} from '../../packages/backend/bootstrap/releases';
import {createWriterCommands} from '../../packages/backend/bootstrap/writer-commands';
import {Result as WikiResult} from '../../packages/contracts/wiki/schema';
import {Result as DataResult} from '../../packages/contracts/application/schema';

it('an incomplete real purge closes body reads and human writes until the original approved plan finishes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'g4-purge-admission-'));
 const workspace=await openWorkspace(root,materialsMigration,releases);
 let failDrain=true;
 try{
  const store=createWriterCommands(workspace.database,workspace.workspaceInstance,randomUUID(),{dataRoot:root,control:{
   maintenance:async work=>work(),beforeActivate:async()=>{},closeWorkspace:()=>{throw Error('not_requested');},
   drain:async()=>{if(failDrain)throw Error('sink_drain_failed');},
  }});
  const session=store.connect();
  const createCommandId=randomUUID();
  const saved=WikiResult.parse(await store.business(session,'wiki',{operation:'create',commandId:createCommandId,title:'清除对象',body:'SENSITIVE_INCOMPLETE_PURGE_BODY',scope:'personal',nature:'observation',sources:[]}));
  if(saved.kind!=='knowledge')throw Error('create_failed');
  const rawText='Independent confirmed Raw survives the selected Wiki purge';
  const digest=createHash('sha256').update(rawText).digest('hex'),importId=store.begin(session,'fixture.txt');
  store.preview(session,{importId,revision:1,name:'fixture.txt',digest,size:Buffer.byteLength(rawText),text:rawText,saved:false});
  const confirm={commandId:randomUUID(),importId,expectedRevision:1 as const,digest},prepared=store.prepare(session,confirm);
  if(prepared.kind!=='publish')throw Error('prepare_failed');
  await mkdir(path.join(root,'blobs'),{recursive:true});await writeFile(path.join(root,'blobs',prepared.blobId),rawText);
  store.published(session,confirm,prepared.blobId);const receipt=store.commit(session,confirm,prepared.blobId);
  if(receipt.status!=='committed')throw Error('commit_failed');
  const plan=DataResult.parse(await store.business(session,'application',{operation:'data.purge.plan',references:[{owner:'wiki',objectId:saved.knowledge.id}]}));
  if(plan.kind!=='purge_plan')throw Error('plan_failed');
  const original={operation:'data.purge.confirm' as const,planId:plan.plan.id,selectedCopyIds:plan.plan.copies.map(copy=>copy.id),confirmed:true};
  expect(await store.business(session,'application',original)).toEqual({kind:'failure',code:'purge_incomplete'});
  const state=DataResult.parse(await store.business(session,'application',{operation:'data.status'}));
  expect(state).toMatchObject({kind:'data_status',pendingPurgeCount:1});
  await expect(store.business(session,'wiki',{operation:'read',id:saved.knowledge.id})).rejects.toThrow('purge_incomplete');
  await expect(store.business(session,'wiki',{operation:'edit',commandId:randomUUID(),id:saved.knowledge.id,expectedRevision:1,title:'清除对象',body:'MUST_NOT_PERSIST',scope:'personal',nature:'observation',sources:[],change:'corrected',reason:'must reject',businessTime:{kind:'unknown'}})).rejects.toThrow('purge_incomplete');
  await expect(store.business(session,'ai',{operation:'ai.list'})).rejects.toThrow('purge_incomplete');
  expect(()=>store.read(session,receipt.materialId)).toThrow('purge_incomplete');
  expect(()=>store.list(session)).toThrow('purge_incomplete');
  expect(()=>store.receipt(session,confirm.commandId)).toThrow('purge_incomplete');
  expect(()=>store.begin(session,'must-not-start.txt')).toThrow('purge_incomplete');
  expect(()=>store.prepare(session,confirm)).toThrow('purge_incomplete');
  expect(await store.business(session,'application',{operation:'data.backup'})).toEqual({kind:'failure',code:'purge_incomplete'});
  expect(await store.business(session,'application',{...original,selectedCopyIds:[]})).toEqual({kind:'failure',code:'purge_scope_invalid'});
  failDrain=false;
  const completed=await store.business(session,'application',original);
  expect(completed).toMatchObject({kind:'purged',planId:plan.plan.id});
  expect(await store.business(session,'application',original)).toEqual(completed);
  expect(await store.business(session,'application',{operation:'data.status'})).toMatchObject({kind:'data_status',pendingPurgeCount:0});
  expect(await store.business(session,'wiki',{operation:'read',id:saved.knowledge.id})).toEqual({kind:'failure',code:'not_found'});
  expect(await store.business(session,'wiki',{operation:'receipt',commandId:createCommandId})).toEqual({kind:'failure',code:'content_purged'});
  const raw=store.read(session,receipt.materialId);expect(await readFile(path.join(root,'blobs',raw.blobId),'utf8')).toBe(rawText);
  expect(await store.list(session)).toHaveLength(1);
  expect(store.receipt(session,confirm.commandId)).toEqual(receipt);
  expect(await store.business(session,'wiki',{operation:'create',commandId:randomUUID(),title:'恢复维护后',body:'New human data',scope:'personal',nature:'observation',sources:[]})).toMatchObject({kind:'knowledge'});
  const control=await readFile(path.join(root,'purge-control',plan.plan.id+'.json'),'utf8');
  expect(control).not.toContain('SENSITIVE_INCOMPLETE_PURGE_BODY');expect(control).not.toContain('MUST_NOT_PERSIST');
 }finally{workspace.close();await rm(root,{recursive:true,force:true});}
});

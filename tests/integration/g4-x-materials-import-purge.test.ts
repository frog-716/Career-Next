import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtemp,writeFile,rm,open,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createMaterialsBackend} from '../../packages/backend/domains/materials/public';
import {createMaterialsStore,type Store} from '../../packages/backend/domains/materials/store';
import {materialsMigration} from '../../packages/backend/domains/materials/migration';
import {ledgerMigration,artifactMigration} from '../../packages/backend/platform/database/ledger';
import {createBlobBroker} from '../../packages/backend/platform/files/blobs';
import type {ProductionSinkAdapter} from '../../packages/backend/platform/files/staging';

async function fixture(makeBlobs?:Parameters<typeof createMaterialsBackend>[1],sinkFor?:Parameters<typeof createMaterialsBackend>[4],upgraded=true){
 const root=await mkdtemp(path.join(tmpdir(),'career-g4-import-purge-')),workspace=path.join(root,'workspace');
 const db=new Database(path.join(root,'candidate.sqlite'));db.pragma('foreign_keys=ON');
 db.exec("CREATE TABLE platform_blobs(id TEXT PRIMARY KEY,digest TEXT NOT NULL,size INTEGER NOT NULL,state TEXT NOT NULL);"+ledgerMigration+(upgraded?artifactMigration:'')+materialsMigration);
 const store=createMaterialsStore(db,randomUUID(),randomUUID());
 const writer={async call<K extends keyof Store>(method:K,...args:Parameters<Store[K]>):Promise<Awaited<ReturnType<Store[K]>>>{return await (store[method] as (...input:Parameters<Store[K]>)=>ReturnType<Store[K]>)(...args) as Awaited<ReturnType<Store[K]>>;},async close(){db.close();}};
 const backend=await createMaterialsBackend(workspace,makeBlobs,undefined,writer,sinkFor);
 const filename=path.join(root,'真实原件.txt');await writeFile(filename,'原文正文，仅托管副本可清除');
 return {root,workspace,filename,db,store,backend,async close(){await backend.close();await rm(root,{recursive:true,force:true});}};
}

it('clearing a real in-flight file selection drains late writes and removes only the managed candidate',async()=>{
 let release!:()=>void,reached!:()=>void;const pause=new Promise<void>(resolve=>{release=resolve;}),arrived=new Promise<void>(resolve=>{reached=resolve;});
 const adapter:ProductionSinkAdapter={withLease:work=>work(),async controlledSink(filename){const handle=await open(filename,'wx',0o600);return {async append(bytes){reached();await pause;await handle.writeFile(bytes);},async close(){await handle.close();}};}};
 const f=await fixture(undefined,async()=>adapter);
 try{const session=await f.backend.connectHuman(),selecting=f.backend.selectFile(session,f.filename);await arrived;const pending=await f.backend.pendingImports();expect(pending).toHaveLength(1);expect(Object.keys(pending[0]).sort()).toEqual(['id','name','revision']);const id=pending[0].id;expect((await f.backend.importPurgeImpact(id))?.producerIds).toEqual([id]);let drained=false;const clearing=f.backend.purgeImport(id).then(()=>{drained=true;});await Promise.resolve();expect(drained).toBe(false);release();await expect(selecting).rejects.toThrow();await clearing;expect(await f.backend.pendingImports()).toEqual([]);expect(await f.backend.stagingCount()).toBe(0);expect(await readdir(path.join(f.workspace,'blobs'))).toEqual([]);await expect(f.backend.purgeImport(id)).resolves.toBeUndefined();expect(await f.backend.list(session)).toEqual([]);const {readFile}=await import('node:fs/promises');expect(await readFile(f.filename,'utf8')).toBe('原文正文，仅托管副本可清除');}
 finally{release();await f.close();}
});

it.each([false,true])('pending published hold is cleared body-free and cannot commit/replay (upgraded ledger: %s)',async(upgraded)=>{
 let release!:()=>void,reached!:()=>void;const pause=new Promise<void>(resolve=>{release=resolve;}),arrived=new Promise<void>(resolve=>{reached=resolve;});
 const f=await fixture((root,max)=>{const real=createBlobBroker(root,max);return {...real,async publish(...args){await real.publish(...args);reached();await pause;}};},undefined,upgraded);
 try{const session=await f.backend.connectHuman(),preview=await f.backend.selectFile(session,f.filename);const input={commandId:randomUUID(),importId:preview.importId,expectedRevision:1 as const,digest:preview.digest};const saving=f.backend.confirm(session,input);await arrived;const impact=await f.backend.importPurgeImpact(preview.importId);expect(impact?.blobIds).toHaveLength(1);expect(impact?.holdIds).toEqual(impact?.blobIds);expect(impact?.commandIds).toEqual([input.commandId]);const clearing=f.backend.purgeImport(preview.importId);release();await clearing;expect(await saving).toEqual({status:'failed',commandId:input.commandId,code:'invalid_capability'});expect(await f.backend.confirm(session,input)).toEqual(await saving);expect(await f.backend.pendingImports()).toEqual([]);expect(await f.backend.list(session)).toEqual([]);expect(await readdir(path.join(f.workspace,'blobs'))).toEqual([]);expect(await f.backend.stagingCount()).toBe(0);expect(f.db.prepare(`SELECT status,error FROM ${upgraded?'platform_artifact_receipts':'platform_receipts'} WHERE command_id=?`).get(input.commandId)).toEqual({status:'failed',error:'invalid_capability'});}
 finally{release();await f.close();}
});

it('clearing a separate preview with identical bytes preserves confirmed independent Raw and committed receipt',async()=>{
 const f=await fixture();try{const session=await f.backend.connectHuman(),first=await f.backend.selectFile(session,f.filename);const command={commandId:randomUUID(),importId:first.importId,expectedRevision:1 as const,digest:first.digest};const receipt=await f.backend.confirm(session,command);if(receipt.status!=='committed')throw Error();const second=await f.backend.selectFile(session,f.filename);expect(second.digest).toBe(first.digest);expect(await f.backend.importPurgeImpact(first.importId)).toBeUndefined();await f.backend.purgeImport(second.importId);await f.backend.purgeImport(first.importId);expect((await f.backend.read(session,receipt.materialId)).text).toBe('原文正文，仅托管副本可清除');expect(await f.backend.confirm(session,command)).toEqual(receipt);expect(await f.backend.receipt(session,command.commandId)).toEqual(receipt);expect(await f.backend.pendingImports()).toEqual([]);expect(await f.backend.stagingCount()).toBe(0);}
 finally{await f.close();}
});

import {it,expect} from 'vitest';import Database from 'better-sqlite3';import {mkdtemp,writeFile,rm}from'node:fs/promises';import path from'node:path';import os from'node:os';import{randomUUID}from'node:crypto';import{createRuntimeBackend}from'../../packages/backend/bootstrap/runtime';import{Result as AiResult}from'../../packages/contracts/ai/schema';
it('real DB busy cannot delay stop dispatch gate; original command receipt persists after writer unlock',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'career-g6-control-')),active=path.join(root,'workspaces/local'),source=path.join(root,'controlled.txt');await writeFile(source,'Controlled stop input');const runtime=await createRuntimeBackend(active,path.resolve('dist/application/writer.cjs'),root);let blocker:Database.Database|undefined;
 try{const session=await runtime.connectHuman(),preview=await runtime.materials.selectFile(session,source),imported=await runtime.materials.confirm(session,{commandId:randomUUID(),importId:preview.importId,expectedRevision:1,digest:preview.digest});if(imported.status!=='committed')throw Error();
 const prepared=AiResult.parse(await runtime.business(session,'ai',{operation:'ai.prepare',commandId:randomUUID(),sources:[imported.source],target:{scope:'personal'},budget:{requests:2,inputBytes:524288,outputBytes:196608}}));if(prepared.kind!=='task')throw Error();
 blocker=new Database(path.join(active,'career.sqlite'));blocker.exec('BEGIN IMMEDIATE');
 const commandId=randomUUID(),stop=runtime.business(session,'ai',{operation:'ai.stop',commandId,taskId:prepared.task.id,mode:'stop'});const began=performance.now();
 const outcome=await Promise.race([stop.then(result=>({result})),new Promise<{timeout:true}>(resolve=>setTimeout(()=>resolve({timeout:true}),200))]);
 const gateElapsedMs=performance.now()-began;await stop;await new Promise(resolve=>setTimeout(resolve,100));const beforeUnlock=AiResult.parse(await runtime.business(session,'ai',{operation:'ai.receipt',commandId}));
 blocker.exec('ROLLBACK');blocker.close();blocker=undefined;
 expect(outcome).not.toHaveProperty('timeout');if(!('result'in outcome))throw Error('blocked control');
 expect(AiResult.parse(outcome.result)).toEqual({kind:'execution_blocked',taskId:prepared.task.id,commandId,mode:'stop',dispatchBlocked:true,persistencePending:true});
 const elapsedMs=gateElapsedMs;expect(elapsedMs).toBeLessThan(500);
 // SQLITE_BUSY may leave no durable receipt: only explicit continuation of this same intent is allowed.
 expect(beforeUnlock.kind).toBe('receipt_missing');
 await runtime.business(session,'ai',{operation:'ai.stop',commandId,taskId:prepared.task.id,mode:'stop'});
 await expect.poll(async()=>AiResult.parse(await runtime.business(session,'ai',{operation:'ai.receipt',commandId})),{timeout:5000}).toMatchObject({kind:'receipt',receipt:{kind:'task',task:{state:'stopped'}}});
 const state=AiResult.parse(await runtime.business(session,'ai',{operation:'ai.read',taskId:prepared.task.id}));expect(state).toMatchObject({kind:'task',task:{operations:[{authorized:false,state:'not_sent'}]}});
 await writeFile('/tmp/career-g6/control-observations.json',JSON.stringify({actualSqliteWriteLock:true,elapsedMs,commandId,dispatchBlocked:true,receiptConverged:true},null,2));
 }finally{if(blocker){blocker.exec('ROLLBACK');blocker.close();}await runtime.close();await rm(root,{recursive:true,force:true});}
},15000);

it('private production configuration disables dispatch and binds a fresh preview to the new fake generation without moving credential bytes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'career-g6-binding-')),runtime=await createRuntimeBackend(path.join(root,'workspaces/local'),path.resolve('dist/application/writer.cjs'),root);
 try{const session=await runtime.connectHuman(),call=(input:unknown)=>runtime.business(session,'ai',input),company=await runtime.business(session,'opportunity',{operation:'company.create',commandId:randomUUID(),name:'Generation fixture'}) as any;
 const prepare=()=>call({operation:'product.prepare',commandId:randomUUID(),input:{target:{kind:'research-organize',owner:{kind:'company',id:company.company.id}},sources:[],egressSourceIds:[],wikiIds:[],egressWikiIds:[],objects:[]},budget:{requests:2,inputBytes:524288,outputBytes:196608}}) as Promise<any>;
 const a=await prepare(),op=a.task.operations[0];runtime.configureProvider({enabled:false,generation:'fake-v1'});expect(await call({operation:'product.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest})).toMatchObject({kind:'failure',code:'provider_disabled'});expect(await prepare()).toMatchObject({kind:'failure',code:'provider_disabled'});
 const generation=randomUUID();runtime.configureProvider({enabled:true,generation});const b=await prepare();expect(b.task.operations[0].recipient.generation).toBe(generation);expect(await call({operation:'product.authorize',commandId:randomUUID(),operationId:op.id,manifestDigest:op.manifestDigest})).toMatchObject({kind:'failure',code:'provider_binding_changed'});const fresh=b.task.operations[0];await call({operation:'product.authorize',commandId:randomUUID(),operationId:fresh.id,manifestDigest:fresh.manifestDigest});await expect.poll(async()=>{const value=await call({operation:'product.read',taskId:b.task.id}) as any;return value.task.proposals.length;}).toBe(2);expect((await call({operation:'product.read',taskId:a.task.id}) as any).task.proposals).toEqual([]);
 }finally{await runtime.close();await rm(root,{recursive:true,force:true});}
},15000);

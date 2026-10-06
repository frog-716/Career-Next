import path from 'node:path';import {randomUUID} from 'node:crypto';import {z} from 'zod';import {createBrowserHost} from '../browser/server';import {createManagedCopies} from '../../../packages/backend/platform/backup/managed-copies';import {createRuntimeBackend} from '../../../packages/backend/bootstrap/runtime';import {Result as DataResult} from '../../../packages/contracts/application/schema';import type {NodeHostOptions} from './host';
/** No business writer opens until the user explicitly chooses a verified backup. */
export async function createRecoveryHost(options:NodeHostOptions&{reopen():Promise<void>}){
 const identity={protocolVersion:1 as const,workspaceInstance:randomUUID(),backendGeneration:randomUUID(),connectionGeneration:randomUUID()};let runtime:Awaited<ReturnType<typeof createRuntimeBackend>>|undefined,session:Awaited<ReturnType<NonNullable<typeof runtime>['connectHuman']>>|undefined,closed=false,busy=false,activated=false;
 const copies=createManagedCopies(options.profile);
 const handlers={
  ready:async(_:unknown,context:import('../browser/server').BrowserContext)=>{context.bind(identity.workspaceInstance);return identity;},
  reconnect:async(_:unknown,context:import('../browser/server').BrowserContext)=>{context.bind(identity.workspaceInstance);return identity;},
  'recovery/list':async()=>({items:copies.list().filter(copy=>copy.kind==='backup'&&copy.state==='ready').map(copy=>({id:copy.id,createdAt:copy.createdAt}))}),
  'recovery/prepare':async(input:unknown)=>{if(busy||activated||closed)throw Error('invalid_request');const {backupId}=z.strictObject({backupId:z.uuid()}).parse(input);if(!copies.list().some(copy=>copy.id===backupId&&copy.kind==='backup'&&copy.state==='ready'))throw Error('invalid_request');busy=true;try{await runtime?.close();runtime=await createRuntimeBackend(path.join(options.profile,'recovery',randomUUID()),path.join(options.artifacts,'writer.cjs'),options.profile,{automaticBackups:false,providerBinding:{enabled:false,generation:'fake-v1'}});session=await runtime.connectHuman();return DataResult.parse(await runtime.business(session,'application',{operation:'data.restore.prepare',backupId}));}finally{busy=false;}},
  'recovery/activate':async(input:unknown)=>{if(busy||activated||!runtime||!session||closed)throw Error('invalid_request');const request=z.strictObject({candidateId:z.uuid(),confirmed:z.literal(true)}).parse(input);busy=true;try{const result=DataResult.parse(await runtime.business(session,'application',{operation:'data.restore.activate',...request}));activated=result.kind==='restored';return result;}finally{busy=false;}},
  'recovery/restart':async()=>{if(!activated||closed)throw Error('invalid_request');setTimeout(()=>void options.reopen().catch(()=>{}),250);return {restarting:true};},
 };
 const browser=await createBrowserHost({root:path.join(options.artifacts,'../recovery-renderer'),port:options.port??0,identity:()=>identity,handlers});
 return {...browser,handlers,identity:()=>identity,async close(){if(closed)return;closed=true;await browser.close();await runtime?.close();}};
}

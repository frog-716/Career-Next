import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {open,type FileHandle} from 'node:fs/promises';
import {z} from 'zod';
export const persistenceMigration=`CREATE TABLE platform_purge_fences(owner TEXT NOT NULL,object_id TEXT NOT NULL,generation INTEGER NOT NULL DEFAULT 0,purged INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(owner,object_id));`;
export interface PersistenceReference {owner:string;objectId:string;revision?:number}
const Ref=z.strictObject({owner:z.string().min(1).max(80),objectId:z.string().min(1).max(160),revision:z.number().int().positive().optional(),generation:z.number().int().nonnegative()});
export const PersistenceTokenSchema=z.strictObject({id:z.uuid(),producerId:z.string().min(1).max(160),workspaceInstance:z.string().min(1),backendGeneration:z.string().min(1),inputs:z.array(Ref).max(1000),targets:z.array(Ref).max(1000)});
export type PersistenceToken=z.infer<typeof PersistenceTokenSchema>;
export interface CaptureInput {producerId:string;inputs:readonly PersistenceReference[];targets:readonly PersistenceReference[]}
const touches=(token:PersistenceToken,refs:readonly PersistenceReference[])=>[...token.inputs,...token.targets].some(r=>refs.some(v=>v.owner===r.owner&&v.objectId===r.objectId));
export function createPersistenceFence(db:Database.Database,binding:{workspaceInstance:string;backendGeneration:string}) {
 const revoked=new Set<string>();
 const read=(ref:PersistenceReference)=>db.prepare('SELECT generation,purged FROM platform_purge_fences WHERE owner=? AND object_id=?').get(ref.owner,ref.objectId) as {generation:number;purged:number}|undefined;
 function assert(value:PersistenceToken) {const token=PersistenceTokenSchema.parse(value);if(token.workspaceInstance!==binding.workspaceInstance||token.backendGeneration!==binding.backendGeneration||revoked.has(token.producerId))throw Error('persistence_denied');for(const ref of [...token.inputs,...token.targets]){const state=read(ref);if(state?.purged||(state?.generation??0)!==ref.generation)throw Error('persistence_denied');}}
 const sinks=createPersistenceSinkGate(assert);
 return {capture(input:CaptureInput):PersistenceToken {const capture=(ref:PersistenceReference)=>{const state=read(ref);if(state?.purged)throw Error('persistence_denied');return {...ref,generation:state?.generation??0};};const token=PersistenceTokenSchema.parse({id:randomUUID(),...binding,producerId:input.producerId,inputs:input.inputs.map(capture),targets:input.targets.map(capture)});assert(token);return token;},assert,
 markPurge(refs:readonly PersistenceReference[]){if(!db.inTransaction)throw Error('transaction_required');for(const r of refs)db.prepare('INSERT INTO platform_purge_fences(owner,object_id,generation,purged) VALUES (?,?,1,1) ON CONFLICT(owner,object_id) DO UPDATE SET generation=generation+1,purged=1').run(r.owner,r.objectId);},
 revoke(producerId:string){revoked.add(producerId);sinks.revoke(producerId);},
 drain:sinks.drain,controlledSink:sinks.controlledSink,withLease:sinks.withLease};
}
/** Utility-side gate accepts a bounded writer RPC assertion. No DB handle crosses workers. */
export function createPersistenceSinkGate(check:(token:PersistenceToken)=>void|Promise<void>) {
 type SinkState={token:PersistenceToken;tail:Promise<void>;closed:boolean;handle?:FileHandle;closing?:Promise<void>};const active=new Set<SinkState>(),revoked=new Set<string>();
 const denied=(state:SinkState)=>state.closed||revoked.has(state.token.producerId);
 function closeState(state:SinkState){state.closed=true;if(!state.closing)state.closing=(async()=>{await state.tail;const handle=state.handle;state.handle=undefined;try{if(handle){try{await handle.sync();}finally{await handle.close();}}}finally{active.delete(state);}})();return state.closing;}
 async function controlledSink(token:PersistenceToken,internalPath:string){PersistenceTokenSchema.parse(token);await check(token);if(revoked.has(token.producerId))throw Error('persistence_denied');const state:SinkState={token,tail:Promise.resolve(),closed:false};active.add(state);
 try{state.handle=await open(internalPath,'wx',0o600);await check(token);}catch(error){state.closed=true;await state.handle?.close();active.delete(state);throw error;}
 async function close(){await closeState(state);}
 return {append(bytes:Uint8Array){if(bytes.byteLength>65536)return Promise.reject(Error('sink_chunk_exceeded'));const copy=Buffer.from(bytes);const operation=state.tail.then(async()=>{if(denied(state))throw Error('persistence_denied');await check(token);if(denied(state))throw Error('persistence_denied');await state.handle!.write(copy);await state.handle!.sync();});state.tail=operation.catch(()=>{});return operation;},close};}
 async function withLease<T>(token:PersistenceToken,work:()=>Promise<T>):Promise<T>{PersistenceTokenSchema.parse(token);const state:SinkState={token,tail:Promise.resolve(),closed:false};active.add(state);let finish!:()=>void;state.tail=new Promise<void>(resolve=>{finish=resolve;});try{await check(token);if(denied(state))throw Error('persistence_denied');return await work();}finally{state.closed=true;finish();active.delete(state);}}
 return {controlledSink,withLease,revoke(producerId:string){revoked.add(producerId);for(const s of active)if(s.token.producerId===producerId)s.closed=true;},async drain(refs:readonly PersistenceReference[]){const targets=[...active].filter(s=>touches(s.token,refs));for(const s of targets)s.closed=true;await Promise.all(targets.map(closeState));}};
}
export type PersistenceFence=ReturnType<typeof createPersistenceFence>;

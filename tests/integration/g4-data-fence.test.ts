import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {createPersistenceFence,persistenceMigration} from '../../packages/backend/platform/persistence/fence';
it('purge rejects all actual-input producers and closes an already open bounded sink while unrelated inputs remain usable',async()=>{
 const db=new Database(':memory:');db.exec(persistenceMigration);const root=await mkdtemp(path.join(os.tmpdir(),'g4-fence-'));
 try {const f=createPersistenceFence(db,{workspaceInstance:'w',backendGeneration:'b'}),A={owner:'materials',objectId:'A'},B={owner:'materials',objectId:'B'};
 const leases=['ai','parser','import','pdf'].map(producerId=>f.capture({producerId,inputs:[A],targets:[]}));const independent=f.capture({producerId:'other',inputs:[B],targets:[]});
 const sink=await f.controlledSink(leases[0],path.join(root,'partial'));await sink.append(Buffer.from('before'));
 db.transaction(()=>f.markPurge([A]))();await f.drain([A]);
 for(const token of leases)expect(()=>f.assert(token)).toThrow('persistence_denied');
 await expect(sink.append(Buffer.from('late sensitive body'))).rejects.toThrow('persistence_denied');
 expect((await readFile(path.join(root,'partial'))).toString()).toBe('before');expect(()=>f.assert(independent)).not.toThrow();
 expect(()=>f.capture({producerId:'new',inputs:[A],targets:[]})).toThrow('persistence_denied');
 const restarted=createPersistenceFence(db,{workspaceInstance:'w',backendGeneration:'b2'});expect(()=>restarted.assert(independent)).toThrow('persistence_denied');
 } finally {db.close();await rm(root,{recursive:true,force:true});}
});
it('drain waits for the leased chunk to finish before deletion, rejects new write leases and forbids an unbounded sink chunk',async()=>{
 const db=new Database(':memory:');db.exec(persistenceMigration);const root=await mkdtemp(path.join(os.tmpdir(),'g4-fence-chunk-'));try{const f=createPersistenceFence(db,{workspaceInstance:'w',backendGeneration:'b'}),A={owner:'materials',objectId:'A'},token=f.capture({producerId:'pdf',inputs:[A],targets:[]});const sink=await f.controlledSink(token,path.join(root,'chunk'));await expect(sink.append(Buffer.alloc(65537))).rejects.toThrow('sink_chunk_exceeded');let release!:()=>void;let entered!:()=>void;const started=new Promise<void>(resolve=>entered=resolve),pending=f.withLease(token,async()=>{entered();await new Promise<void>(resolve=>release=resolve);});await started;db.transaction(()=>f.markPurge([A]))();let drained=false;const done=f.drain([A]).then(()=>{drained=true;});await Promise.resolve();expect(drained).toBe(false);await expect(f.withLease(token,async()=>{})).rejects.toThrow('persistence_denied');release();await pending;await done;expect(drained).toBe(true);}finally{db.close();await rm(root,{recursive:true,force:true});}
});

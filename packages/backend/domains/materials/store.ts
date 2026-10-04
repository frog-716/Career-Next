import {createImportTargets} from './targets';
import type {ImportTarget} from '../../../contracts/materials/schema';
import { Kysely, SqliteDialect } from 'kysely';
import type Database from 'better-sqlite3';
import { randomUUID, createHash } from 'node:crypto';
import { Receipt, ErrorCode, FeishuOrigin } from '../../../contracts/materials/schema';
import type { Identity, Preview, RawSummary, Confirm, SourceRef } from '../../../contracts/materials/schema';
import { createLedger } from '../../platform/database/ledger';
import { createSessions, type SessionAuthority } from '../../platform/runtime/sessions';
import type { HumanSession } from '../../platform/runtime/sessions';
export type { HumanSession } from '../../platform/runtime/sessions';
export type ImportRow = { id: string; generation: string; connection: string; validity: number; state: string; name: string; digest: string; size: number; revision: 1; origin_json?:string|null };
export function createMaterialsStore(db: Database.Database, workspaceInstance: string, backendGeneration: string, authority: SessionAuthority = createSessions(workspaceInstance, backendGeneration)) {
  const query = new Kysely<{ materials_raw: RawRow }>({dialect:new SqliteDialect({database:db})});
  const ledger = createLedger(db),targets=createImportTargets(db);
  const originAvailable=(db.prepare('PRAGMA table_info(materials_imports)').all() as {name:string}[]).some(column=>column.name==='origin_json');
  const forgetOrigin=originAvailable?',origin_json=NULL':'';
  const summary=(row:RawRow)=>summarize(row,targets.read(row.id));
  const matches=(input:SourceRef)=>{const current=sourceRef(input.objectId);return current.scope===input.scope&&current.scopeId===input.scopeId;};
  const sourceRef=(id:string):SourceRef=>{const target=targets.read(id);return {owner:'materials',objectId:id,revision:1,locator:'whole',scope:target.kind,...target.kind!=='personal'?{scopeId:target.id}:{}};};

  function receipt(commandId: string, payloadDigest?: string): Receipt {
    const row = ledger.receipt(commandId, payloadDigest);
    if (!row) return {status:'not_found',commandId};
    if (row.status === 'committed') return {status:'committed',commandId,materialId:row.material_id,source:sourceRef(row.material_id)};
    if (row.status === 'failed') return {status:'failed',commandId,code:ErrorCode.parse(row.error)};
    return {status:'pending',commandId};
  }
  const check = authority.check;
  function valid(session: HumanSession, id: string) {
    check(session);
    const row = db.prepare('SELECT * FROM materials_imports WHERE id=?').get(id) as ImportRow | undefined;
    if (!row || row.generation !== backendGeneration || row.connection !== session.connectionGeneration || row.validity !== 1 || !['preparing','preview'].includes(row.state)) throw new Error('invalid_capability');
    return row;
  }
  return {
    ownedBy(owner:string,id:string){return (db.prepare('SELECT id FROM materials_raw').all() as {id:string}[]).filter(row=>{const target=targets.read(row.id);return target.kind===owner&&'id'in target&&target.id===id;}).map(row=>row.id);},
    pendingImports(){return db.prepare("SELECT id,name,revision FROM materials_imports WHERE state IN ('preparing','preview') ORDER BY id").all() as {id:string;name:string;revision:1}[];},
    importPurgeImpact(id:string){
      const row=db.prepare('SELECT * FROM materials_imports WHERE id=?').get(id) as ImportRow|undefined;
      if(!row||row.state==='consumed')return undefined;
      const payload=createHash('sha256').update(JSON.stringify([id,row.revision,row.digest])).digest('hex');
      const held=ledger.describeOperation('materials.confirm',payload).filter(value=>value.status==='pending');
      const blobIds=held.flatMap(value=>value.blobId?[value.blobId]:[]);
      return {id,revision:row.revision,name:row.name,producerIds:[id],commandIds:held.map(value=>value.commandId),holdIds:blobIds,blobIds,retentions:[]};
    },
    purgeImport(id:string){
      db.transaction(()=>{
        const row=db.prepare('SELECT * FROM materials_imports WHERE id=?').get(id) as ImportRow|undefined;
        if(!row||row.state==='consumed')return;
        const payload=createHash('sha256').update(JSON.stringify([id,row.revision,row.digest])).digest('hex');
        ledger.purgeOperation('materials.confirm',payload);
        // Missing capability blocks late preview/publish/commit and contains no residual import name.
        db.prepare('DELETE FROM materials_imports WHERE id=?').run(id);targets.purge(id,'import');
      })();
    },
    purgeImpact(id:string){const row=db.prepare('SELECT * FROM materials_raw WHERE id=?').get(id) as RawRow|undefined;return row?{id,revision:1,name:row.name,blobIds:[row.blob_id],retentions:[{owner:'materials',objectId:id}]}:undefined;},
    purge(id:string){const row=db.prepare('SELECT digest FROM materials_raw WHERE id=?').get(id) as {digest:string}|undefined;if(row)db.prepare("UPDATE materials_imports SET name='cleared',digest='',size=0,validity=validity+1,state='revoked'"+forgetOrigin+" WHERE digest=?").run(row.digest);db.prepare('DELETE FROM materials_raw WHERE id=?').run(id);targets.purge(id);},
    connect(): HumanSession {
      db.prepare("UPDATE materials_imports SET state='revoked',validity=validity+1"+forgetOrigin+" WHERE state IN ('preparing','preview')").run();
      return authority.connect();
    },
    begin(session: HumanSession, name: string,target?:ImportTarget,origin?:FeishuOrigin) {
      check(session);if(origin&&!originAvailable)throw Error('invalid_capability');const value=origin?FeishuOrigin.parse(origin):undefined,id=randomUUID();
      return db.transaction(()=>{db.prepare('INSERT INTO materials_imports(id,generation,connection,state,name) VALUES (?,?,?,\'preparing\',?)').run(id,backendGeneration,session.connectionGeneration,name);targets.begin(id,target);if(value)db.prepare('UPDATE materials_imports SET origin_json=? WHERE id=?').run(JSON.stringify(value),id);return id;})();
    },
    valid,
    preview(session: HumanSession, input: Preview) {
      const row=valid(session,input.importId),origin=row.origin_json?FeishuOrigin.parse(JSON.parse(row.origin_json)):undefined;
      if(JSON.stringify(input.origin?FeishuOrigin.parse(input.origin):null)!==JSON.stringify(origin??null))throw Error('conflict');
      db.prepare("UPDATE materials_imports SET state='preview',digest=?,size=? WHERE id=?").run(input.digest, input.size, input.importId);
      return input;
    },
    cancel(session: HumanSession, id: string) {
      valid(session, id); db.prepare("UPDATE materials_imports SET state='revoked',validity=validity+1"+forgetOrigin+" WHERE id=?").run(id);
    },
    async list(session: HumanSession): Promise<RawSummary[]> {
      check(session);
      const rows = await query.selectFrom('materials_raw').selectAll().orderBy('recorded_at').orderBy('id').execute();
      return rows.map(summary);
    },
    read(session: HumanSession, id: string) {
      check(session); const row = db.prepare('SELECT * FROM materials_raw WHERE id=?').get(id) as RawRow | undefined;
      if (!row) throw new Error('not_found');
      return { ...summary(row), digest: row.digest, blobId: row.blob_id };
    },
    resolveSourceMetadata(input: SourceRef) {
      if (input.owner !== 'materials' || input.revision !== 1 || input.locator !== 'whole'||!matches(input)) return undefined;
      const row=db.prepare('SELECT * FROM materials_raw WHERE id=?').get(input.objectId) as RawRow | undefined;
      return row ? summary(row) : undefined;
    },
    resolveSourceArtifact(input: SourceRef) {
      if(input.owner!=='materials'||input.revision!==1||input.locator!=='whole'||JSON.stringify(sourceRef(input.objectId))!==JSON.stringify(input))return undefined;
      const row=db.prepare('SELECT * FROM materials_raw WHERE id=?').get(input.objectId) as RawRow|undefined;
      return row?{...summary(row),digest:row.digest,blobId:row.blob_id}:undefined;
    },
    receipt(session: HumanSession, commandId: string) { check(session); return receipt(commandId); },
    prepare(session: HumanSession, input: Confirm) {
      check(session);
      const payload = createHash('sha256').update(JSON.stringify([input.importId,input.expectedRevision,input.digest])).digest('hex');
      const prior = receipt(input.commandId,payload);
      if (prior.status !== 'not_found') return { kind: 'receipt' as const, receipt: prior };
      const row = valid(session,input.importId);
      if (row.state !== 'preview' || row.revision !== input.expectedRevision || row.digest !== input.digest) throw new Error('conflict');
      const blobId = randomUUID();
      db.transaction(() => { valid(session,input.importId); ledger.hold(input.commandId,payload,blobId,row.digest,row.size,backendGeneration); })();
      return { kind: 'publish' as const, blobId, digest: row.digest, size: row.size };
    },
    published(session: HumanSession, input: Confirm, blobId: string) {
      db.transaction(() => { valid(session,input.importId); ledger.published(blobId,input.commandId); })();
    },
    commit(session: HumanSession, input: Confirm, blobId: string) {
      return db.transaction(() => {
        const row = valid(session,input.importId);
        if (row.digest !== input.digest || row.revision !== input.expectedRevision) throw new Error('conflict');
        ledger.verifyHold(blobId,input.commandId,backendGeneration);
        const id = randomUUID();
        db.prepare("INSERT INTO materials_raw(id,name,size,digest,blob_id,revision,scope,lifecycle,recorded_at) VALUES (?,?,?,?,?,1,?,'evidence-original',?)").run(id,row.name,row.size,row.digest,blobId,targets.read(input.importId,'import').kind,new Date().toISOString());targets.commit(input.importId,id);
        if(row.origin_json)db.prepare('UPDATE materials_raw SET origin_json=? WHERE id=?').run(JSON.stringify(FeishuOrigin.parse(JSON.parse(row.origin_json))),id);
        ledger.retain(blobId,id,input.commandId);
        db.prepare("UPDATE materials_imports SET state='consumed'"+forgetOrigin+" WHERE id=?").run(input.importId);
        return receipt(input.commandId);
      })();
    },
    fail(commandId: string, code: import('../../../contracts/materials/schema').ErrorCode) { db.transaction(() => ledger.fail(commandId,code))(); },
    claimGarbage() { return db.transaction(() => ledger.claim())(); },
    deleted(id: string) { ledger.deleted(id); },
    recover() {
      db.transaction(() => ledger.recover(backendGeneration))();
      const rows = db.prepare("SELECT id FROM materials_imports WHERE state IN ('preparing','preview')").all() as { id: string }[];
      db.prepare("UPDATE materials_imports SET state='revoked',validity=validity+1"+forgetOrigin+" WHERE state IN ('preparing','preview')").run();
      return rows.map(row => row.id);
    },
  };
}
export type Store = ReturnType<typeof createMaterialsStore>;
export type Call = { [K in keyof Store]: { method: K; args: Parameters<Store[K]> } }[keyof Store];

type RawRow = { id: string; name: string; size: number; digest: string; blob_id: string; recorded_at: string; origin_json?:string|null };
function summarize(row: RawRow,target:ImportTarget): RawSummary {
 const source:SourceRef={owner:'materials',objectId:row.id,revision:1,locator:'whole',scope:target.kind,...target.kind!=='personal'?{scopeId:target.id}:{}};return {id:row.id,name:row.name,size:row.size,scope:target.kind,...target.kind!=='personal'?{scopeId:target.id}:{},...row.origin_json?{origin:FeishuOrigin.parse(JSON.parse(row.origin_json))}:{},lifecycle:'evidence-original',revision:1,source,recordedAt:row.recorded_at};
}

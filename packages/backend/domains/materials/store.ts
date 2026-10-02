import { Kysely, SqliteDialect } from 'kysely';
import type Database from 'better-sqlite3';
import { randomUUID, createHash } from 'node:crypto';
import { Receipt, ErrorCode } from '../../../contracts/materials/schema';
import type { Identity, Preview, RawSummary, Confirm, SourceRef } from '../../../contracts/materials/schema';
import { createLedger } from '../../platform/database/ledger';
export type HumanSession = Identity & { actor: { kind: 'human'; token: string } };
export type ImportRow = { id: string; generation: string; connection: string; validity: number; state: string; name: string; digest: string; size: number; revision: 1 };
export function createMaterialsStore(db: Database.Database, workspaceInstance: string, backendGeneration: string) {
  const query = new Kysely<{ materials_raw: RawRow }>({dialect:new SqliteDialect({database:db})});
  const ledger = createLedger(db);
  const sessions = new Map<string, string>();
  function receipt(commandId: string, payloadDigest?: string): Receipt {
    const row = ledger.receipt(commandId, payloadDigest);
    if (!row) return {status:'not_found',commandId};
    if (row.status === 'committed') return {status:'committed',commandId,materialId:row.material_id,source:sourceRef(row.material_id)};
    if (row.status === 'failed') return {status:'failed',commandId,code:ErrorCode.parse(row.error)};
    return {status:'pending',commandId};
  }
  function check(session: HumanSession) {
    if (session.workspaceInstance !== workspaceInstance || session.backendGeneration !== backendGeneration || session.actor?.kind !== 'human' || sessions.get(session.connectionGeneration) !== session.actor.token) throw new Error('invalid_capability');
  }
  function valid(session: HumanSession, id: string) {
    check(session);
    const row = db.prepare('SELECT * FROM materials_imports WHERE id=?').get(id) as ImportRow | undefined;
    if (!row || row.generation !== backendGeneration || row.connection !== session.connectionGeneration || row.validity !== 1 || !['preparing','preview'].includes(row.state)) throw new Error('invalid_capability');
    return row;
  }
  return {
    connect(): HumanSession {
      const connectionGeneration = randomUUID(), token = randomUUID();
      db.prepare("UPDATE materials_imports SET state='revoked',validity=validity+1 WHERE state IN ('preparing','preview')").run();
      sessions.clear(); sessions.set(connectionGeneration, token);
      return { protocolVersion: 1, workspaceInstance, backendGeneration, connectionGeneration, actor: { kind: 'human', token } };
    },
    begin(session: HumanSession, name: string) {
      check(session); const id = randomUUID();
      db.prepare('INSERT INTO materials_imports(id,generation,connection,state,name) VALUES (?,?,?,\'preparing\',?)').run(id, backendGeneration, session.connectionGeneration, name);
      return id;
    },
    valid,
    preview(session: HumanSession, input: Preview) {
      valid(session, input.importId);
      db.prepare("UPDATE materials_imports SET state='preview',digest=?,size=? WHERE id=?").run(input.digest, input.size, input.importId);
      return input;
    },
    cancel(session: HumanSession, id: string) {
      valid(session, id); db.prepare("UPDATE materials_imports SET state='revoked',validity=validity+1 WHERE id=?").run(id);
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
        db.prepare("INSERT INTO materials_raw VALUES (?,?,?,?,?,1,'personal','evidence-original',?)").run(id,row.name,row.size,row.digest,blobId,new Date().toISOString());
        ledger.retain(blobId,id,input.commandId);
        db.prepare("UPDATE materials_imports SET state='consumed' WHERE id=?").run(input.importId);
        return receipt(input.commandId);
      })();
    },
    fail(commandId: string, code: import('../../../contracts/materials/schema').ErrorCode) { db.transaction(() => ledger.fail(commandId,code))(); },
    claimGarbage() { return db.transaction(() => ledger.claim())(); },
    deleted(id: string) { ledger.deleted(id); },
    recover() {
      db.transaction(() => ledger.recover(backendGeneration))();
      const rows = db.prepare("SELECT id FROM materials_imports WHERE state IN ('preparing','preview')").all() as { id: string }[];
      db.prepare("UPDATE materials_imports SET state='revoked',validity=validity+1 WHERE state IN ('preparing','preview')").run();
      return rows.map(row => row.id);
    },
  };
}
export type Store = ReturnType<typeof createMaterialsStore>;
export type Call = { [K in keyof Store]: { method: K; args: Parameters<Store[K]> } }[keyof Store];

type RawRow = { id: string; name: string; size: number; digest: string; blob_id: string; recorded_at: string };
function summary(row: RawRow): RawSummary {
  return { id: row.id, name: row.name, size: row.size, scope: 'personal', lifecycle: 'evidence-original', revision: 1, source: sourceRef(row.id), recordedAt: row.recorded_at };
}

function sourceRef(id: string): SourceRef { return { owner: 'materials', objectId: id, revision: 1, locator: 'whole', scope: 'personal' }; }

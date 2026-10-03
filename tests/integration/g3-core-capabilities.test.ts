import { afterEach, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createOpportunityDomain } from '../../packages/backend/domains/opportunity/public';
import { opportunityMigration } from '../../packages/backend/domains/opportunity/migration';
import { commandMigration } from '../../packages/backend/platform/commands/receipts';

const opened: { db: Database.Database; root: string }[] = [];
afterEach(() => {
  for (const { db, root } of opened.splice(0)) {
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
function setup() {
  const root = mkdtempSync(path.join(tmpdir(), 'career-g3-core-'));
  const db = new Database(path.join(root, 'career.sqlite'));
  db.pragma('foreign_keys=ON');
  db.exec(commandMigration);
  db.exec(opportunityMigration);
  opened.push({ db, root });
  const domain = createOpportunityDomain(db);
  const c = domain.handle({ operation: 'company.create', commandId: randomUUID(), name: 'G3 测试公司' });
  if (c.kind !== 'company') throw Error('fixture failed');
  const o = domain.handle({ operation: 'create', commandId: randomUUID(), companyId: c.company.id, role: '人工岗位' });
  if (o.kind !== 'opportunity') throw Error('fixture failed');
  return { db, domain, id: o.opportunity.id, companyId: c.company.id };
}
it('renderer stage correction cannot void a real submodule-owned stage behind its owner',()=>{
 const {domain,id}=setup();const event=domain.capabilities.recordStage({commandId:randomUUID(),opportunityId:id,expectedRevision:1,stage:'offer',businessTime:{kind:'unknown'},reason:'Actual Offer owner fact'});
 expect(domain.handle({operation:'correct-stage',commandId:randomUUID(),id,expectedRevision:2,eventId:event.eventId,stage:'offer',voided:true,reason:'Bypass the real Offer',businessTime:{kind:'unknown'}})).toEqual({kind:'failure',code:'invalid_transition'});
 expect(domain.capabilities.readOpportunity(id)).toMatchObject({phase:'offer',revision:2});
});
it('correcting an old acceptance preserves a later real continuation even when acceptance had restored a withdrawn opportunity',()=>{
 const {domain,id}=setup();const stage=domain.capabilities.recordStage({commandId:randomUUID(),opportunityId:id,expectedRevision:1,stage:'offer',businessTime:{kind:'unknown'},reason:'Real Offer'});
 domain.handle({operation:'end',commandId:randomUUID(),id,expectedRevision:2,outcome:'withdrawn',reason:'Earlier actual withdrawal',businessTime:{kind:'unknown'}});
 const accepted=domain.capabilities.recordOfferEvent({commandId:randomUUID(),opportunityId:id,expectedRevision:3,action:'accepted',basisId:randomUUID(),businessTime:{kind:'unknown'},reason:'Actual acceptance'});
 domain.handle({operation:'recontinue',commandId:randomUUID(),id,expectedRevision:4,reason:'Later actual continuation',businessTime:{kind:'unknown'}});
 const corrected=domain.capabilities.recordOfferEvent({commandId:randomUUID(),opportunityId:id,expectedRevision:5,action:'acceptance_corrected',correctedEventId:accepted.eventId,businessTime:{kind:'unknown'},reason:'Old acceptance was a mistaken record'});
 expect(corrected.opportunity.result).toBe('active');
});

it('DM-05/27 real unknown-date round advances through public capability without false predecessor dates', () => {
  const { domain, id, companyId } = setup();
  const cap = domain.capabilities;
  expect(cap.readCompany(companyId)?.name).toBe('G3 测试公司');
  const intent = { commandId: randomUUID(), opportunityId: id, expectedRevision: 1, stage: 'interview' as const, businessTime: { kind: 'unknown' as const }, reason: '确认真实二面，日期尚未确定' };
  const result = cap.recordStage(intent);
  expect(result.opportunity).toMatchObject({ phase: 'interview', result: 'active', revision: 2, stageDates: { interview: { kind: 'unknown' }, submitted: { kind: 'unknown' } } });
  expect(cap.recordStage(intent)).toEqual(result);
  expect(domain.handle({ operation: 'history', id })).toMatchObject({ kind: 'history', items: [{ id: result.eventId, type: 'stage_reached' }, {}] });
});

it('Offer acceptance capability refuses a basis claim before any real Offer stage', () => {
  const { domain, id } = setup();
  expect(() => domain.capabilities.recordOfferEvent({ commandId: randomUUID(), opportunityId: id, expectedRevision: 1, action: 'accepted', basisId: randomUUID(), businessTime: { kind: 'unknown' }, reason: '不能虚构收到' })).toThrow('invalid_transition');
  expect(domain.capabilities.readOpportunity(id)).toMatchObject({ revision: 1, phase: 'preparation', result: 'active' });
});

it('DM-31/35 Offer result events preserve acceptance basis and later true results through replacement and correction', () => {
  const { domain, id } = setup();
  const cap=domain.capabilities;
  cap.recordStage({commandId:randomUUID(),opportunityId:id,expectedRevision:1,stage:'offer',businessTime:{kind:'date',date:'2026-09-01'},reason:'现实收到'});
  const basisId=randomUUID();
  const accepted=cap.recordOfferEvent({commandId:randomUUID(),opportunityId:id,expectedRevision:2,action:'accepted',basisId,businessTime:{kind:'date',date:'2026-09-02'},reason:'明确接受 30k'});
  expect(accepted.opportunity.result).toBe('accepted');
  const replaced=cap.recordOfferEvent({commandId:randomUUID(),opportunityId:id,expectedRevision:3,action:'conditions_replaced',businessTime:{kind:'date',date:'2026-09-03'},reason:'招聘方正式改为 25k'});
  expect(replaced.opportunity).toMatchObject({phase:'offer',result:'active'});
  const withdrawn=cap.recordOfferEvent({commandId:randomUUID(),opportunityId:id,expectedRevision:4,action:'recruiter_withdrew',businessTime:{kind:'date',date:'2026-09-04'},reason:'招聘方后来撤回'});
  expect(withdrawn.opportunity.result).toBe('recruiter_ended');
  const correction=cap.recordOfferEvent({commandId:randomUUID(),opportunityId:id,expectedRevision:5,action:'acceptance_corrected',correctedEventId:accepted.eventId,businessTime:{kind:'unknown'},reason:'纠正旧接受误操作，不能抹掉后来撤回'});
  expect(correction.opportunity.result).toBe('recruiter_ended');
  expect(domain.handle({operation:'history',id})).toMatchObject({kind:'history',items:expect.arrayContaining([expect.objectContaining({id:accepted.eventId,basisId,type:'offer_accepted'}),expect.objectContaining({correctedEventId:accepted.eventId,type:'offer_acceptance_corrected'})])});
});

it('DM-06/39 late records preserve current termination; nested owner failure rolls core and receipt back', () => {
  const {db,domain,id}=setup();const cap=domain.capabilities;
  const intent={commandId:randomUUID(),opportunityId:id,expectedRevision:1,stage:'offer' as const,businessTime:{kind:'unknown' as const},reason:'收到'};
  expect(()=>db.transaction(()=>{cap.recordStage(intent);throw Error('child-owner-failed');})()).toThrow('child-owner-failed');
  expect(cap.readOpportunity(id)?.revision).toBe(1);
  expect(domain.handle({operation:'receipt',commandId:intent.commandId})).toEqual({kind:'receipt_missing'});
  expect(cap.recordStage(intent).opportunity.revision).toBe(2);
  domain.handle({operation:'end',commandId:randomUUID(),id,expectedRevision:2,outcome:'recruiter_ended',reason:'后来撤回',businessTime:{kind:'date',date:'2026-09-10'}});
  const late=cap.recordOfferEvent({commandId:randomUUID(),opportunityId:id,expectedRevision:3,action:'accepted',basisId:randomUUID(),historical:true,businessTime:{kind:'date',date:'2026-09-01'},reason:'晚录当时接受'});
  expect(late.opportunity.result).toBe('recruiter_ended');
  expect(cap.readOpportunity(id)?.stageDates.submitted).toEqual({kind:'unknown'});
});

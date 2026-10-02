import { afterEach,expect,it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createOpportunityDomain } from '../../packages/backend/domains/opportunity/public';
import { opportunityMigration } from '../../packages/backend/domains/opportunity/migration';
import { commandMigration } from '../../packages/backend/platform/commands/receipts';
const opened:{db:Database.Database;root:string}[]=[];
afterEach(()=>{for(const {db,root} of opened.splice(0)){db.close();rmSync(root,{recursive:true,force:true});}});
function setup(){const root=mkdtempSync(path.join(tmpdir(),'career-opportunity-'));const db=new Database(path.join(root,'career.sqlite'));db.pragma('foreign_keys = ON');db.exec(commandMigration);db.exec(opportunityMigration);opened.push({db,root});return createOpportunityDomain(db);}
it('DM-02 same-name Company identities remain distinct and can be explicitly reused without JD',()=>{
 const domain=setup();const one=domain.handle({operation:'company.create',commandId:randomUUID(),name:'同名公司'});const two=domain.handle({operation:'company.create',commandId:randomUUID(),name:'同名公司'});if(one.kind!=='company'||two.kind!=='company')throw Error('company failed');expect(one.company.id).not.toBe(two.company.id);
 const first=domain.handle({operation:'create',commandId:randomUUID(),companyId:one.company.id,role:'工程师'});const second=domain.handle({operation:'create',commandId:randomUUID(),companyId:one.company.id,role:'设计师'});if(first.kind!=='opportunity'||second.kind!=='opportunity')throw Error('create failed');expect(first.opportunity.companyId).toBe(second.opportunity.companyId);expect(first.opportunity.phase).toBe('preparation');expect(first.opportunity.result).toBe('active');
 expect(domain.resolveOpportunity(first.opportunity.id)).toEqual({id:first.opportunity.id,companyName:'同名公司',role:'工程师'});
});
it('DM-04/05/06/33 late stage records retain reached phase and current result without fake predecessor objects',()=>{
 const domain=setup();const company=domain.handle({operation:'company.create',commandId:randomUUID(),name:'测试公司'});if(company.kind!=='company')throw Error('company failed');const initial=domain.handle({operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'研究员'});if(initial.kind!=='opportunity')throw Error('create failed');const id=initial.opportunity.id;
 const offer=domain.handle({operation:'record-stage',commandId:randomUUID(),id,expectedRevision:1,stage:'offer',reason:'现实收到 Offer，仅登记已达到阶段',businessTime:{kind:'date',date:'2026-09-28'}});if(offer.kind!=='opportunity')throw Error('stage failed');expect(offer.opportunity.phase).toBe('offer');expect(offer.opportunity.stageDates.submitted).toEqual({kind:'unknown'});expect(offer.opportunity.stageDates.interview).toEqual({kind:'unknown'});
 const ended=domain.handle({operation:'end',commandId:randomUUID(),id,expectedRevision:2,outcome:'withdrawn',reason:'后来退出',businessTime:{kind:'unknown'}});if(ended.kind!=='opportunity')throw Error('end failed');
 const late=domain.handle({operation:'record-stage',commandId:randomUUID(),id,expectedRevision:3,stage:'interview',reason:'补录此前真实面试',businessTime:{kind:'date',date:'2026-09-25'}});if(late.kind!=='opportunity')throw Error('late failed');expect(late.opportunity.phase).toBe('offer');expect(late.opportunity.result).toBe('withdrawn');expect(late.opportunity.stageDates.interview).toEqual({kind:'date',date:'2026-09-25'});
 const continued=domain.handle({operation:'recontinue',commandId:randomUUID(),id,expectedRevision:4,reason:'招聘方后来联系，现实继续同次尝试',businessTime:{kind:'date',date:'2026-10-02'}});if(continued.kind!=='opportunity')throw Error('continue failed');expect(continued.opportunity.result).toBe('active');const history=domain.handle({operation:'history',id});if(history.kind!=='history')throw Error('history failed');expect(history.items.map(item=>item.type)).toEqual(['continued','stage_reached','ended','stage_reached','created']);
});
it('DM-35 correction reverses an erroneous end and retains both end and correction under the same attempt',()=>{
 const domain=setup();const c=domain.handle({operation:'company.create',commandId:randomUUID(),name:'公司'});if(c.kind!=='company')throw Error();const o=domain.handle({operation:'create',commandId:randomUUID(),companyId:c.company.id,role:'岗位'});if(o.kind!=='opportunity')throw Error();const id=o.opportunity.id;
 domain.handle({operation:'end',commandId:randomUUID(),id,expectedRevision:1,outcome:'recruiter_ended',reason:'误点',businessTime:{kind:'unknown'}});
 const fixed=domain.handle({operation:'correct-end',commandId:randomUUID(),id,expectedRevision:2,reason:'没有终止，这是误操作',businessTime:{kind:'unknown'}});if(fixed.kind!=='opportunity')throw Error();expect(fixed.opportunity.id).toBe(id);expect(fixed.opportunity.result).toBe('active');const history=domain.handle({operation:'history',id});if(history.kind!=='history')throw Error();expect(history.items.map(i=>i.type)).toEqual(['end_corrected','ended','created']);
});
it('DM-39 correcting a later erroneous result restores the previous real result rather than inventing activity',()=>{
 const domain=setup();const c=domain.handle({operation:'company.create',commandId:randomUUID(),name:'公司'});if(c.kind!=='company')throw Error();const o=domain.handle({operation:'create',commandId:randomUUID(),companyId:c.company.id,role:'岗位'});if(o.kind!=='opportunity')throw Error();const id=o.opportunity.id;
 domain.handle({operation:'end',commandId:randomUUID(),id,expectedRevision:1,outcome:'withdrawn',reason:'真实退出',businessTime:{kind:'unknown'}});
 domain.handle({operation:'end',commandId:randomUUID(),id,expectedRevision:2,outcome:'recruiter_ended',reason:'误点后续终止',businessTime:{kind:'unknown'}});
 const fixed=domain.handle({operation:'correct-end',commandId:randomUUID(),id,expectedRevision:3,reason:'后续没有终止',businessTime:{kind:'unknown'}});if(fixed.kind!=='opportunity')throw Error();expect(fixed.opportunity.result).toBe('withdrawn');
});
it('DM-02/39 Company rename and mistaken association correction keep reusable identity and explain the prior relation',()=>{
 const d=setup();const a=d.handle({operation:'company.create',commandId:randomUUID(),name:'旧公司名'});const b=d.handle({operation:'company.create',commandId:randomUUID(),name:'另一家公司'});if(a.kind!=='company'||b.kind!=='company')throw Error();const create={operation:'create',commandId:randomUUID(),companyId:a.company.id,role:'原岗位'};const o=d.handle(create);if(o.kind!=='opportunity')throw Error();expect(d.handle(create)).toEqual(o);
 const renamed=d.handle({operation:'company.rename',commandId:randomUUID(),id:a.company.id,expectedRevision:1,name:'当前公司名'});expect(renamed.kind).toBe('company');expect(d.resolveOpportunity(o.opportunity.id)?.companyName).toBe('当前公司名');
 const change={operation:'edit',commandId:randomUUID(),id:o.opportunity.id,expectedRevision:1,companyId:b.company.id,role:'正确岗位',reason:'纠正误选公司',businessTime:{kind:'unknown'},correction:true};const result=d.handle(change);if(result.kind!=='opportunity')throw Error();expect(result.opportunity.id).toBe(o.opportunity.id);expect(d.handle({...change,commandId:randomUUID()})).toEqual({kind:'failure',code:'conflict'});expect(d.handle({...change,role:'修改原command内容'})).toEqual({kind:'failure',code:'conflict'});
 const h=d.handle({operation:'history',id:o.opportunity.id});if(h.kind!=='history')throw Error();expect(h.items[0].previousCompanyId).toBe(a.company.id);expect(h.items[0].previousRole).toBe('原岗位');expect(h.items[0].companyId).toBe(b.company.id);expect(h.items[0].type).toBe('identity_corrected');
});
it('DM-39 correcting a mistaken reached-stage event keeps its identity and removes the false advancement',()=>{
 const d=setup();const c=d.handle({operation:'company.create',commandId:randomUUID(),name:'公司'});if(c.kind!=='company')throw Error();const o=d.handle({operation:'create',commandId:randomUUID(),companyId:c.company.id,role:'岗位'});if(o.kind!=='opportunity')throw Error();const id=o.opportunity.id;
 d.handle({operation:'record-stage',commandId:randomUUID(),id,expectedRevision:1,stage:'offer',reason:'误选',businessTime:{kind:'date',date:'2026-10-01'}});const h=d.handle({operation:'history',id});if(h.kind!=='history')throw Error();const eventId=h.items[0].id;
 const fixed=d.handle({operation:'correct-stage',commandId:randomUUID(),id,expectedRevision:2,eventId,stage:'interview',voided:false,reason:'实际上只是面试',businessTime:{kind:'date',date:'2026-09-20'}});if(fixed.kind!=='opportunity')throw Error('correction failed');expect(fixed.opportunity.phase).toBe('interview');expect(fixed.opportunity.stageDates.offer).toEqual({kind:'unknown'});const history=d.handle({operation:'history',id});if(history.kind!=='history')throw Error();expect(history.items[0].correctedEventId).toBe(eventId);expect(history.items[1].id).toBe(eventId);
});
it('the exact intent receipt and owned objects remain readable after closing and reopening SQLite',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'career-opportunity-reopen-'));const filename=path.join(root,'career.sqlite');let db=new Database(filename);db.pragma('foreign_keys=ON');db.exec(commandMigration);db.exec(opportunityMigration);let domain=createOpportunityDomain(db);
 const c=domain.handle({operation:'company.create',commandId:randomUUID(),name:'持久公司'});if(c.kind!=='company')throw Error();const intent={operation:'create',commandId:randomUUID(),companyId:c.company.id,role:'持久岗位'};const saved=domain.handle(intent);if(saved.kind!=='opportunity')throw Error();db.close();db=new Database(filename);db.pragma('foreign_keys=ON');opened.push({db,root});domain=createOpportunityDomain(db);expect(domain.handle({operation:'read',id:saved.opportunity.id})).toEqual(saved);expect(domain.handle({operation:'receipt',commandId:intent.commandId})).toEqual(saved);expect(domain.handle(intent)).toEqual(saved);
});
it('Company public read supplies the known revision for an explicit conflicted rename retry',()=>{
 const d=setup();const created=d.handle({operation:'company.create',commandId:randomUUID(),name:'初始名称'});if(created.kind!=='company')throw Error();const id=created.company.id;
 d.handle({operation:'company.rename',commandId:randomUUID(),id,expectedRevision:1,name:'另一窗口名称'});
 const draft={operation:'company.rename',commandId:randomUUID(),id,expectedRevision:1,name:'我的保留草稿'};expect(d.handle(draft)).toEqual({kind:'failure',code:'conflict'});
 const current=d.handle({operation:'company.read',id});if(current.kind!=='company')throw Error('read missing');expect(current.company.name).toBe('另一窗口名称');
 const saved=d.handle({...draft,commandId:randomUUID(),expectedRevision:current.company.revision});if(saved.kind!=='company')throw Error();expect(saved.company.id).toBe(id);expect(saved.company.name).toBe('我的保留草稿');
});

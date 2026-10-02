import { it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createEmploymentDomain, employmentMigration } from '../../packages/backend/domains/employment/public';
import { commandMigration } from '../../packages/backend/platform/commands/receipts';
function workspace() {
 const root=mkdtempSync(path.join(tmpdir(),'career-employment-'));
 const db=new Database(path.join(root,'career.sqlite'));
 db.pragma('foreign_keys = ON');
 db.exec(commandMigration + employmentMigration);
 return {domain:createEmploymentDomain(db),close(){db.close();
rmSync(root,{recursive:true,force:true});
}};
}
it('actual employment persists unknown start and future planned end without ending employment',()=>{
 const w=workspace();
 try {
  const result=w.domain.handle({operation:'create',commandId:crypto.randomUUID(),company:'测试公司',role:'工程师',goal:'学习',started:true,start:{kind:'unknown'},plannedEnd:{kind:'date',date:'2099-12-31'}});
  expect(result.kind).toBe('employment');
 if(result.kind!=='employment') throw new Error('not saved');
  expect(w.domain.handle({operation:'read',id:result.employment.id})).toMatchObject({kind:'employment',employment:{status:'current',start:{kind:'unknown'},actualEnd:{kind:'unknown'},plannedEnd:{kind:'date',date:'2099-12-31'}}});
 } finally {w.close();
}
});
it('ending, correcting and reopening preserve one identity and distinguish real change from correction',()=>{
 const w=workspace();
try {
  const created=w.domain.handle({operation:'create',commandId:crypto.randomUUID(),company:'机构',role:'工程师',goal:'',started:true,start:{kind:'date',date:'2020-04-05'},plannedEnd:{kind:'unknown'}});
if(created.kind!=='employment')throw new Error('create');
  const id=created.employment.id;
 const commandId=crypto.randomUUID();
  const end={operation:'end',commandId,id,expectedRevision:1,mode:'change',reason:'真实结束',occurredAt:{kind:'date',date:'2024-03-01'},actualEnd:{kind:'date',date:'2024-03-01'}};
  const ended=w.domain.handle(end);
expect(ended).toMatchObject({kind:'employment',employment:{id,status:'historical',actualEnd:{kind:'date',date:'2024-03-01'}}});
  expect(w.domain.handle(end)).toEqual(ended);
expect(w.domain.handle({operation:'receipt',commandId})).toEqual(ended);
  const corrected=w.domain.handle({operation:'edit',commandId:crypto.randomUUID(),id,expectedRevision:2,mode:'correction',reason:'结束日写错',occurredAt:{kind:'unknown'},company:'机构',role:'工程师',goal:'',start:{kind:'date',date:'2020-04-05'},plannedEnd:{kind:'unknown'},actualEnd:{kind:'date',date:'2024-03-02'}});
  expect(corrected).toMatchObject({kind:'employment',employment:{id,status:'historical',revision:3}});
  expect(w.domain.handle({operation:'reopen',commandId:crypto.randomUUID(),id,expectedRevision:3,mode:'change',reason:'后来真实继续任职',occurredAt:{kind:'unknown'}})).toMatchObject({kind:'employment',employment:{id,status:'current',revision:4,actualEnd:{kind:'unknown'}}});
  expect(w.domain.handle({operation:'history',id})).toMatchObject({kind:'history',history:[{mode:'record'},{mode:'change',employment:{status:'historical',actualEnd:{date:'2024-03-01'}}},{mode:'correction',reason:'结束日写错'},{mode:'change',action:'reopened'}]});
 } finally {w.close();
}
});
it('actual future endings and edits that invent a future actual start are rejected',()=>{
 const w=workspace();
try {
  const created=w.domain.handle({operation:'create',commandId:crypto.randomUUID(),company:'机构',role:'工程师',goal:'',started:true,start:{kind:'unknown'},plannedEnd:{kind:'unknown'}});
if(created.kind!=='employment')throw new Error('create');
  expect(w.domain.handle({operation:'end',commandId:crypto.randomUUID(),id:created.employment.id,expectedRevision:1,mode:'change',reason:'结束',occurredAt:{kind:'unknown'},actualEnd:{kind:'date',date:'2099-01-01'}})).toMatchObject({kind:'failure',code:'invalid_transition'});
  expect(w.domain.handle({operation:'edit',commandId:crypto.randomUUID(),id:created.employment.id,expectedRevision:1,mode:'correction',reason:'修正开始',occurredAt:{kind:'unknown'},company:'机构',role:'工程师',goal:'',start:{kind:'date',date:'2099-01-01'},plannedEnd:{kind:'unknown'},actualEnd:{kind:'unknown'}})).toMatchObject({kind:'failure',code:'invalid_transition'});
 }finally{w.close();
}
});
it('same-name people are separate employment-scoped identities with independent role history',()=>{
 const w=workspace();
try {
  const make=(company:string)=>w.domain.handle({operation:'create',commandId:crypto.randomUUID(),company,role:'工程师',goal:'',started:true,start:{kind:'unknown'},plannedEnd:{kind:'unknown'}});
  const a=make('甲');
const b=make('乙');
if(a.kind!=='employment'||b.kind!=='employment')throw new Error('create');
  const add=(employmentId:string)=>w.domain.handle({operation:'person.create',commandId:crypto.randomUUID(),employmentId,name:'同名人物',role:'同事',occurredAt:{kind:'unknown'}});
  const p=add(a.employment.id);
const q=add(a.employment.id);
const r=add(b.employment.id);
if(p.kind!=='person'||q.kind!=='person'||r.kind!=='person')throw new Error('person');
  expect(new Set([p.person.id,q.person.id,r.person.id]).size).toBe(3);
  expect(w.domain.resolvePerson(p.person.id,b.employment.id)).toBeUndefined();
  expect(w.domain.handle({operation:'person.edit',commandId:crypto.randomUUID(),id:p.person.id,employmentId:b.employment.id,expectedRevision:1,name:'同名人物',role:'负责人',mode:'change',reason:'升职',occurredAt:{kind:'date',date:'2023-04-02'}})).toMatchObject({kind:'failure',code:'not_found'});
  expect(w.domain.handle({operation:'person.edit',commandId:crypto.randomUUID(),id:p.person.id,employmentId:a.employment.id,expectedRevision:1,name:'同名人物',role:'负责人',mode:'change',reason:'升职',occurredAt:{kind:'date',date:'2023-04-02'}})).toMatchObject({kind:'person',person:{role:'负责人',revision:2}});
  expect(w.domain.resolvePerson(q.person.id,a.employment.id)?.role).toBe('同事');
  expect(w.domain.handle({operation:'person.history',id:p.person.id,employmentId:a.employment.id})).toMatchObject({kind:'person.history',history:[{person:{role:'同事'}},{mode:'change',person:{role:'负责人'}}]});
 }finally{w.close();
}
});
it('reopening the on-disk database reads persisted employment and rejects stale writes without altering it',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'career-employment-restart-'));
let db=new Database(path.join(root,'career.sqlite'));
db.pragma('foreign_keys = ON');
db.exec(commandMigration+employmentMigration);
 try {
  let domain=createEmploymentDomain(db);
const commandId=crypto.randomUUID();
const created=domain.handle({operation:'create',commandId,company:'重启机构',role:'工程师',goal:'明确目标',started:true,start:{kind:'unknown'},plannedEnd:{kind:'date',date:'2099-12-31'}});
if(created.kind!=='employment')throw new Error('create');
  const id=created.employment.id;
db.close();
db=new Database(path.join(root,'career.sqlite'));
db.pragma('foreign_keys = ON');
domain=createEmploymentDomain(db);
  expect(domain.handle({operation:'read',id})).toEqual(created);
expect(domain.handle({operation:'receipt',commandId})).toEqual(created);
  const edit={operation:'edit',commandId:crypto.randomUUID(),id,expectedRevision:1,company:'重启机构',role:'新岗位',goal:'新目标',start:{kind:'unknown'},plannedEnd:{kind:'unknown'},actualEnd:{kind:'unknown'},mode:'change',reason:'岗位调整',occurredAt:{kind:'unknown'}};
  expect(domain.handle(edit)).toMatchObject({kind:'employment',employment:{revision:2,role:'新岗位'}});
  expect(domain.handle({...edit,commandId:crypto.randomUUID(),role:'迟到旧修改'})).toMatchObject({kind:'failure',code:'conflict',current:{role:'新岗位'}});
  expect(domain.handle({...edit,role:'同命令不同载荷'})).toMatchObject({kind:'failure',code:'conflict'});
  expect(domain.handle({operation:'read',id})).toMatchObject({kind:'employment',employment:{revision:2,role:'新岗位'}});
 }finally{db.close();
rmSync(root,{recursive:true,force:true});
}
});
it('receipt persistence failure rolls back the owner change instead of reporting a saved employment',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'career-employment-full-'));const db=new Database(path.join(root,'career.sqlite'));db.exec(commandMigration+employmentMigration);
 try {
  // Fault injection at the SQLite storage boundary, not an alternative owner write path.
  db.exec("CREATE TRIGGER test_disk_failure BEFORE INSERT ON platform_commands BEGIN SELECT RAISE(ABORT,'simulated storage failure'); END");
  const domain=createEmploymentDomain(db);const commandId=crypto.randomUUID();
  expect(domain.handle({operation:'create',commandId,company:'存储测试',role:'工程师',goal:'',started:true,start:{kind:'unknown'},plannedEnd:{kind:'unknown'}})).toEqual({kind:'failure',code:'storage_error'});
  expect(domain.handle({operation:'list'})).toEqual({kind:'list',employments:[]});expect(domain.handle({operation:'receipt',commandId})).toEqual({kind:'not_recorded'});
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});

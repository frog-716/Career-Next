import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createProjectDomain,projectMigration} from '../../packages/backend/domains/project/public';
import {createEmploymentDomain,employmentMigration} from '../../packages/backend/domains/employment/public';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';
function workspace(){
 const root=mkdtempSync(path.join(tmpdir(),'career-project-'));
 const db=new Database(path.join(root,'career.sqlite'));db.pragma('foreign_keys = ON');
 db.exec(commandMigration+employmentMigration+projectMigration);
 const employment=createEmploymentDomain(db);const project=createProjectDomain(db,employment);
 return {project,employment,close(){db.close();rmSync(root,{recursive:true,force:true});}};
}
it('personal project is independent and readable without creating employment or a collaborator',()=>{
 const w=workspace();try {
  const created=w.project.handle({operation:'create',commandId:crypto.randomUUID(),name:'个人项目',description:'内容',tags:['个人'],employmentId:null,occurredAt:{kind:'unknown'}});
  expect(created.kind).toBe('project');if(created.kind!=='project')throw new Error('create');
  expect(w.project.handle({operation:'read',id:created.project.id})).toMatchObject({kind:'project',project:{name:'个人项目',state:'inprogress',employmentId:null},participants:[]});
  expect(w.employment.handle({operation:'list'})).toEqual({kind:'list',employments:[]});
 }finally{w.close();}
});
it('completed project remains editable and real reopening differs from correction without creating a new identity',()=>{
 const w=workspace();try{
  const created=w.project.handle({operation:'create',commandId:crypto.randomUUID(),name:'测试项目',description:'原描述',tags:[],employmentId:null,occurredAt:{kind:'date',date:'2020-01-02'}});if(created.kind!=='project')throw new Error('create');const id=created.project.id;
  expect(w.project.handle({operation:'state.change',id,commandId:crypto.randomUUID(),expectedRevision:1,state:'completed',mode:'change',reason:'实际完成',occurredAt:{kind:'date',date:'2024-04-05'}})).toMatchObject({kind:'project',project:{id,state:'completed',revision:2}});
  expect(w.project.handle({operation:'edit',id,commandId:crypto.randomUUID(),expectedRevision:2,name:'改名仍同一项目',description:'补充完成后材料',tags:['维护'],mode:'change',reason:'完成后维护',occurredAt:{kind:'unknown'}})).toMatchObject({kind:'project',project:{id,state:'completed',revision:3,description:'补充完成后材料'}});
  expect(w.project.handle({operation:'state.change',id,commandId:crypto.randomUUID(),expectedRevision:3,state:'inprogress',mode:'change',reason:'真的继续',occurredAt:{kind:'unknown'}})).toMatchObject({kind:'failure',code:'invalid_transition'});
  expect(w.project.handle({operation:'reopen',id,commandId:crypto.randomUUID(),expectedRevision:3,reason:'后来真的重新推进',occurredAt:{kind:'date',date:'2025-03-04'}})).toMatchObject({kind:'project',project:{id,state:'inprogress',revision:4}});
  expect(w.project.handle({operation:'state.change',id,commandId:crypto.randomUUID(),expectedRevision:4,state:'cancelled',mode:'correction',reason:'上一步状态录错',occurredAt:{kind:'unknown'}})).toMatchObject({kind:'project',project:{id,state:'cancelled',revision:5}});
  expect(w.project.handle({operation:'history',id})).toMatchObject({kind:'history',history:[{action:'created',occurredAt:{kind:'date',date:'2020-01-02'}},{action:'state_changed',project:{state:'completed'}},{action:'edited',project:{state:'completed'}},{action:'reopened',mode:'change'},{action:'state_changed',mode:'correction',reason:'上一步状态录错'}]});
 }finally{w.close();}
});
it('A to B association preserves former collaborators as history and never migrates same-name people',()=>{
 const w=workspace();try{
  const make=(company:string)=>w.employment.handle({operation:'create',commandId:crypto.randomUUID(),company,role:'工程师',goal:'',started:true,start:{kind:'unknown'},plannedEnd:{kind:'unknown'}});
  const a=make('任职甲');const b=make('任职乙');if(a.kind!=='employment'||b.kind!=='employment')throw new Error('employment');
  const add=(employmentId:string)=>w.employment.handle({operation:'person.create',commandId:crypto.randomUUID(),employmentId,name:'同名同事',role:'部门主管',occurredAt:{kind:'unknown'}});
  const pa=add(a.employment.id);const pb=add(b.employment.id);if(pa.kind!=='person'||pb.kind!=='person')throw new Error('person');
  const created=w.project.handle({operation:'create',commandId:crypto.randomUUID(),name:'跨任职项目',description:'',tags:[],employmentId:a.employment.id,occurredAt:{kind:'unknown'}});if(created.kind!=='project')throw new Error('project');const id=created.project.id;
  expect(w.project.handle({operation:'participant.join',id,expectedRevision:1,commandId:crypto.randomUUID(),personId:pb.person.id,projectRole:'实现',mode:'change',reason:'选择人物',occurredAt:{kind:'unknown'}})).toMatchObject({kind:'failure',code:'invalid_relation'});
  const joined=w.project.handle({operation:'participant.join',id,expectedRevision:1,commandId:crypto.randomUUID(),personId:pa.person.id,projectRole:'项目审阅',mode:'change',reason:'确认参与',occurredAt:{kind:'date',date:'2023-01-02'}});
  expect(joined).toMatchObject({kind:'project',project:{revision:2},participants:[{active:true,projectRole:'项目审阅',person:{role:'部门主管'}}]});
  expect(w.project.handle({operation:'participant.join',id,expectedRevision:2,commandId:crypto.randomUUID(),personId:pa.person.id,projectRole:'重复',mode:'change',reason:'重复选择',occurredAt:{kind:'unknown'}})).toMatchObject({kind:'failure',code:'invalid_transition'});
  const switched=w.project.handle({operation:'associate',id,expectedRevision:2,commandId:crypto.randomUUID(),employmentId:b.employment.id,mode:'change',reason:'项目转入新任职',occurredAt:{kind:'unknown'}});
  expect(switched).toMatchObject({kind:'project',project:{employmentId:b.employment.id,revision:3},participants:[{employmentId:a.employment.id,active:false,personId:pa.person.id,projectRole:'项目审阅'}]});
  expect(w.project.handle({operation:'participant.join',id,expectedRevision:3,commandId:crypto.randomUUID(),personId:pb.person.id,projectRole:'项目实现',mode:'change',reason:'明确选择新协作者',occurredAt:{kind:'unknown'}})).toMatchObject({kind:'project',participants:[{personId:pa.person.id,active:false},{personId:pb.person.id,active:true}]});
  expect(w.project.handle({operation:'associate',id,expectedRevision:4,commandId:crypto.randomUUID(),employmentId:null,mode:'change',reason:'改为个人项目',occurredAt:{kind:'unknown'}})).toMatchObject({kind:'project',project:{employmentId:null},participants:[{active:false},{active:false}]});
  expect(w.employment.resolvePerson(pa.person.id,a.employment.id)?.role).toBe('部门主管');
  expect(w.project.handle({operation:'history',id})).toMatchObject({kind:'history',history:[{action:'created'},{action:'joined',participants:[{active:true,projectRole:'项目审阅'}]},{action:'associated',participants:[{active:false}]},{action:'joined'},{action:'associated'}]});
 }finally{w.close();}
});
it('participation exit, role change and rejoin preserve one context relationship and employment role',()=>{
 const w=workspace();try{
  const e=w.employment.handle({operation:'create',commandId:crypto.randomUUID(),company:'任职',role:'员工',goal:'',started:true,start:{kind:'unknown'},plannedEnd:{kind:'unknown'}});if(e.kind!=='employment')throw new Error('e');
  const p=w.employment.handle({operation:'person.create',commandId:crypto.randomUUID(),employmentId:e.employment.id,name:'协作者',role:'部门经理',occurredAt:{kind:'unknown'}});if(p.kind!=='person')throw new Error('p');
  const created=w.project.handle({operation:'create',commandId:crypto.randomUUID(),name:'参与项目',description:'',tags:[],employmentId:e.employment.id,occurredAt:{kind:'unknown'}});if(created.kind!=='project')throw new Error('project');const id=created.project.id;
  const joined=w.project.handle({operation:'participant.join',id,expectedRevision:1,commandId:crypto.randomUUID(),personId:p.person.id,projectRole:'设计',mode:'change',reason:'参与',occurredAt:{kind:'unknown'}});if(joined.kind!=='project')throw new Error('join');const participationId=joined.participants[0].id;
  expect(w.project.handle({operation:'participant.edit',id,expectedRevision:2,commandId:crypto.randomUUID(),participationId,projectRole:'审阅',mode:'change',reason:'职责调整',occurredAt:{kind:'date',date:'2024-04-04'}})).toMatchObject({kind:'project',participants:[{id:participationId,projectRole:'审阅',active:true}]});
  expect(w.project.handle({operation:'participant.leave',id,expectedRevision:3,commandId:crypto.randomUUID(),participationId,mode:'change',reason:'退出',occurredAt:{kind:'unknown'}})).toMatchObject({kind:'project',participants:[{id:participationId,projectRole:'审阅',active:false}]});
  expect(w.project.handle({operation:'participant.join',id,expectedRevision:4,commandId:crypto.randomUUID(),personId:p.person.id,projectRole:'实施',mode:'change',reason:'重新加入',occurredAt:{kind:'unknown'}})).toMatchObject({kind:'project',participants:[{id:participationId,projectRole:'实施',active:true}]});
  expect(w.employment.resolvePerson(p.person.id,e.employment.id)?.role).toBe('部门经理');
  expect(w.project.handle({operation:'history',id})).toMatchObject({kind:'history',history:[{action:'created'},{action:'joined',participants:[{projectRole:'设计'}]},{action:'role_changed',participants:[{projectRole:'审阅'}]},{action:'left',participants:[{active:false}]},{action:'rejoined',participants:[{id:participationId,active:true,projectRole:'实施'}]}]});
 }finally{w.close();}
});
it('employment ends independently while project stays current, and historical employment cannot receive a new project link',()=>{
 const w=workspace();try{
  const e=w.employment.handle({operation:'create',commandId:crypto.randomUUID(),company:'任职',role:'员工',goal:'',started:true,start:{kind:'unknown'},plannedEnd:{kind:'unknown'}});if(e.kind!=='employment')throw new Error('e');
  const created=w.project.handle({operation:'create',commandId:crypto.randomUUID(),name:'独立项目',description:'',tags:[],employmentId:e.employment.id,occurredAt:{kind:'unknown'}});if(created.kind!=='project')throw new Error('project');
  w.employment.handle({operation:'end',commandId:crypto.randomUUID(),id:e.employment.id,expectedRevision:1,mode:'change',reason:'真实结束',occurredAt:{kind:'unknown'},actualEnd:{kind:'unknown'}});
  expect(w.project.handle({operation:'read',id:created.project.id})).toMatchObject({kind:'project',project:{state:'inprogress'},employment:{status:'historical'}});
  expect(w.project.handle({operation:'create',commandId:crypto.randomUUID(),name:'不能造关联',description:'',tags:[],employmentId:e.employment.id,occurredAt:{kind:'unknown'}})).toMatchObject({kind:'failure',code:'invalid_relation'});
 }finally{w.close();}
});
it('original command receipts survive restart and stale or conflicting commands never overwrite the project',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'career-project-restart-'));let db=new Database(path.join(root,'career.sqlite'));db.exec(commandMigration+employmentMigration+projectMigration);
 try{
  let project=createProjectDomain(db,createEmploymentDomain(db));const command={operation:'create',commandId:crypto.randomUUID(),name:'重启项目',description:'',tags:[],employmentId:null,occurredAt:{kind:'unknown'}};
  const created=project.handle(command);if(created.kind!=='project')throw new Error('create');const id=created.project.id;
  db.close();db=new Database(path.join(root,'career.sqlite'));project=createProjectDomain(db,createEmploymentDomain(db));
  expect(project.handle({operation:'read',id})).toEqual(created);expect(project.handle({operation:'receipt',commandId:command.commandId})).toEqual(created);expect(project.handle(command)).toEqual(created);
  const edited={operation:'edit',commandId:crypto.randomUUID(),id,expectedRevision:1,name:'最新名称',description:'最新',tags:[],mode:'change',reason:'真实变化',occurredAt:{kind:'unknown'}};
  expect(project.handle(edited)).toMatchObject({kind:'project',project:{revision:2,name:'最新名称'}});
  expect(project.handle({...edited,commandId:crypto.randomUUID(),name:'迟到修改'})).toMatchObject({kind:'failure',code:'conflict',current:{name:'最新名称'}});
  expect(project.handle({...edited,name:'同命令不同内容'})).toMatchObject({kind:'failure',code:'conflict'});
  expect(project.handle({operation:'read',id})).toMatchObject({kind:'project',project:{name:'最新名称',revision:2}});
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});
it('SQLite receipt failure rolls back association and participation transfer atomically',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'career-project-failure-'));const db=new Database(path.join(root,'career.sqlite'));db.exec(commandMigration+employmentMigration+projectMigration);
 try{
  const employment=createEmploymentDomain(db);const project=createProjectDomain(db,employment);
  const e=employment.handle({operation:'create',commandId:crypto.randomUUID(),company:'任职',role:'员工',goal:'',started:true,start:{kind:'unknown'},plannedEnd:{kind:'unknown'}});if(e.kind!=='employment')throw new Error('e');
  const p=employment.handle({operation:'person.create',commandId:crypto.randomUUID(),employmentId:e.employment.id,name:'人物',role:'部门职务',occurredAt:{kind:'unknown'}});if(p.kind!=='person')throw new Error('person');
  const created=project.handle({operation:'create',commandId:crypto.randomUUID(),name:'回滚项目',description:'',tags:[],employmentId:e.employment.id,occurredAt:{kind:'unknown'}});if(created.kind!=='project')throw new Error('project');const id=created.project.id;
  const joined=project.handle({operation:'participant.join',id,expectedRevision:1,commandId:crypto.randomUUID(),personId:p.person.id,projectRole:'职责',mode:'change',reason:'参与',occurredAt:{kind:'unknown'}});if(joined.kind!=='project')throw new Error('join');
  // Inject an actual SQLite storage failure at the shared receipt boundary.
  db.exec("CREATE TRIGGER test_receipt_failure BEFORE INSERT ON platform_commands WHEN NEW.owner='project' BEGIN SELECT RAISE(ABORT,'storage failure'); END");
  const commandId=crypto.randomUUID();expect(project.handle({operation:'associate',id,expectedRevision:2,commandId,employmentId:null,mode:'change',reason:'转个人',occurredAt:{kind:'unknown'}})).toEqual({kind:'failure',code:'storage_error'});
  expect(project.handle({operation:'read',id})).toEqual(joined);expect(project.handle({operation:'receipt',commandId})).toEqual({kind:'not_recorded'});
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});

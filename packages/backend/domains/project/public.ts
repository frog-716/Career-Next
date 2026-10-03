import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {Project,Request,Result,History,Participation} from '../../../contracts/project/schema';
import type {EmploymentRelation,PersonRelation} from '../../../contracts/employment/schema';
import {redactOwnerReceipts} from '../../platform/commands/purge-receipts';
import {executeCommand,commandReceipt} from '../../platform/commands/receipts';
export type ProjectDependencies={
 resolveEmployment(id:string):EmploymentRelation|undefined;
 resolvePerson(id:string,employmentId:string):PersonRelation|undefined;
};
export const projectMigration=`
CREATE TABLE project_current(id TEXT PRIMARY KEY,revision INTEGER NOT NULL CHECK(revision>0),value_json TEXT NOT NULL);
CREATE TABLE project_history(project_id TEXT NOT NULL REFERENCES project_current(id),revision INTEGER NOT NULL,value_json TEXT NOT NULL,PRIMARY KEY(project_id,revision));
CREATE TABLE project_participation(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES project_current(id),context_id TEXT NOT NULL,person_id TEXT NOT NULL,value_json TEXT NOT NULL,UNIQUE(project_id,context_id,person_id));
`;
export function createProjectDomain(db:Database.Database,dependencies:ProjectDependencies){
 function read(id:string):Project|undefined {
  const row=db.prepare('SELECT value_json FROM project_current WHERE id=?').get(id) as {value_json:string}|undefined;
  return row?Project.parse(JSON.parse(row.value_json)):undefined;
 }
 function failure(code:Extract<Result,{kind:'failure'}>['code'],current?:Project):Result {
  return current?{kind:'failure',code,current}:{kind:'failure',code};
 }
 function participants(id:string):Participation[]{
  return (db.prepare('SELECT value_json FROM project_participation WHERE project_id=? ORDER BY rowid').all(id) as {value_json:string}[]).map(row=>Participation.parse(JSON.parse(row.value_json)));
 }
 function saveParticipation(value:Participation):void {
  db.prepare('INSERT INTO project_participation VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json').run(value.id,value.projectId,value.contextId,value.personId,JSON.stringify(value));
 }
 function view(project:Project):Result {
  return {kind:'project',project,employment:project.employmentId?dependencies.resolveEmployment(project.employmentId)??null:null,participants:participants(project.id).map(value=>({...value,person:dependencies.resolvePerson(value.personId,value.employmentId)??null,employment:dependencies.resolveEmployment(value.employmentId)??null}))};
 }
 function record(project:Project,request:{mode:'change'|'correction';reason:string;occurredAt:unknown},action:History['action']):void {
  db.prepare('UPDATE project_current SET revision=?,value_json=? WHERE id=?').run(project.revision,JSON.stringify(project),project.id);
  db.prepare('INSERT INTO project_history VALUES (?,?,?)').run(project.id,project.revision,JSON.stringify({revision:project.revision,action,mode:request.mode,reason:request.reason,occurredAt:request.occurredAt,recordedAt:project.recordedAt,project,participants:participants(project.id)}));
 }
 function stateChange(request:Extract<Request,{operation:'edit'|'state.change'|'reopen'}>):Result {
  const old=read(request.id);if(!old)return failure('not_found');if(old.revision!==request.expectedRevision)return failure('conflict',old);
  const terminal=old.state==='completed'||old.state==='cancelled';
  if(request.operation==='reopen'&&!terminal)return failure('invalid_transition',old);
  if(request.operation==='state.change'&&request.mode==='change'&&terminal&&(request.state==='inprogress'||request.state==='paused'))return failure('invalid_transition',old);
  const project:Project={...old,revision:old.revision+1,recordedAt:new Date().toISOString()};
  if(request.operation==='edit'){project.name=request.name;project.description=request.description;project.tags=request.tags;}
  else {project.state=request.operation==='reopen'?'inprogress':request.state;project.stateNote=request.reason;}
  record(project,{...request,mode:request.operation==='reopen'?'change':request.mode},request.operation==='edit'?'edited':request.operation==='reopen'?'reopened':'state_changed');return view(project);
 }
 function associate(request:Extract<Request,{operation:'associate'}>):Result {
  const old=read(request.id);if(!old)return failure('not_found');if(old.revision!==request.expectedRevision)return failure('conflict',old);
  if(old.employmentId===request.employmentId)return failure('invalid_transition',old);
  if(request.employmentId&&dependencies.resolveEmployment(request.employmentId)?.status!=='current')return failure('invalid_relation',old);
  const recordedAt=new Date().toISOString();
  for(const value of participants(old.id))if(value.contextId===old.contextId&&value.active)saveParticipation({...value,active:false,recordedAt});
  const project:Project={...old,revision:old.revision+1,employmentId:request.employmentId,contextId:randomUUID(),recordedAt};
  record(project,request,'associated');return view(project);
 }
 function join(request:Extract<Request,{operation:'participant.join'}>):Result {
  const old=read(request.id);if(!old)return failure('not_found');if(old.revision!==request.expectedRevision)return failure('conflict',old);
  if(!old.employmentId||dependencies.resolveEmployment(old.employmentId)?.status!=='current'||!dependencies.resolvePerson(request.personId,old.employmentId))return failure('invalid_relation',old);
  const prior=participants(old.id).find(value=>value.contextId===old.contextId&&value.personId===request.personId);
  if(prior?.active)return failure('invalid_transition',old);
  const recordedAt=new Date().toISOString();
  const value:Participation={id:prior?.id??randomUUID(),projectId:old.id,contextId:old.contextId,employmentId:old.employmentId,personId:request.personId,projectRole:request.projectRole,active:true,recordedAt};
  saveParticipation(value);const project:Project={...old,revision:old.revision+1,recordedAt};
  record(project,request,prior?'rejoined':'joined');return view(project);
 }
 function changeParticipation(request:Extract<Request,{operation:'participant.edit'|'participant.leave'}>):Result {
  const old=read(request.id);if(!old)return failure('not_found');if(old.revision!==request.expectedRevision)return failure('conflict',old);
  const value=participants(old.id).find(value=>value.id===request.participationId);if(!value)return failure('not_found',old);
  if(request.mode==='change'&&(!value.active||value.contextId!==old.contextId))return failure('invalid_transition',old);
  const recordedAt=new Date().toISOString();
  saveParticipation({...value,projectRole:request.operation==='participant.edit'?request.projectRole:value.projectRole,active:request.operation==='participant.leave'?false:value.active,recordedAt});
  const project:Project={...old,revision:old.revision+1,recordedAt};record(project,request,request.operation==='participant.edit'?'role_changed':'left');return view(project);
 }
 function dispatch(request:Request):Result {
  switch(request.operation){
   case 'create':{
    if(request.employmentId&&dependencies.resolveEmployment(request.employmentId)?.status!=='current')return failure('invalid_relation');
    const project:Project={id:randomUUID(),revision:1,name:request.name,description:request.description,tags:request.tags,state:'inprogress',stateNote:'',employmentId:request.employmentId,contextId:randomUUID(),recordedAt:new Date().toISOString()};
    db.prepare('INSERT INTO project_current VALUES (?,?,?)').run(project.id,project.revision,JSON.stringify(project));
    db.prepare('INSERT INTO project_history VALUES (?,?,?)').run(project.id,project.revision,JSON.stringify({revision:1,action:'created',mode:'record',reason:'创建项目',occurredAt:request.occurredAt,recordedAt:project.recordedAt,project,participants:[]}));
    return view(project);
   }
   case 'read':{const project=read(request.id);return project?view(project):failure('not_found');}
   case 'list':return {kind:'list',projects:(db.prepare('SELECT value_json FROM project_current ORDER BY rowid').all() as {value_json:string}[]).map(row=>{const project=Project.parse(JSON.parse(row.value_json));return {...project,employment:project.employmentId?dependencies.resolveEmployment(project.employmentId)??null:null};})};
   case 'receipt':{const result=commandReceipt(db,'project',request.commandId);return result===undefined?{kind:'not_recorded'}:Result.parse(result);}
   case 'edit':case 'state.change':case 'reopen':return stateChange(request);
   case 'history':return read(request.id)?{kind:'history',history:(db.prepare('SELECT value_json FROM project_history WHERE project_id=? ORDER BY revision').all(request.id) as {value_json:string}[]).map(row=>History.parse(JSON.parse(row.value_json)))}:failure('not_found');
   case 'associate':return associate(request);
   case 'participant.join':return join(request);
   case 'participant.edit':case 'participant.leave':return changeParticipation(request);
  }
 }
 return {purgeImpact(id:string){const item=read(id);return item?{id,revision:item.revision,name:item.name,blobIds:[],retentions:[]}:undefined;},purge(id:string){db.transaction(()=>{db.prepare('DELETE FROM project_participation WHERE project_id=?').run(id);db.prepare('DELETE FROM project_history WHERE project_id=?').run(id);db.prepare('DELETE FROM project_current WHERE id=?').run(id);redactOwnerReceipts(db,'project',[id],{kind:'failure',code:'not_found'});})();},handle(input:unknown):Result {
  const parsed=Request.safeParse(input);if(!parsed.success)return failure('invalid_input');
  const request=parsed.data;
  try {return Result.parse('commandId' in request&&request.operation!=='receipt'?executeCommand(db,'project',request.commandId,request,()=>Result.parse(dispatch(request))):dispatch(request));}
  catch(error){return failure(error instanceof Error&&error.message==='conflict'?'conflict':'storage_error');}
 }};
}

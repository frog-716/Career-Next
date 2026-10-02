import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { Request, Result, Employment, Person, EmploymentRelation, PersonRelation } from '../../../contracts/employment/schema';
import type { BusinessTime } from '../../../contracts/common/business-time';
import { commandReceipt, executeCommand } from '../../platform/commands/receipts';
export const employmentMigration=`
CREATE TABLE employment_current(id TEXT PRIMARY KEY, revision INTEGER NOT NULL, value_json TEXT NOT NULL);
CREATE TABLE employment_history(employment_id TEXT NOT NULL REFERENCES employment_current(id), revision INTEGER NOT NULL, value_json TEXT NOT NULL, PRIMARY KEY(employment_id,revision));
CREATE TABLE employment_person(id TEXT PRIMARY KEY, employment_id TEXT NOT NULL REFERENCES employment_current(id), revision INTEGER NOT NULL, value_json TEXT NOT NULL);
CREATE TABLE employment_person_history(person_id TEXT NOT NULL REFERENCES employment_person(id), revision INTEGER NOT NULL, value_json TEXT NOT NULL, PRIMARY KEY(person_id,revision));
`;
function future(time:BusinessTime):boolean {
 const now=new Date();
const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 return time.kind==='date'?time.date>today:time.kind==='instant'?Date.parse(time.instant)>now.getTime():false;
}
function invalidDates(start:BusinessTime,end:BusinessTime):boolean {
 return future(start)||future(end)||(start.kind==='date'&&end.kind==='date'&&end.date<start.date)||(start.kind==='instant'&&end.kind==='instant'&&Date.parse(end.instant)<Date.parse(start.instant));
}
export function createEmploymentDomain(db:Database.Database) {
 function employment(id:string):Employment|undefined {const row=db.prepare('SELECT value_json FROM employment_current WHERE id=?').get(id) as {value_json:string}|undefined;
return row?Employment.parse(JSON.parse(row.value_json)):undefined;
}
 function person(id:string,employmentId:string):Person|undefined {const row=db.prepare('SELECT value_json FROM employment_person WHERE id=? AND employment_id=?').get(id,employmentId) as {value_json:string}|undefined;
return row?Person.parse(JSON.parse(row.value_json)):undefined;
}
 function people(id:string):Person[] {return (db.prepare('SELECT value_json FROM employment_person WHERE employment_id=? ORDER BY rowid').all(id) as {value_json:string}[]).map(row=>Person.parse(JSON.parse(row.value_json)));
}
 function view(value:Employment):Result {return {kind:'employment',employment:value,people:people(value.id)};
}
 function failure(code:Extract<Result,{kind:'failure'}>['code'],current?:Employment|Person):Result{return current?{kind:'failure',code,current}:{kind:'failure',code};
}
 function changeEmployment(request:Extract<Request,{operation:'edit'|'end'|'reopen'}>):Result {
  const old=employment(request.id);
 if(!old)return failure('not_found');
if(old.revision!==request.expectedRevision)return failure('conflict',old);
  if(request.operation==='end'&&old.status!=='current'||request.operation==='reopen'&&old.status!=='historical')return failure('invalid_transition',old);
  const recordedAt=new Date().toISOString();
  const value:Employment=request.operation==='edit'?{...old,company:request.company,role:request.role,goal:request.goal,start:request.start,plannedEnd:request.plannedEnd,actualEnd:request.actualEnd,revision:old.revision+1,recordedAt}:request.operation==='end'?{...old,status:'historical',actualEnd:request.actualEnd,revision:old.revision+1,recordedAt}:{...old,status:'current',actualEnd:{kind:'unknown'},revision:old.revision+1,recordedAt};
  if(invalidDates(value.start,value.actualEnd)||value.status==='current'&&value.actualEnd.kind!=='unknown')return failure('invalid_transition',old);
  db.prepare('UPDATE employment_current SET revision=?,value_json=? WHERE id=?').run(value.revision,JSON.stringify(value),value.id);
  const history={revision:value.revision,action:request.operation==='edit'?'edited':request.operation==='end'?'ended':'reopened',mode:request.mode,reason:request.reason,occurredAt:request.occurredAt,recordedAt,employment:value};
  db.prepare('INSERT INTO employment_history VALUES (?,?,?)').run(value.id,value.revision,JSON.stringify(history));
return view(value);
 }
 function dispatch(request:Request):Result {
  switch(request.operation) {
   case 'list':return {kind:'list',employments:(db.prepare('SELECT value_json FROM employment_current ORDER BY rowid').all() as {value_json:string}[]).map(row=>Employment.parse(JSON.parse(row.value_json)))};
   case 'read':{const value=employment(request.id);
return value?view(value):failure('not_found');
}
   case 'create':{
    // A known future start cannot represent employment that has actually begun.
    if(future(request.start))return failure('invalid_transition');
    const value:Employment={id:randomUUID(),revision:1,company:request.company,role:request.role,goal:request.goal,start:request.start,plannedEnd:request.plannedEnd,actualEnd:{kind:'unknown'},status:'current',recordedAt:new Date().toISOString()};
    db.prepare('INSERT INTO employment_current VALUES (?,?,?)').run(value.id,1,JSON.stringify(value));
    db.prepare('INSERT INTO employment_history VALUES (?,?,?)').run(value.id,1,JSON.stringify({revision:1,action:'created',mode:'record',reason:'确认真实任职',occurredAt:value.start,recordedAt:value.recordedAt,employment:value}));
return view(value);
   }
   case 'edit':case 'end':case 'reopen':return changeEmployment(request);
   case 'history':return employment(request.id)?{kind:'history',history:(db.prepare('SELECT value_json FROM employment_history WHERE employment_id=? ORDER BY revision').all(request.id) as {value_json:string}[]).map(row=>JSON.parse(row.value_json))}:failure('not_found');
   case 'person.create':{
    if(!employment(request.employmentId))return failure('not_found');
const value:Person={id:randomUUID(),employmentId:request.employmentId,name:request.name,role:request.role,revision:1,recordedAt:new Date().toISOString()};
    db.prepare('INSERT INTO employment_person VALUES (?,?,?,?)').run(value.id,value.employmentId,1,JSON.stringify(value));
    db.prepare('INSERT INTO employment_person_history VALUES (?,?,?)').run(value.id,1,JSON.stringify({revision:1,mode:'record',reason:'用户确认人物身份',occurredAt:request.occurredAt,recordedAt:value.recordedAt,person:value}));
return {kind:'person',person:value};
   }
   case 'person.edit':{
    const old=person(request.id,request.employmentId);
if(!old)return failure('not_found');
if(old.revision!==request.expectedRevision)return failure('conflict',old);
    const value:Person={...old,name:request.name,role:request.role,revision:old.revision+1,recordedAt:new Date().toISOString()};
    db.prepare('UPDATE employment_person SET revision=?,value_json=? WHERE id=?').run(value.revision,JSON.stringify(value),value.id);
    db.prepare('INSERT INTO employment_person_history VALUES (?,?,?)').run(value.id,value.revision,JSON.stringify({revision:value.revision,mode:request.mode,reason:request.reason,occurredAt:request.occurredAt,recordedAt:value.recordedAt,person:value}));
return {kind:'person',person:value};
   }
   case 'person.history':return person(request.id,request.employmentId)?{kind:'person.history',history:(db.prepare('SELECT value_json FROM employment_person_history WHERE person_id=? ORDER BY revision').all(request.id) as {value_json:string}[]).map(row=>JSON.parse(row.value_json))}:failure('not_found');
   case 'receipt':{const result=commandReceipt(db,'employment',request.commandId);
return result===undefined?{kind:'not_recorded'}:Result.parse(result);
}
  }
 }
 return {
  handle(input:unknown):Result {const parsed=Request.safeParse(input);
if(!parsed.success)return failure('invalid_input');
const request=parsed.data;
try {return Result.parse('commandId' in request&&request.operation!=='receipt'?executeCommand(db,'employment',request.commandId,request,()=>Result.parse(dispatch(request))):dispatch(request));
}catch(error){return failure(error instanceof Error&&error.message==='conflict'?'conflict':'storage_error');
}},
  resolveEmployment(id:string):EmploymentRelation|undefined {const value=employment(id);
return value?EmploymentRelation.parse({id:value.id,company:value.company,role:value.role,status:value.status,revision:value.revision}):undefined;
},
  resolvePerson(id:string,employmentId:string):PersonRelation|undefined {const value=person(id,employmentId);
return value?PersonRelation.parse({id:value.id,employmentId:value.employmentId,name:value.name,role:value.role,revision:value.revision}):undefined;
},
 };
}

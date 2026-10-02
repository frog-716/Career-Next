import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {Company,CompanyRequest,Result} from '../../../../contracts/opportunity/schema';
import {executeCommand} from '../../../platform/commands/receipts';
export const companyMigration=`CREATE TABLE opportunity_company(id TEXT PRIMARY KEY,revision INTEGER NOT NULL,name TEXT NOT NULL);
CREATE TABLE opportunity_company_history(company_id TEXT NOT NULL REFERENCES opportunity_company(id),revision INTEGER NOT NULL,name TEXT NOT NULL,PRIMARY KEY(company_id,revision));`;
export function createCompanyDomain(db:Database.Database){
 function resolveCompany(id:string):Company|undefined{const row=db.prepare('SELECT id,name,revision FROM opportunity_company WHERE id=?').get(id);return row?Company.parse(row):undefined;}
 function handle(input:CompanyRequest):Result{
  const request=CompanyRequest.parse(input);
  if(request.operation==='company.list')return Result.parse({kind:'companies',items:db.prepare('SELECT id,name,revision FROM opportunity_company ORDER BY rowid DESC LIMIT 500').all()});
  return executeCommand(db,'opportunity',request.commandId,request,()=>{
   let company:Company;
   if(request.operation==='company.create'){company={id:randomUUID(),name:request.name,revision:1};db.prepare('INSERT INTO opportunity_company VALUES (?,?,?)').run(company.id,1,company.name);}
   else{const old=resolveCompany(request.id);if(!old)throw Error('not_found');if(old.revision!==request.expectedRevision)throw Error('conflict');company={...old,name:request.name,revision:old.revision+1};db.prepare('UPDATE opportunity_company SET revision=?,name=? WHERE id=?').run(company.revision,company.name,company.id);}
   db.prepare('INSERT INTO opportunity_company_history VALUES (?,?,?)').run(company.id,company.revision,company.name);
   return Result.parse({kind:'company',company});
  });
 }
 return {handle,resolveCompany};
}

import {it,expect} from 'vitest';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {Request} from '../packages/contracts/opportunity/offer/schema';
import {createOfferDomain} from '../packages/backend/domains/opportunity/offer/public';
import {createOpportunityDomain} from '../packages/backend/domains/opportunity/public';
import {opportunityMigration} from '../packages/backend/domains/opportunity/migration';
import {offerMigration} from '../packages/backend/domains/opportunity/offer/migration';
import {commandMigration} from '../packages/backend/platform/commands/receipts';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
it('renderer cannot assert accepted/result, inject source text, guess dates or mutate another module',()=>{
 expect(Request.safeParse({operation:'offer.accept',commandId:randomUUID(),opportunityId:randomUUID(),expectedOpportunityRevision:1,expectedRevision:1,businessTime:{kind:'unknown'},reason:'Reality',historical:false,previousValid:true}).success).toBe(false);
 expect(Request.safeParse({operation:'offer.set-result',result:'accepted'}).success).toBe(false);
 const db=new Database(':memory:');db.exec(commandMigration);db.exec(opportunityMigration);db.exec(offerMigration);const opportunity=createOpportunityDomain(db);const company=opportunity.handle({operation:'company.create',commandId:randomUUID(),name:'Boundary'});if(company.kind!=='company')throw Error('fixture');const created=opportunity.handle({operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'Role'});if(created.kind!=='opportunity')throw Error('fixture');const owner=createOfferDomain(db,{core:opportunity.capabilities,validateSource:()=>({status:'unavailable'})});
 try{
 expect(owner.handle({operation:'end',commandId:randomUUID(),id:created.opportunity.id,expectedRevision:1,outcome:'accepted',reason:'bypass',businessTime:{kind:'unknown'}})).toEqual({kind:'failure',code:'invalid_request'});
 expect(owner.handle({operation:'offer.read',opportunityId:created.opportunity.id,result:'accepted'})).toEqual({kind:'failure',code:'invalid_request'});
 expect(opportunity.handle({operation:'read',id:created.opportunity.id})).toMatchObject({kind:'opportunity',opportunity:{phase:'preparation',result:'active',revision:1}});
 }finally{db.close();}
});
it('both axes import only contracts/platform or injected public capabilities, never private siblings, core SQL or second accepted truth',async()=>{
 const backend=path.resolve('packages/backend/domains/opportunity/offer');const frontend=path.resolve('packages/frontend/features/opportunity/offer');
 for(const filename of await readdir(backend)){const source=await readFile(path.join(backend,filename),'utf8');expect(source).not.toMatch(/from\s+['"][^'"]*(?:opportunity\/(?:core|company|interview|research)|\.\.\/(?:core|company|interview|research)|frontend)/);expect(source).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+(?:opportunity_core|opportunity_company|opportunity_interview|opportunity_research)\b/i);expect(source).not.toMatch(/accepted\s*:\s*(?:true|false)|accepted\s+INTEGER/i);}
 for(const filename of await readdir(frontend)){const source=await readFile(path.join(frontend,filename),'utf8');expect(source).not.toMatch(/from\s+['"][^'"]*(?:backend|node:|interview|research|core)/);expect(source).not.toMatch(/window\.(?:require|process)|\.prepare\(/);}
});

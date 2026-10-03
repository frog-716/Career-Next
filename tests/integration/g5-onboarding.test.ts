import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {createOpportunityDomain} from '../../packages/backend/domains/opportunity/public';
import {opportunityMigration} from '../../packages/backend/domains/opportunity/migration';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';
it('J-01: missing JD remains absent, later JD belongs to the same opportunity without manufacturing an event',()=>{
 const db=new Database(':memory:');try{db.exec(commandMigration+opportunityMigration);const domain=createOpportunityDomain(db);
 const company=domain.handle({operation:'company.create',commandId:randomUUID(),name:'G5 controlled company'});if(company.kind!=='company')throw Error('company');
 const opened=domain.handle({operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'Engineer'});if(opened.kind!=='opportunity')throw Error('opportunity');
 expect(opened.opportunity).not.toHaveProperty('jd');const intent={operation:'save-jd',commandId:randomUUID(),id:opened.opportunity.id,expectedRevision:1,jd:'岗位负责本地桌面开发',reason:'补充招聘方提供的 JD',businessTime:{kind:'unknown'}};
 const saved=domain.handle(intent);expect(saved).toMatchObject({kind:'opportunity',opportunity:{id:opened.opportunity.id,jd:intent.jd,phase:'preparation',result:'active',revision:2}});expect(domain.handle(intent)).toEqual(saved);
 expect(domain.handle({...intent,commandId:randomUUID(),jd:'stale overwrite'})).toEqual({kind:'failure',code:'conflict'});
 expect(domain.handle({operation:'history',id:opened.opportunity.id})).toMatchObject({kind:'history',items:[{type:'jd_updated',jd:intent.jd},{type:'created'}]});
 }finally{db.close();}
});

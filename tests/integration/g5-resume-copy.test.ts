import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {createResumeDomain,resumeMigration} from '../../packages/backend/domains/resume/public';
import {createProfileDomain,profileMigration} from '../../packages/backend/domains/profile/public';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';
it('DM-22: explicitly copy ordinary version content into another current Resume without copying its identity, frozen PDF or source ownership',()=>{
 const db=new Database(':memory:');try{db.exec(commandMigration+profileMigration+resumeMigration);const profile=createProfileDomain(db);const owner=createResumeDomain(db,{profile,resolveOpportunity:id=>({id,companyName:'Fixture company',role:'Engineer'})});
 const first=owner.handle({operation:'resume.open',commandId:randomUUID(),opportunityId:randomUUID()}),second=owner.handle({operation:'resume.open',commandId:randomUUID(),opportunityId:randomUUID()});if(first.status!=='document'||second.status!=='document')throw Error('open');
 const content=structuredClone(first.document.content);content.sections[0].blocks=[{id:randomUUID(),type:'paragraph',spans:[{text:'Content A',marks:[]}]}];owner.handle({operation:'resume.save',commandId:randomUUID(),resumeId:first.document.id,expectedRevision:1,expectedProfileRevision:0,content});
 const versionId=randomUUID();owner.prepareVersion({operation:'resume.name-version',commandId:versionId,resumeId:first.document.id,expectedRevision:2,expectedProfileRevision:0,name:'Ordinary A'});const version=owner.completeVersion(versionId,{blobId:randomUUID(),digest:'a'.repeat(64),size:100},()=>{});if(version.status!=='version')throw Error('version');
 const intent={operation:'resume.copy-version',commandId:randomUUID(),resumeId:second.document.id,versionId,expectedRevision:1,expectedProfileRevision:0};const copied=owner.handle(intent);expect(copied).toMatchObject({status:'document',document:{id:second.document.id,opportunityId:second.document.opportunityId,revision:2}});if(copied.status!=='document')throw Error('copy failed');expect(copied.document.content.sections[0].blocks[0]).toMatchObject({spans:[{text:'Content A'}]});expect(copied.document.content.sections[0].id).not.toBe(content.sections[0].id);expect(owner.handle(intent)).toEqual(copied);
 expect(owner.handle({operation:'resume.versions',resumeId:second.document.id})).toEqual({status:'versions',versions:[]});expect(owner.handle({operation:'resume.version',resumeId:first.document.id,versionId})).toEqual(version);
 expect(owner.handle({...intent,commandId:randomUUID()})).toMatchObject({status:'conflict'});
 const exportId=randomUUID();owner.prepareVersion({operation:'resume.export',commandId:exportId,resumeId:first.document.id,expectedRevision:2,expectedProfileRevision:0});owner.completeVersion(exportId,{blobId:randomUUID(),digest:'b'.repeat(64),size:100},()=>{});
 expect(owner.handle({...intent,commandId:randomUUID(),expectedRevision:2,versionId:exportId})).toMatchObject({status:'failure',code:'invalid-request'});
 }finally{db.close();}
});

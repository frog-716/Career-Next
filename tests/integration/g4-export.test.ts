import {expect,it} from 'vitest';import Database from 'better-sqlite3';import {randomUUID} from 'node:crypto';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';import {createResumeDomain,resumeMigration} from '../../packages/backend/domains/resume/public';import {createProfileDomain,profileMigration} from '../../packages/backend/domains/profile/public';
it('unnamed export freezes A and current Profile without forcing a named version; subsequent B cannot change it',()=>{
 const db=new Database(':memory:');db.exec(commandMigration+profileMigration+resumeMigration);try{const profile=createProfileDomain(db),opportunityId=randomUUID();profile.handle({operation:'profile.save',commandId:randomUUID(),expectedRevision:0,name:'G4',contact:'A',links:[]});
 const resume=createResumeDomain(db,{profile,resolveOpportunity:id=>id===opportunityId?{id,companyName:'fixture',role:'G4'}:undefined});const opened=resume.handle({operation:'resume.open',commandId:randomUUID(),opportunityId});if(opened.status!=='document')throw Error();
 const commandId=randomUUID();const pending=resume.prepareVersion({operation:'resume.export',commandId,resumeId:opened.document.id,expectedRevision:1,expectedProfileRevision:1});expect(pending.status).toBe('pending-job');if(pending.status!=='pending-job')throw Error();
 const newer=structuredClone(opened.document.content);newer.sections[0].title='B';expect(resume.handle({operation:'resume.save',commandId:randomUUID(),resumeId:opened.document.id,expectedRevision:1,expectedProfileRevision:1,content:newer}).status).toBe('document');
 profile.handle({operation:'profile.save',commandId:randomUUID(),expectedRevision:1,name:'G4',contact:'B',links:[]});
 const artifact={blobId:randomUUID(),digest:'a'.repeat(64),size:10};const completed=resume.completeVersion(commandId,artifact,()=>{});expect(completed).toMatchObject({status:'version',version:{kind:'export',name:'',snapshot:{resumeRevision:1,profileRevision:1,profile:{contact:'A'}}}});if(completed.status!=='version')throw Error();
 expect(completed.version.snapshot.content.sections[0].title).toBe('个人简介');expect(resume.resolveFrozenVersion(commandId)?.pdf).toEqual(artifact);
 }finally{db.close();}
});

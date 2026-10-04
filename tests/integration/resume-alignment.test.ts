import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {randomUUID,createHash} from 'node:crypto';
import {createResumeDomain,resumeMigration} from '../../packages/backend/domains/resume/public';
import {createProfileDomain,profileMigration} from '../../packages/backend/domains/profile/public';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';
import {validateCandidate} from '../../packages/backend/domains/resume/candidate-validation';
import {Snapshot} from '../../packages/contracts/resume/schema';

it('formal Resume text Apply preserves existing alignment and freezes it in a named version',()=>{
 const db=new Database(':memory:');db.exec(commandMigration+profileMigration+resumeMigration);
 try{
  const owner=createResumeDomain(db,{profile:createProfileDomain(db),resolveOpportunity:id=>({id,companyName:'TEST',role:'TEST'})});
  const opened=owner.handle({operation:'resume.open',commandId:randomUUID(),opportunityId:randomUUID()});if(opened.status!=='document')throw Error('open');
  const content=structuredClone(opened.document.content);content.layout.identityNameAlignment='center';const block=content.sections[0].blocks[0];if(block.type!=='paragraph')throw Error('paragraph');block.alignment='center';block.spans=[{text:'原中文 TEST',marks:[{type:'bold'},{type:'italic'}]}];
  expect(owner.handle({operation:'resume.save',commandId:randomUUID(),resumeId:opened.document.id,expectedRevision:1,expectedProfileRevision:0,content}).status).toBe('document');
  const dependency=owner.blockDependency(opened.document.id,block.id)!;
  const applied=owner.applyBlockProposal({commandId:randomUUID(),resumeId:opened.document.id,blockId:block.id,expectedDigest:dependency.digest,after:{...block,alignment:'right',spans:[{text:'AI TEST 修改',marks:[]}]}});
  expect(applied.status).toBe('document');
  if(applied.status!=='document')throw Error('apply');expect(applied.document.content.layout.identityNameAlignment).toBe('center');expect(applied.document.content.sections[0].blocks[0]).toMatchObject({alignment:'center',spans:[{text:'AI TEST 修改'}]});
  const anchor=owner.blockDependency(opened.document.id,block.id)!;
  const inserted=owner.applyBlockProposal({commandId:randomUUID(),resumeId:opened.document.id,blockId:block.id,action:'insert',expectedDigest:anchor.anchorDigest,after:{id:randomUUID(),type:'paragraph',alignment:'right',spans:[{text:'Inserted TEST',marks:[]}]}});
  if(inserted.status!=='document')throw Error('insert');expect(inserted.document.content.sections[0].blocks[1]).toMatchObject({alignment:'center'});
  applied.document=inserted.document;
  const commandId=randomUUID();const prepared=owner.prepareVersion({operation:'resume.name-version',commandId,resumeId:opened.document.id,expectedRevision:applied.document.revision,expectedProfileRevision:0,name:'Alignment TEST'});if(prepared.status!=='pending-job')throw Error('version');
  expect(prepared.job.content.layout.identityNameAlignment).toBe('center');
  const completed=owner.completeVersion(commandId,{blobId:randomUUID(),digest:'a'.repeat(64),size:100},()=>{});if(completed.status!=='version')throw Error('complete');
  const later=structuredClone(applied.document.content);later.layout.identityNameAlignment='left';const para=later.sections[0].blocks[0];if(para.type==='paragraph')para.alignment='left';
  owner.handle({operation:'resume.save',commandId:randomUUID(),resumeId:opened.document.id,expectedRevision:applied.document.revision,expectedProfileRevision:0,content:later});
  const history=owner.handle({operation:'resume.version',resumeId:opened.document.id,versionId:commandId});if(history.status!=='version')throw Error('history');expect(history.version.snapshot.content.layout.identityNameAlignment).toBe('center');expect(history.version.snapshot.content.sections[0].blocks[0]).toMatchObject({alignment:'center'});
 }finally{db.close();}
});

it('AI list rewrites keep item alignment and reject identity changes that would lose layout atomically',()=>{
 const db=new Database(':memory:');db.exec(commandMigration+profileMigration+resumeMigration);
 try{
  const owner=createResumeDomain(db,{profile:createProfileDomain(db),resolveOpportunity:id=>({id,companyName:'TEST',role:'TEST'})});
  const opened=owner.handle({operation:'resume.open',commandId:randomUUID(),opportunityId:randomUUID()});if(opened.status!=='document')throw Error('open');
  const content=structuredClone(opened.document.content);const id=content.sections[0].blocks[0].id;
  const list={id,type:'bullet-list' as const,items:[{id:randomUUID(),paragraphId:randomUUID(),alignment:'center' as const,spans:[{text:'LIST TEST',marks:[]}]}]};
  content.sections[0].blocks[0]=list;
  owner.handle({operation:'resume.save',commandId:randomUUID(),resumeId:opened.document.id,expectedRevision:1,expectedProfileRevision:0,content});
  const dependency=owner.blockDependency(opened.document.id,id)!;
  const rewritten=owner.applyBlockProposal({commandId:randomUUID(),resumeId:opened.document.id,blockId:id,expectedDigest:dependency.digest,after:{...list,items:[{...list.items[0],alignment:'right',spans:[{text:'AI LIST TEST',marks:[]}]}]}});
  if(rewritten.status!=='document')throw Error('rewrite');
  expect(rewritten.document.content.sections[0].blocks[0]).toMatchObject({items:[{alignment:'center',spans:[{text:'AI LIST TEST'}]}]});
  const current=owner.blockDependency(opened.document.id,id)!;
  const rejectedCommand=randomUUID();
  expect(()=>owner.applyBlockProposal({commandId:rejectedCommand,resumeId:opened.document.id,blockId:id,expectedDigest:current.digest,after:{...list,items:[{...list.items[0],id:randomUUID()}]}})).toThrow('alignment-preservation-required');
  expect(owner.blockDependency(opened.document.id,id)!.doc).toEqual(rewritten.document);
  expect(db.prepare('SELECT 1 FROM platform_commands WHERE command_id=?').get(rejectedCommand)).toBeUndefined();
  expect(()=>owner.applyBlockProposal({commandId:randomUUID(),resumeId:opened.document.id,blockId:id,expectedDigest:current.digest,after:{id,type:'paragraph',spans:[{text:'CONVERT TEST',marks:[]}]}})).toThrow('alignment-preservation-required');
 }finally{db.close();}
});

it('existing v1 documents and print-1 snapshots keep their original hashes without injecting left defaults',()=>{
 const db=new Database(':memory:');db.exec(commandMigration+profileMigration+resumeMigration);
 try{
  const owner=createResumeDomain(db,{profile:createProfileDomain(db),resolveOpportunity:id=>({id,companyName:'TEST',role:'TEST'})});
  const opened=owner.handle({operation:'resume.open',commandId:randomUUID(),opportunityId:randomUUID()});if(opened.status!=='document')throw Error('open');
  const id=randomUUID();const old={id,resumeId:opened.document.id,opportunityId:opened.document.opportunityId,resumeRevision:1,profileRevision:0,content:opened.document.content,profile:opened.profile,contentHash:createHash('sha256').update(JSON.stringify({content:opened.document.content,profile:opened.profile})).digest('hex'),templateVersion:'a4-basic-1',fontVersion:'legacy-test',engineVersion:'legacy-test',rendererVersion:'career-print-1',recordedAt:'2026-10-04T00:00:00.000Z'};
  const version={id,resumeId:opened.document.id,name:'Old TEST version',snapshot:old,pdf:{blobId:randomUUID(),digest:'a'.repeat(64),size:100},recordedAt:old.recordedAt};
  // A pre-existing snapshot fixture, not a production import or migration execution.
  db.prepare('INSERT INTO resume_versions VALUES(?,?,?)').run(id,opened.document.id,JSON.stringify(version));
  expect(Snapshot.parse(old)).toEqual(old);expect(()=>validateCandidate(db)).not.toThrow();
  expect(owner.handle({operation:'resume.version',resumeId:opened.document.id,versionId:id})).toEqual({status:'version',version});
 }finally{db.close();}
});

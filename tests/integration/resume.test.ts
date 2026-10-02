import { it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync,writeFileSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { createResumeDomain as createResume, resumeMigration } from '../../packages/backend/domains/resume/public';
import {createProfileDomain,profileMigration} from '../../packages/backend/domains/profile/public';
import {Request as ProfileRequest} from '../../packages/contracts/profile/schema';
import { commandMigration } from '../../packages/backend/platform/commands/receipts';

function createResumeDomain(db:Database.Database,dependencies:{resolveOpportunity(id:string):{id:string;companyName:string;role:string}|undefined}){const profile=createProfileDomain(db);const resume=createResume(db,{...dependencies,profile});return {...resume,handle(input:unknown){return ProfileRequest.safeParse(input).success?profile.handle(input):resume.handle(input);}};}

it('current Resume composes sole current Profile, survives reopening and guards dirty identity', () => {
 const root=mkdtempSync(path.join(tmpdir(),'career-resume-'));
 let db=new Database(path.join(root,'career.sqlite'));
 try {
  db.exec(commandMigration+profileMigration+resumeMigration);
  const opportunityId=randomUUID();
  const dependencies={resolveOpportunity:(id:string)=>id===opportunityId?{id,companyName:'Example',role:'Engineer'}:undefined};
  let domain=createResumeDomain(db,dependencies);
  let profile=domain.handle({operation:'profile.read'});
  expect(profile.status).toBe('profile');
  const saved=domain.handle({operation:'profile.save',commandId:randomUUID(),expectedRevision:0,name:'蒸牛蛙',contact:'hello@example.test',links:[]});
  expect(saved.status).toBe('profile');
  const opened=domain.handle({operation:'resume.open',commandId:randomUUID(),opportunityId});
  expect(opened.status).toBe('document');
  if(opened.status!=='document') throw new Error('open failed');
  expect(opened.profile.name).toBe('蒸牛蛙');
  expect(domain.handle({operation:'profile.save',commandId:randomUUID(),expectedRevision:0,name:'stale',contact:'',links:[]})).toMatchObject({status:'conflict',profile:{name:'蒸牛蛙'}});
  db.close(); db=new Database(path.join(root,'career.sqlite')); domain=createResumeDomain(db,dependencies);
  expect(domain.handle({operation:'resume.read',resumeId:opened.document.id})).toMatchObject({status:'document',profile:{name:'蒸牛蛙'}});
 } finally {db.close();rmSync(root,{recursive:true,force:true});}
});

it('autosave creates no version; named version freezes original revisions and PDF; restore never rewinds Profile',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'career-resume-version-')); const db=new Database(path.join(root,'career.sqlite'));
 try{
  db.exec(commandMigration+profileMigration+resumeMigration); const opportunityId=randomUUID();const domain=createResumeDomain(db,{resolveOpportunity:id=>({id,companyName:'Example',role:'Engineer'})});
  domain.handle({operation:'profile.save',commandId:randomUUID(),expectedRevision:0,name:'当时姓名',contact:'old@example.test',links:[]});
  const opened=domain.handle({operation:'resume.open',commandId:randomUUID(),opportunityId});if(opened.status!=='document')throw new Error('open failed');
  const content=structuredClone(opened.document.content);content.sections[0].blocks=[{id:randomUUID(),type:'paragraph',spans:[{text:'冻结的正文',marks:[]}]}];
  const saved=domain.handle({operation:'resume.save',commandId:randomUUID(),resumeId:opened.document.id,expectedRevision:1,expectedProfileRevision:1,content});expect(saved.status).toBe('document');
  expect(domain.handle({operation:'resume.versions',resumeId:opened.document.id})).toEqual({status:'versions',versions:[]});
  const commandId=randomUUID();const naming={operation:'resume.name-version',commandId,resumeId:opened.document.id,expectedRevision:2,expectedProfileRevision:1,name:'初版'};
  const prepared=domain.prepareVersion(naming);expect(prepared.status).toBe('pending-job');
  expect(domain.handle({operation:'resume.versions',resumeId:opened.document.id})).toEqual({status:'versions',versions:[]});
  domain.handle({operation:'profile.save',commandId:randomUUID(),expectedRevision:1,name:'当前姓名',contact:'new@example.test',links:[]});
  expect(domain.prepareVersion(naming)).toEqual(prepared);
  const blobId=randomUUID();const bytes=Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids [3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox [0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');writeFileSync(path.join(root,blobId),bytes);const frozenBytes=readFileSync(path.join(root,blobId));const pdf={blobId,digest:createHash('sha256').update(frozenBytes).digest('hex'),size:frozenBytes.length};
  const completed=domain.completeVersion(commandId,pdf,()=>{});expect(completed.status).toBe('version');
  if(completed.status!=='version')throw new Error('version failed');
  expect(completed.version.snapshot.profile.contact).toBe('old@example.test');expect(completed.version.pdf).toEqual(pdf);
  expect(domain.completeVersion(commandId,pdf,()=>{throw new Error('must not repeat retention');})).toEqual(completed);
  expect(domain.handle({operation:'resume.restore',commandId:randomUUID(),resumeId:opened.document.id,versionId:completed.version.id,expectedRevision:2,expectedProfileRevision:2})).toMatchObject({status:'document',profile:{name:'当前姓名',contact:'new@example.test'},document:{revision:3,content}});
  expect(domain.handle({operation:'resume.version',resumeId:opened.document.id,versionId:completed.version.id})).toEqual(completed);
  expect(domain.handle({operation:'resume.save',commandId:randomUUID(),resumeId:opened.document.id,expectedRevision:2,expectedProfileRevision:2,content})).toMatchObject({status:'conflict',document:{revision:3}});
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});

it('failed PDF completion remains failed after recovery and cannot masquerade as named version',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'career-resume-fail-'));const db=new Database(path.join(root,'career.sqlite'));
 try{db.exec(commandMigration+profileMigration+resumeMigration);const domain=createResumeDomain(db,{resolveOpportunity:id=>({id,companyName:'Example',role:'Engineer'})});const opened=domain.handle({operation:'resume.open',commandId:randomUUID(),opportunityId:randomUUID()});if(opened.status!=='document')throw new Error('open failed');
  const commandId=randomUUID();domain.prepareVersion({operation:'resume.name-version',commandId,resumeId:opened.document.id,expectedRevision:1,expectedProfileRevision:0,name:'unfinished'});
  domain.recoverPendingVersions();
  expect(domain.handle({operation:'resume.receipt',commandId})).toEqual({status:'failure',code:'pdf-failed'});
  expect(domain.handle({operation:'resume.versions',resumeId:opened.document.id})).toEqual({status:'versions',versions:[]});
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});

it('foreign version is not accessible and PDF retention failure rolls back completed version and receipt',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'career-resume-boundary-'));const db=new Database(path.join(root,'career.sqlite'));
 try{db.exec(commandMigration+profileMigration+resumeMigration);const domain=createResumeDomain(db,{resolveOpportunity:id=>({id,companyName:'Example',role:'Engineer'})});
  const first=domain.handle({operation:'resume.open',commandId:randomUUID(),opportunityId:randomUUID()});const second=domain.handle({operation:'resume.open',commandId:randomUUID(),opportunityId:randomUUID()});if(first.status!=='document'||second.status!=='document')throw new Error('open failed');
  const commandId=randomUUID();const input={operation:'resume.name-version',commandId,resumeId:first.document.id,expectedRevision:1,expectedProfileRevision:0,name:'first'};
  expect(domain.prepareVersion(input).status).toBe('pending-job');
  expect(domain.completeVersion(commandId,{blobId:randomUUID(),digest:'b'.repeat(64),size:100},()=>{throw new Error('hold no longer valid');})).toEqual({status:'failure',code:'storage-failed'});
  expect(domain.handle({operation:'resume.versions',resumeId:first.document.id})).toEqual({status:'versions',versions:[]});
  expect(domain.handle({operation:'resume.receipt',commandId}).status).toBe('pending-job');
  const completed=domain.completeVersion(commandId,{blobId:randomUUID(),digest:'c'.repeat(64),size:100},()=>{});expect(completed.status).toBe('version');
  expect(domain.handle({operation:'resume.version',resumeId:second.document.id,versionId:commandId})).toEqual({status:'not-found'});
  expect(domain.prepareVersion({...input,name:'reuse same command with different payload'}).status).toBe('conflict');
  expect(domain.failVersion(commandId)).toEqual(completed);
 }finally{db.close();rmSync(root,{recursive:true,force:true});}
});

import { afterEach, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { commandMigration } from '../../packages/backend/platform/commands/receipts';
import { createWikiDomain } from '../../packages/backend/domains/wiki/public';
import { wikiMigration } from '../../packages/backend/domains/wiki/migration';
const resources: {db: Database.Database; root:string}[]=[];
afterEach(()=>{for(const {db,root} of resources.splice(0)){db.close();rmSync(root,{recursive:true,force:true});}});
function setup(){const root=mkdtempSync(path.join(tmpdir(),'career-wiki-'));const db=new Database(path.join(root,'wiki.sqlite'));resources.push({db,root});db.pragma('foreign_keys = ON');db.exec(commandMigration);db.exec(wikiMigration);return createWikiDomain(db,{resolveSource:()=>undefined});}
it('DM-14 manual knowledge without source is a readable user statement, not verified truth',()=>{
 const wiki=setup();const created=wiki.handle({operation:'create',commandId:randomUUID(),title:'工作方法',body:'先确认问题，再做实验。',scope:'cognition',nature:'observation',sources:[]});
 expect(created.kind).toBe('knowledge');if(created.kind!=='knowledge')throw Error('creation failed');
 expect(wiki.handle({operation:'read',id:created.knowledge.id})).toEqual(created);
 expect(created.knowledge.recordedBy).toBe('user');expect(created.knowledge.verification).toBe('not_verified');
});
it('DM-15 exact retries and edits/retire/restore retain one identity and meaningful history',()=>{
 const wiki=setup();const create={operation:'create' as const,commandId:randomUUID(),title:'经验',body:'第一版',scope:'personal' as const,nature:'fact_statement' as const,sources:[]};
 const first=wiki.handle(create);expect(wiki.handle(create)).toEqual(first);if(first.kind!=='knowledge')throw Error('save failed');
 expect(wiki.handle({...create,body:'改过的重试'})).toEqual({kind:'failure',code:'conflict'});
 const edited=wiki.handle({...create,operation:'edit',commandId:randomUUID(),id:first.knowledge.id,expectedRevision:1,body:'第二版',reason:'修正表述',change:'corrected',businessTime:{kind:'unknown'}});
 expect(edited.kind).toBe('knowledge');if(edited.kind!=='knowledge')throw Error('edit failed');
 const lifecycle={operation:'lifecycle' as const,commandId:randomUUID(),id:first.knowledge.id,expectedRevision:2,action:'retire' as const,reason:'不再适用',businessTime:{kind:'unknown'},correction:false};
 const retired=wiki.handle(lifecycle);expect(retired.kind).toBe('knowledge');expect(wiki.handle({operation:'list'})).toEqual({kind:'list',items:[]});
 const restored=wiki.handle({...lifecycle,commandId:randomUUID(),expectedRevision:3,action:'restore',reason:'再次适用'});if(restored.kind!=='knowledge')throw Error('restore failed');
 expect(restored.knowledge.id).toBe(first.knowledge.id);expect(restored.knowledge.body).toBe('第二版');expect(restored.knowledge.revision).toBe(4);
 expect(wiki.handle({...create,operation:'edit',commandId:randomUUID(),id:first.knowledge.id,expectedRevision:1,reason:'stale',change:'edited',businessTime:{kind:'unknown'}}).kind).toBe('failure');
 const history=wiki.handle({operation:'history',id:first.knowledge.id});if(history.kind!=='history')throw Error('history failed');expect(history.items.map(item=>item.change)).toEqual(['restored','retired','corrected','created']);expect(history.items.at(-1)?.knowledge.body).toBe('第一版');
});
it('DM-13 validates the exact Materials owner/version/scope and never turns stale sources into another source',()=>{
 const wiki=setup();const source={owner:'materials',objectId:randomUUID(),revision:1,locator:'whole',scope:'personal'};
 const create={operation:'create',commandId:randomUUID(),title:'材料认识',body:'用户自己的理解',scope:'personal',nature:'fact_statement',sources:[{ref:source,purpose:'支持本句的原始陈述'}]};
 expect(wiki.handle(create)).toEqual({kind:'failure',code:'source_unavailable'});
 expect(wiki.handle({operation:'receipt',commandId:create.commandId})).toEqual({kind:'receipt_missing'});
 expect(wiki.handle({...create,sources:[{ref:{...source,revision:2},purpose:'unsupported'}]})).toEqual({kind:'failure',code:'invalid_request'});
});
it('DM-11/13 real Materials public Raw supports several Wiki expressions without copying the original',async()=>{
 const {writeFile}=await import('node:fs/promises');const {createMaterialsBackend}=await import('../../packages/backend/domains/materials/public');
 const root=mkdtempSync(path.join(tmpdir(),'career-wiki-source-'));const filename=path.join(root,'source.txt');await writeFile(filename,'原件只是作者当时说了什么，不代表已核实。');
 const backend=await createMaterialsBackend(path.join(root,'materials'),undefined,path.resolve('dist/application/writer.cjs'));
 try{
  const session=await backend.connectHuman();const preview=await backend.selectFile(session,filename);const receipt=await backend.confirm(session,{commandId:randomUUID(),importId:preview.importId,expectedRevision:1,digest:preview.digest});if(receipt.status!=='committed')throw Error('Material commit failed');const raw=await backend.resolveSource(session,receipt.source);
  const testRoot=mkdtempSync(path.join(tmpdir(),'career-wiki-linked-'));const db=new Database(path.join(testRoot,'wiki.sqlite'));resources.push({db,root:testRoot});db.exec(commandMigration);db.exec(wikiMigration);
  const {text:originalText,digest:originalDigest,...summary}=raw;
  const wiki=createWikiDomain(db,{resolveSource:ref=>ref.objectId===raw.id?summary:undefined});
  const intent={operation:'create',commandId:randomUUID(),title:'对原件的认识',body:'这是用户自己的理解。',scope:'personal',nature:'fact_statement',sources:[{ref:raw.source,purpose:'原件的陈述背景'}]};
  const created=wiki.handle(intent);if(created.kind!=='knowledge')throw Error('Wiki creation failed');expect(created.knowledge.body).toBe('这是用户自己的理解。');expect(created.knowledge.sources).toEqual([{ref:raw.source,purpose:'原件的陈述背景'}]);
  expect(wiki.handle({...intent,commandId:randomUUID(),title:'另一条认识',body:'同一个原件支持不同表达'}).kind).toBe('knowledge');
  expect(wiki.handle({...intent,operation:'edit',commandId:randomUUID(),id:created.knowledge.id,expectedRevision:1,body:'修正后的认识',reason:'只改认识',change:'corrected',businessTime:{kind:'unknown'}}).kind).toBe('knowledge');
  expect((await backend.read(session,raw.id)).text).toBe('原件只是作者当时说了什么，不代表已核实。');expect(await backend.list(session)).toHaveLength(1);
  expect(wiki.handle({...intent,commandId:randomUUID(),sources:[{ref:{...raw.source,objectId:randomUUID()},purpose:'不存在的原件'}]})).toEqual({kind:'failure',code:'source_unavailable'});
 }finally{await backend.close();rmSync(root,{recursive:true,force:true});}
});
it('saved knowledge, history and original command receipt survive reopening the real SQLite file',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'career-wiki-reopen-'));const filename=path.join(root,'wiki.sqlite');let db=new Database(filename);db.exec(commandMigration);db.exec(wikiMigration);let wiki=createWikiDomain(db,{resolveSource:()=>undefined});const intent={operation:'create',commandId:randomUUID(),title:'持久知识',body:'重启仍然读取这一正文',scope:'cognition',nature:'hypothesis',sources:[]};const first=wiki.handle(intent);if(first.kind!=='knowledge')throw Error('save failed');db.close();
 db=new Database(filename);resources.push({db,root});wiki=createWikiDomain(db,{resolveSource:()=>undefined});expect(wiki.handle({operation:'read',id:first.knowledge.id})).toEqual(first);expect(wiki.handle({operation:'receipt',commandId:intent.commandId})).toEqual(first);expect(wiki.handle(intent)).toEqual(first);const history=wiki.handle({operation:'history',id:first.knowledge.id});expect(history.kind==='history'?history.items.length:0).toBe(1);
});

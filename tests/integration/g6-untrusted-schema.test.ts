import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtemp,mkdir,rm,readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {openWorkspace} from '../../packages/backend/platform/database/database';
import {materialsMigration} from '../../packages/backend/domains/materials/migration';
import {releases} from '../../packages/backend/bootstrap/releases';
import {createWriterCommands} from '../../packages/backend/bootstrap/writer-commands';
import {ProductProposal,ProductResult} from '../../packages/contracts/ai/product';
import {Result as OpportunityResult} from '../../packages/contracts/opportunity/schema';
import {Result as DataResult} from '../../packages/contracts/application/schema';

async function fixture(version:number){
 const root=await mkdtemp(path.join(os.tmpdir(),'g6-untrusted-schema-')),active=path.join(root,'workspaces/local');await mkdir(active,{recursive:true});
 const workspace=await openWorkspace(active,materialsMigration,releases.filter(release=>release.version<=version));
 const commands=createWriterCommands(workspace.database,workspace.workspaceInstance,randomUUID(),{dataRoot:root,control:{maintenance:async work=>work(),drain:async()=>{},beforeActivate:async()=>{},closeWorkspace:()=>workspace.close()}}),session=commands.connect();
 const call=(module:Parameters<typeof commands.business>[1],input:unknown)=>commands.business(session,module,input);
 const company=OpportunityResult.parse(await call('opportunity',{operation:'company.create',commandId:randomUUID(),name:'Isolated schema fixture'}));if(company.kind!=='company')throw Error('company');
 const opportunity=OpportunityResult.parse(await call('opportunity',{operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'Controlled fixture'}));if(opportunity.kind!=='opportunity')throw Error('opportunity');
 const prepared=ProductResult.parse(await call('ai',{operation:'product.prepare',commandId:randomUUID(),input:{target:{kind:'greeting',opportunityId:opportunity.opportunity.id,includeName:false},sources:[],egressSourceIds:[],wikiIds:[],egressWikiIds:[],objects:[]},budget:{requests:1,inputBytes:524288,outputBytes:196608}}));if(prepared.kind!=='product_task')throw Error('task');
 const op=prepared.task.operations[0]!,proposal=ProductProposal.parse({id:randomUUID(),taskId:prepared.task.id,operationId:op.id,target:prepared.task.input!.target,change:{kind:'create',content:{title:'Isolated pending proposal',body:'Requires human acceptance',nature:'hypothesis'},reason:'Controlled fixture',citations:[],unknowns:[]},dependencies:op.productDependencies??[],sources:[],provenance:op.provenance,state:'pending',ignored:false,validity:'current'});
 const backup=DataResult.parse(await call('application',{operation:'data.backup'}));if(backup.kind!=='backup')throw Error(JSON.stringify(backup));
 const copy=path.join(root,backup.copy.relativePath),file=path.join(copy,'career.sqlite');
 return {root,active,workspace,call,opportunity:opportunity.opportunity,proposal,copy,file,backupId:backup.copy.id,async close(){workspace.close();await rm(root,{recursive:true,force:true});}};
}
async function changeSchema(f:Awaited<ReturnType<typeof fixture>>,mutate:(db:Database.Database)=>void,checkIntegrity=true){
 const db=new Database(f.file);try{const before=db.prepare('SELECT * FROM platform_migration_batches ORDER BY version').all(),fragments=db.prepare('SELECT * FROM platform_migration_fragments ORDER BY rowid').all();mutate(db);expect(db.prepare('SELECT * FROM platform_migration_batches ORDER BY version').all()).toEqual(before);expect(db.prepare('SELECT * FROM platform_migration_fragments ORDER BY rowid').all()).toEqual(fragments);if(checkIntegrity){expect(db.pragma('integrity_check',{simple:true})).toBe('ok');expect(db.pragma('foreign_key_check')).toEqual([]);}}finally{db.close();}
 const manifest=JSON.parse(await readFile(path.join(f.copy,'backup.json'),'utf8'));manifest.databaseDigest=createHash('sha256').update(await readFile(f.file)).digest('hex');await writeFile(path.join(f.copy,'backup.json'),JSON.stringify(manifest));
}
async function expectRejected(f:Awaited<ReturnType<typeof fixture>>){
 const bytes=await readFile(f.file),manifest=await readFile(path.join(f.root,'managed-copies-manifest.json'));
 expect(await f.call('application',{operation:'data.restore.prepare',backupId:f.backupId})).toEqual({kind:'failure',code:'backup_schema_untrusted'});
 expect(await readFile(f.file)).toEqual(bytes);expect(await readFile(path.join(f.root,'managed-copies-manifest.json'))).toEqual(manifest);
 expect(await f.call('opportunity',{operation:'read',id:f.opportunity.id})).toMatchObject({kind:'opportunity',opportunity:{phase:'preparation',revision:1}});
}
it.each([5,6])('v%s rejects a rehashed registered backup with valid migration records and an executable proposal trigger',async version=>{
 const f=await fixture(version);try{
 await changeSchema(f,db=>db.exec("CREATE TRIGGER injected_proposal_reality AFTER INSERT ON ai_product_proposals BEGIN UPDATE opportunity_core SET content_json=json_set(content_json,'$.phase','offer'); END;"));
 // Demonstrate the actual attack on a disposable clone, never an active workspace.
 const clone=path.join(f.root,'attack-clone.sqlite');await copyFile(f.file,clone);const attacked=new Database(clone);try{attacked.pragma('foreign_keys=ON');attacked.prepare('INSERT INTO ai_product_proposals VALUES(?,?,?,?)').run(f.proposal.id,f.proposal.taskId,f.proposal.operationId,JSON.stringify(f.proposal));expect(attacked.prepare("SELECT json_extract(content_json,'$.phase') AS phase FROM opportunity_core WHERE id=?").get(f.opportunity.id)).toEqual({phase:'offer'});expect(attacked.prepare('SELECT data_json FROM ai_product_proposals WHERE id=?').get(f.proposal.id)).toEqual({data_json:JSON.stringify(f.proposal)});}finally{attacked.close();}
 await expectRejected(f);
 }finally{await f.close();}
},30000);

const mutations:[string,number,(db:Database.Database)=>void][]=[
 ['known table constraint replaced',5,db=>db.exec('DROP TABLE application_preferences;CREATE TABLE application_preferences(id INTEGER PRIMARY KEY,content_json TEXT NOT NULL);')],
 ['known table replaced by an empty view',5,db=>db.exec("DROP TABLE application_preferences;CREATE VIEW application_preferences AS SELECT 1 AS id,'{}' AS content_json WHERE 0;")],
 ['unknown view appended',5,db=>db.exec('CREATE VIEW injected_owner_projection AS SELECT * FROM opportunity_core;')],
 ['existing trigger replaced by an owner mutation',6,db=>{const row=db.prepare("SELECT sql FROM sqlite_schema WHERE name='wiki_search_insert'").get() as {sql:string};db.exec('DROP TRIGGER wiki_search_insert;'+row.sql.replace(' END'," UPDATE opportunity_core SET content_json=json_set(content_json,'$.phase','offer'); END"));}],
 ['quoted literal changed only in case',6,db=>{const row=db.prepare("SELECT sql FROM sqlite_schema WHERE name='wiki_search_insert'").get() as {sql:string};db.exec('DROP TRIGGER wiki_search_insert;'+row.sql.replace("'wiki'","'WIKI'"));}],
 ['FTS virtual table tokenizer replaced',6,db=>db.exec("DROP TABLE platform_local_search_fts;CREATE VIRTUAL TABLE platform_local_search_fts USING fts5(text,content='platform_local_search_chunks',content_rowid='rowid',tokenize='unicode61');")],
 ['FTS shadow table structure changed',6,db=>{const row=db.prepare("SELECT sql FROM sqlite_schema WHERE name='platform_local_search_fts_data'").get() as {sql:string};db.unsafeMode(true);db.pragma('writable_schema=ON');db.prepare("UPDATE sqlite_schema SET sql=? WHERE name='platform_local_search_fts_data'").run(row.sql.replace(/\)$/,',injected INTEGER)'));db.pragma('writable_schema=OFF');db.unsafeMode(false);db.pragma(`schema_version=${Number(db.pragma('schema_version',{simple:true}))+1}`);}],
 ['unknown trigger and undecodable business JSON',6,db=>db.exec("CREATE TRIGGER injected_unknown AFTER INSERT ON application_preferences BEGIN SELECT 1; END;UPDATE opportunity_core SET content_json='invalid JSON';")],
];
it.each(mutations)('restore rejects %s before candidate owner decoding',async(_name,version,mutate)=>{
 const f=await fixture(version);try{await changeSchema(f,mutate);await expectRejected(f);}finally{await f.close();}
},30000);
it.each([5,6])('v%s registered backup retains its legitimate complete schema and can prepare restore',async version=>{
 const f=await fixture(version);try{expect(await f.call('application',{operation:'data.restore.prepare',backupId:f.backupId})).toMatchObject({kind:'restore_candidate',copy:{state:'ready'}});}finally{await f.close();}
},30000);
it('normal keyword case / whitespace and SQLite-generated ANALYZE statistics remain compatible',async()=>{
 const f=await fixture(6);try{await changeSchema(f,db=>{const row=db.prepare("SELECT sql FROM sqlite_schema WHERE name='wiki_search_insert'").get() as {sql:string};db.exec('DROP TRIGGER wiki_search_insert;'+row.sql.replace('AFTER INSERT','after\n insert').replace('BEGIN','begin\n').replace('ON CONFLICT','on  conflict'));db.exec('ANALYZE');});expect(await f.call('application',{operation:'data.restore.prepare',backupId:f.backupId})).toMatchObject({kind:'restore_candidate',copy:{state:'ready'}});}finally{await f.close();}
},30000);
it('rejects executable artifact views before FK inspection or selecting any candidate artifact',async()=>{
 const f=await fixture(6);try{await changeSchema(f,db=>{db.pragma('foreign_keys=OFF');db.exec("DROP TABLE platform_blobs;CREATE VIEW platform_blobs AS SELECT 'not-a-blob' AS id,'' AS digest,abs(-9223372036854775808) AS size,'published' AS state;");},false);await expectRejected(f);}finally{await f.close();}
},30000);

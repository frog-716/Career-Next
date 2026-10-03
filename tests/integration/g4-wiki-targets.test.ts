import {expect,it} from 'vitest';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';
import {wikiMigration} from '../../packages/backend/domains/wiki/migration';
import {createWikiDomain} from '../../packages/backend/domains/wiki/public';
it('Wiki object targets bind an actual owner and AI adoption stays distinct from verification',()=>{
 const db=new Database(':memory:');db.exec(commandMigration+wikiMigration);const projectId=randomUUID();
 try{const wiki=createWikiDomain(db,{resolveSource:()=>undefined,validateScope:(scope,id)=>scope==='project'&&id===projectId||scope==='personal'||scope==='cognition'});
 const input={operation:'create',commandId:randomUUID(),title:'项目认识',body:'明确对象范围',scope:'project',scopeId:projectId,nature:'observation',sources:[]};
 expect(wiki.handle({...input,scopeId:randomUUID()})).toEqual({kind:'failure',code:'scope_unavailable'});
 expect(wiki.handle({...input,scopeId:undefined}).kind).toBe('failure');
 const adopted=wiki.applyProposal(input);expect(adopted).toMatchObject({scope:'project',scopeId:projectId,origin:'ai_accepted',verification:'not_verified'});
 expect(wiki.read(adopted.id)).toMatchObject({body:'明确对象范围',origin:'ai_accepted'});
 expect(wiki.handle({operation:'list'})).toMatchObject({kind:'list',items:[{scope:'project'}]});
 const opportunityId=randomUUID();const withScope=createWikiDomain(db,{resolveSource:()=>undefined,validateScope:()=>true});withScope.handle({...input,commandId:randomUUID(),scope:'opportunity',scopeId:opportunityId,title:'机会私有知识'});
 const list=wiki.handle({operation:'list'});expect(list.kind==='list'&&list.items.map(item=>item.title)).not.toContain('机会私有知识');
 }finally{db.close();}
});

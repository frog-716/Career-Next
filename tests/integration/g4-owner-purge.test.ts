import {expect,it} from 'vitest';import Database from 'better-sqlite3';import {randomUUID} from 'node:crypto';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';import {wikiMigration} from '../../packages/backend/domains/wiki/migration';import {createWikiDomain} from '../../packages/backend/domains/wiki/public';
it('owner purge clears meaningful history and body-bearing receipts while preventing command replay from restoring it',()=>{
 const db=new Database(':memory:');db.exec(commandMigration+wikiMigration);try{const wiki=createWikiDomain(db,{resolveSource:()=>undefined}),commandId=randomUUID();const input={operation:'create',commandId,title:'G4 sensitive',body:'PURGE_MARKER_NEVER_RETURN',scope:'personal',nature:'observation',sources:[]};const saved=wiki.handle(input);if(saved.kind!=='knowledge')throw Error();
 expect(wiki.purgeImpact(saved.knowledge.id)).toMatchObject({name:'G4 sensitive',revision:1});wiki.purge(saved.knowledge.id);
 expect(wiki.handle({operation:'read',id:saved.knowledge.id})).toEqual({kind:'failure',code:'not_found'});
 expect(wiki.handle(input)).toEqual({kind:'failure',code:'content_purged'});
 expect(wiki.handle({operation:'receipt',commandId})).toEqual({kind:'failure',code:'content_purged'});
 expect(wiki.handle({operation:'list'})).toEqual({kind:'list',items:[]});
 }finally{db.close();}
});

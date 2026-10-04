import {it,expect} from 'vitest';import Database from 'better-sqlite3';import {randomUUID} from 'node:crypto';
import {createSearchRuns,searchMigration} from '../../packages/backend/ai-runtime/search/public';import {commandMigration,commandReceipt} from '../../packages/backend/platform/commands/receipts';
it('purging a real SearchRun removes candidate text and redacts its actual external receipt namespace',()=>{
 const db=new Database(':memory:');try{db.exec(searchMigration+commandMigration);const search=createSearchRuns(db,()=>true),owner={kind:'company' as const,id:randomUUID()},id=randomUUID(),body='PUBLIC_CANDIDATE_TO_PURGE',result=search.recordExternal(owner,{id,recordedAt:new Date().toISOString(),response:{query:'OpenAI official website',results:[{title:'OpenAI',url:'https://openai.com/',content:body}]}});
 expect(result.run.results[0]!.body).toBe(body);search.purge(id);expect(search.read(id)).toBeUndefined();expect(commandReceipt(db,'ai.search.tavily',id)).toEqual({kind:'failure',code:'body_purged'});expect(JSON.stringify(db.prepare('SELECT result_json FROM platform_commands').all())).not.toContain(body);
 }finally{db.close();}
});

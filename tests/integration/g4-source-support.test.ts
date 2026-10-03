import {expect,it} from 'vitest';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';
import {wikiMigration} from '../../packages/backend/domains/wiki/migration';
import {createWikiDomain} from '../../packages/backend/domains/wiki/public';
import {createInterviewDomain} from '../../packages/backend/domains/opportunity/interview/public';
import {interviewMigration} from '../../packages/backend/domains/opportunity/interview/migration';
import {createOpportunityDomain} from '../../packages/backend/domains/opportunity/public';
import {opportunityMigration} from '../../packages/backend/domains/opportunity/migration';
it('correctable Transcript retains owner identity and stales only related Wiki support without rewriting any body',()=>{
 const db=new Database(':memory:');db.exec(commandMigration+opportunityMigration+interviewMigration+wikiMigration);
 try{
 const opportunity=createOpportunityDomain(db);const company=opportunity.handle({operation:'company.create',commandId:randomUUID(),name:'G4 source fixture'});if(company.kind!=='company')throw Error();
 const o=opportunity.handle({operation:'create',commandId:randomUUID(),companyId:company.company.id,role:'owner'});if(o.kind!=='opportunity')throw Error();
 const interview=createInterviewDomain(db,{core:opportunity.capabilities});const confirmed=interview.handle({operation:'interview.confirm',commandId:randomUUID(),opportunityId:o.opportunity.id,expectedOpportunityRevision:1,title:'真人轮次',confirmationTime:{kind:'unknown'}});if(confirmed.kind!=='saved')throw Error();
 const id=confirmed.id;
 interview.handle({operation:'interview.save-document',commandId:randomUUID(),id,expectedRevision:1,document:'transcript',text:'独立负责'});
 const source=interview.resolveTranscript({owner:'interview',objectId:id,revision:1,locator:'transcript',scope:'opportunity',opportunityId:o.opportunity.id});expect(source?.text).toBe('独立负责');
 const wiki=createWikiDomain(db,{resolveSource:ref=>interview.resolveTranscript(ref)?.metadata});
 const created=wiki.handle({operation:'create',commandId:randomUUID(),title:'参与记录',body:'保留原有理解',scope:'personal',nature:'observation',sources:[{ref:source!.metadata.source,purpose:'本轮文字稿支持'}]});expect(created.kind).toBe('knowledge');if(created.kind!=='knowledge')throw Error();
 const unrelated=wiki.handle({operation:'create',commandId:randomUUID(),title:'无关',body:'独立知识',scope:'personal',nature:'observation',sources:[]});if(unrelated.kind!=='knowledge')throw Error();
 interview.handle({operation:'interview.save-document',commandId:randomUUID(),id,expectedRevision:2,document:'final-review',text:'用户结论保留'});
 interview.handle({operation:'interview.save-document',commandId:randomUUID(),id,expectedRevision:3,document:'transcript',text:'参与'});
 expect(interview.resolveTranscript(source!.metadata.source)?.text).toBeUndefined();
 const current=wiki.handle({operation:'read',id:created.knowledge.id});expect(current).toMatchObject({kind:'knowledge',knowledge:{body:'保留原有理解',revision:1,reviewRequired:true}});
 expect(wiki.handle({operation:'read',id:unrelated.knowledge.id})).toMatchObject({knowledge:{body:'独立知识',reviewRequired:false}});
 expect(interview.handle({operation:'interview.read',id})).toMatchObject({session:{finalReview:{text:'用户结论保留',needsRecheck:true}}});
 }finally{db.close();}
});

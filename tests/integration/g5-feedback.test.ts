import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';
import {createFeedback,feedbackMigration} from '../../packages/backend/application/feedback/public';
it('J-08: feedback is an independent durable owner; same receipt recovers unknown creation, append preserves history, archive is not purge',()=>{
 const db=new Database(':memory:');try{db.exec(commandMigration+feedbackMigration);let owner=createFeedback(db);
 const intent={operation:'feedback.create',commandId:randomUUID(),text:'候选框后焦点异常',location:{path:'/opportunity',version:'g5'}};
 const saved=owner.handle(intent);expect(saved).toMatchObject({kind:'feedback',feedback:{revision:1,archived:false,entries:[{text:intent.text}],location:intent.location}});if(saved.kind!=='feedback')throw Error('feedback');
 expect(owner.handle(intent)).toEqual(saved);expect(owner.handle({operation:'feedback.receipt',commandId:intent.commandId})).toEqual(saved);expect(owner.handle({operation:'feedback.list'})).toMatchObject({kind:'feedback_list',items:[{id:saved.feedback.id}]});
 owner=createFeedback(db);const appended=owner.handle({operation:'feedback.append',commandId:randomUUID(),id:saved.feedback.id,expectedRevision:1,text:'补充：命名弹窗取消后出现'});expect(appended).toMatchObject({kind:'feedback',feedback:{revision:2,entries:[{text:intent.text},{text:'补充：命名弹窗取消后出现'}]}});
 expect(owner.handle({operation:'feedback.archive',commandId:randomUUID(),id:saved.feedback.id,expectedRevision:1,archived:true})).toMatchObject({kind:'feedback_conflict'});
 const archive=owner.handle({operation:'feedback.archive',commandId:randomUUID(),id:saved.feedback.id,expectedRevision:2,archived:true});expect(archive).toMatchObject({kind:'feedback',feedback:{archived:true,revision:3}});
 const exported=owner.handle({operation:'feedback.export',id:saved.feedback.id});expect(exported.kind).toBe('feedback_export');if(exported.kind==='feedback_export')expect(JSON.parse(exported.text)).toMatchObject({entries:[{text:intent.text},{text:'补充：命名弹窗取消后出现'}],archived:true});
 owner.purge(saved.feedback.id);expect(owner.handle({operation:'feedback.read',id:saved.feedback.id})).toEqual({kind:'failure',code:'not_found'});expect(owner.handle({operation:'feedback.receipt',commandId:intent.commandId})).toEqual({kind:'failure',code:'content_purged'});
 }finally{db.close();}
});

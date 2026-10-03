import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {commandMigration} from '../../packages/backend/platform/commands/receipts';
import {createPreferences,preferencesMigration} from '../../packages/backend/application/preferences/public';
it('PR-03/UX-02: one durable homepage pin, clearing returns to Wiki and stale writes cannot silently replace it',()=>{
 const db=new Database(':memory:');try{db.exec(commandMigration+preferencesMigration);let owner=createPreferences(db);
 expect(owner.handle({operation:'preferences.read'})).toMatchObject({kind:'preferences',preferences:{revision:0,pinned:null}});
 const intent={operation:'preferences.pin',commandId:randomUUID(),expectedRevision:0,pinned:'project'};
 const saved=owner.handle(intent);expect(saved).toMatchObject({kind:'preferences',preferences:{revision:1,pinned:'project'}});expect(owner.handle(intent)).toEqual(saved);
 owner=createPreferences(db);expect(owner.handle({operation:'preferences.read'})).toEqual(saved);
 expect(owner.handle({...intent,commandId:randomUUID(),pinned:'employment'})).toMatchObject({kind:'preferences_conflict',preferences:{pinned:'project'}});
 expect(owner.handle({operation:'preferences.pin',commandId:randomUUID(),expectedRevision:1,pinned:null})).toMatchObject({kind:'preferences',preferences:{revision:2,pinned:null}});
 expect(owner.handle({operation:'preferences.pin',commandId:randomUUID(),expectedRevision:2,pinned:'feedback'})).toMatchObject({kind:'failure',code:'invalid_request'});
 }finally{db.close();}
});
it('UX-02: module order is durable, pin derives the first position and duplicate/unknown modules are rejected',()=>{
 const db=new Database(':memory:');try{db.exec(commandMigration+preferencesMigration);const owner=createPreferences(db),order=['employment','project','opportunity','wiki'];
 expect(owner.handle({operation:'preferences.reorder',commandId:randomUUID(),expectedRevision:0,order})).toMatchObject({kind:'preferences',preferences:{revision:1,order}});
 expect(owner.handle({operation:'preferences.reorder',commandId:randomUUID(),expectedRevision:1,order:['wiki','wiki','project','employment']})).toEqual({kind:'failure',code:'invalid_request'});
 expect(owner.handle({operation:'preferences.pin',commandId:randomUUID(),expectedRevision:1,pinned:'project'})).toMatchObject({kind:'preferences',preferences:{revision:2,pinned:'project',order}});
 }finally{db.close();}
});

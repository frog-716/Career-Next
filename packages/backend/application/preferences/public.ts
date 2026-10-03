import type Database from 'better-sqlite3';
import {Preferences,PreferencesRequest} from '../../../contracts/application/preferences';
import {executeCommand,commandReceipt} from '../../platform/commands/receipts';
export const preferencesMigration=`CREATE TABLE application_preferences(id INTEGER PRIMARY KEY CHECK(id=1),content_json TEXT NOT NULL);`;
export function createPreferences(db:Database.Database){
 function read(){const row=db.prepare('SELECT content_json FROM application_preferences WHERE id=1').get() as {content_json:string}|undefined;return row?Preferences.parse(JSON.parse(row.content_json)):{revision:0,pinned:null};}
 return {handle(input:unknown){const parsed=PreferencesRequest.safeParse(input);if(!parsed.success)return {kind:'failure' as const,code:'invalid_request'};try{const request=parsed.data;
 if(request.operation==='preferences.read')return {kind:'preferences' as const,preferences:read()};
 if(request.operation==='preferences.receipt')return commandReceipt(db,'application.preferences',request.commandId)??{kind:'receipt_missing' as const};
 return executeCommand(db,'application.preferences',request.commandId,request,()=>{const current=read();if(current.revision!==request.expectedRevision)return {kind:'preferences_conflict' as const,preferences:current};const preferences=Preferences.parse({revision:current.revision+1,pinned:request.pinned});db.prepare('INSERT INTO application_preferences VALUES(1,?) ON CONFLICT(id) DO UPDATE SET content_json=excluded.content_json').run(JSON.stringify(preferences));return {kind:'preferences' as const,preferences};});
 }catch{return {kind:'failure' as const,code:'storage_failed'};}}};
}
export function validatePreferencesCandidate(db:Database.Database){const rows=db.prepare('SELECT id,content_json FROM application_preferences').all() as {id:number;content_json:string}[];for(const row of rows)if(row.id!==1||!Preferences.safeParse(JSON.parse(row.content_json)).success)throw Error('backup_domain_invalid');}

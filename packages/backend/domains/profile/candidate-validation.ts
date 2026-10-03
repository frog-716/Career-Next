import type Database from 'better-sqlite3';
import {Profile} from '../../../contracts/profile/schema';
/** Restore validation reads only this owner's stored rows and never repairs them. */
export function validateCandidate(db:Database.Database):void {
 const rows=db.prepare('SELECT id,revision,body FROM profile_current').all() as {id:number;revision:number;body:string}[];
 if(rows.length!==1||rows[0].id!==1)throw Error('invalid_candidate');
 const value=JSON.parse(rows[0].body) as unknown;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['name','contact','links'].includes(key)))throw Error('invalid_candidate');
 Profile.parse({...value,revision:rows[0].revision});
}
export function candidateRelations(_db:Database.Database):{owner:string;objectId:string;kind:'object'|'source'}[]{return [];}

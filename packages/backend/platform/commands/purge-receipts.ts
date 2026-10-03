import type Database from 'better-sqlite3';
/** Owner supplies the identities and its own body-free contract result. Digests retain deduplication. */
export function redactOwnerReceipts(db:Database.Database,owner:string,ids:readonly string[],bodyFreeResult:unknown){
 const selected=new Set(ids);
 function references(value:unknown):boolean{if(typeof value==='string')return selected.has(value);if(Array.isArray(value))return value.some(references);return value!==null&&typeof value==='object'&&Object.values(value).some(references);}
 const rows=db.prepare('SELECT command_id,result_json FROM platform_commands WHERE owner=?').all(owner) as {command_id:string;result_json:string}[];
 for(const row of rows)if(selected.has(row.command_id)||references(JSON.parse(row.result_json)))db.prepare('UPDATE platform_commands SET result_json=? WHERE owner=? AND command_id=?').run(JSON.stringify(bodyFreeResult),owner,row.command_id);
}

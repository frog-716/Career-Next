import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {createLedger} from '../database/ledger';
import {verifyArtifact} from './protected-original';
export const fileCandidateMigration=`CREATE TABLE platform_file_candidates(id TEXT PRIMARY KEY,blob_id TEXT NOT NULL,name TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','ready')));`;
export function createFileCandidates(db:Database.Database,root:string){const ledger=createLedger(db);return {
 list(){return db.prepare("SELECT id,name FROM platform_file_candidates WHERE status='ready'").all() as {id:string;name:string}[];},
 prepare(name:string,digest:string,size:number,id:string=randomUUID()){const blobId=randomUUID();db.transaction(()=>{db.prepare("INSERT INTO platform_blobs VALUES (?,?,?,'held')").run(blobId,digest,size);db.prepare('INSERT INTO platform_file_candidates VALUES (?,?,?,?)').run(id,blobId,name,'pending');db.prepare("INSERT INTO platform_artifact_retention VALUES (?,'actual-artifact',?)").run(blobId,id);})();return {id,blobId};},
 complete(id:string){db.transaction(()=>{const row=db.prepare('SELECT blob_id FROM platform_file_candidates WHERE id=?').get(id) as {blob_id:string}|undefined;if(!row)throw Error('invalid_capability');const blob=ledger.describe(row.blob_id);if(!blob||!verifyArtifact(root,{blobId:row.blob_id,...blob},16*1024*1024))throw Error('file_failed');db.prepare("UPDATE platform_blobs SET state='published' WHERE id=?").run(row.blob_id);db.prepare("UPDATE platform_file_candidates SET status='ready' WHERE id=?").run(id);})();return this.read(id);},
 read(id:string){const row=db.prepare("SELECT name,blob_id FROM platform_file_candidates WHERE id=? AND status='ready'").get(id) as {name:string;blob_id:string}|undefined;if(!row)return undefined;const blob=ledger.describe(row.blob_id);return blob?.state==='published'&&verifyArtifact(root,{blobId:row.blob_id,...blob},16*1024*1024)?{name:row.name,blobId:row.blob_id,digest:blob.digest,size:blob.size}:undefined;},
 purgeImpact(id:string){const row=db.prepare('SELECT blob_id FROM platform_file_candidates WHERE id=?').get(id) as {blob_id:string}|undefined;return row?{id,revision:1,name:'实际发送文件',blobIds:[row.blob_id],retentions:[{owner:'actual-artifact',objectId:id}]}:undefined;},
 purge(id:string){ledger.releaseRetention('actual-artifact',id);db.prepare('DELETE FROM platform_file_candidates WHERE id=?').run(id);},
 recover(){for(const row of db.prepare("SELECT id FROM platform_file_candidates WHERE status='pending'").all() as {id:string}[])this.purge(row.id);},
};}

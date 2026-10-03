import type Database from 'better-sqlite3';
import {createFeedback} from '../application/feedback/public';
import type {Screenshot} from '../../contracts/application/feedback';
import {createFileCandidates} from '../platform/files/candidates';
import {createLedger} from '../platform/database/ledger';
import {readArtifact} from '../platform/files/protected-original';
export function composeFeedback(db:Database.Database,root:string){const files=createFileCandidates(db,root),ledger=createLedger(db);
 const bytes=(artifact:Screenshot)=>readArtifact(root,artifact,2*1024*1024);
 return createFeedback(db,{discardScreenshotCandidate:id=>files.purge(id),resolveScreenshot(id){const artifact=files.read(id);if(!artifact||artifact.size>2*1024*1024)return undefined;const data=readArtifact(root,artifact,2*1024*1024);if(!data)return undefined;const mime=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'image/png':data[0]===255&&data[1]===216&&data[2]===255?'image/jpeg':data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'?'image/webp':undefined;return mime?{...artifact,mime}:undefined;},retainScreenshot(candidateId,id,screenshot){ledger.retainExisting(screenshot.blobId,id,'feedback');files.purge(candidateId);},releaseScreenshot:id=>ledger.releaseRetention('feedback',id),readScreenshot(screenshot){const data=bytes(screenshot);return data?'data:'+screenshot.mime+';base64,'+data.toString('base64'):undefined;}});
}

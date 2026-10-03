import { constants, openSync, fstatSync, readFileSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { MAX_TEXT_BYTES } from '../../../contracts/materials/schema';

/** Bounded verification of a previously immutable Raw, never arbitrary paths. */
export function verifyProtectedOriginal(root: string, artifact: {blobId:string;size:number;digest:string}) {
 if(!/^[0-9a-f-]{36}$/i.test(artifact.blobId)||!Number.isSafeInteger(artifact.size)||artifact.size<0||artifact.size>MAX_TEXT_BYTES)return false;
 let descriptor:number|undefined;
 try{
  descriptor=openSync(path.join(root,'blobs',artifact.blobId),constants.O_RDONLY|constants.O_NOFOLLOW);
  const stat=fstatSync(descriptor);if(!stat.isFile()||stat.size!==artifact.size)return false;
  const bytes=readFileSync(descriptor);
  return bytes.length===artifact.size&&createHash('sha256').update(bytes).digest('hex')===artifact.digest;
 }catch{return false;}finally{if(descriptor!==undefined)closeSync(descriptor);}
}

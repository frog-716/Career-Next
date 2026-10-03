import { constants, openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
// Platform ceiling for bounded immutable-artifact verification.
const MAX_VERIFIED_BYTES=256*1024;

/** Bounded verification of a previously immutable Raw, never arbitrary paths. */
export function verifyProtectedOriginal(root: string, artifact: {blobId:string;size:number;digest:string}) {
 if(!/^[0-9a-f-]{36}$/i.test(artifact.blobId)||!Number.isSafeInteger(artifact.size)||artifact.size<0||artifact.size>MAX_VERIFIED_BYTES)return false;
 let descriptor:number|undefined;
 try{
  descriptor=openSync(path.join(root,'blobs',artifact.blobId),constants.O_RDONLY|constants.O_NOFOLLOW);
  const stat=fstatSync(descriptor);if(!stat.isFile()||stat.size!==artifact.size)return false;
  const bytes=Buffer.alloc(artifact.size+1);let count=0;
  while(count<bytes.length){const read=readSync(descriptor,bytes,count,bytes.length-count,null);if(read===0)break;count+=read;}
  return count===artifact.size&&createHash('sha256').update(bytes.subarray(0,count)).digest('hex')===artifact.digest;
 }catch{return false;}finally{if(descriptor!==undefined)closeSync(descriptor);}
}

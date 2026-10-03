import { constants, openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
// Platform ceiling for bounded immutable-artifact verification.
const MAX_VERIFIED_BYTES=256*1024;

/** Bounded verification of a previously immutable Raw, never arbitrary paths. */
export function verifyProtectedOriginal(root: string, artifact: {blobId:string;size:number;digest:string}) {
 return verifyArtifact(root,artifact,MAX_VERIFIED_BYTES);
}
export function readArtifact(root:string,artifact:{blobId:string;size:number;digest:string},maximum=MAX_VERIFIED_BYTES):Buffer|undefined {
 if(!/^[0-9a-f-]{36}$/i.test(artifact.blobId)||!Number.isSafeInteger(artifact.size)||artifact.size<0||artifact.size>maximum)return undefined;
 let descriptor:number|undefined;
 try{
  descriptor=openSync(path.join(root,'blobs',artifact.blobId),constants.O_RDONLY|constants.O_NOFOLLOW);
  const stat=fstatSync(descriptor);if(!stat.isFile()||stat.size!==artifact.size)return undefined;
  const bytes=Buffer.alloc(artifact.size+1);let count=0;
  while(count<bytes.length){const read=readSync(descriptor,bytes,count,bytes.length-count,null);if(read===0)break;count+=read;}
  return count===artifact.size&&createHash('sha256').update(bytes.subarray(0,count)).digest('hex')===artifact.digest?bytes.subarray(0,count):undefined;
 }catch{return undefined;}finally{if(descriptor!==undefined)closeSync(descriptor);}
}
export function verifyArtifact(root:string,artifact:{blobId:string;size:number;digest:string},maximum=MAX_VERIFIED_BYTES){return readArtifact(root,artifact,maximum)!==undefined;}

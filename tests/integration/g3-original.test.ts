import { expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { verifyProtectedOriginal } from '../../packages/backend/platform/files/protected-original';

it('an already retained Offer original must have exact bounded physical bytes; absent, changed or redirected originals fail',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-offer-original-'));
 try{
  await mkdir(path.join(root,'blobs'));const blobId=randomUUID(),bytes=Buffer.from('Real immutable written conditions');
  const artifact={blobId,size:bytes.length,digest:createHash('sha256').update(bytes).digest('hex')};
  expect(verifyProtectedOriginal(root,artifact)).toBe(false);
  await writeFile(path.join(root,'blobs',blobId),bytes);expect(verifyProtectedOriginal(root,artifact)).toBe(true);
  await writeFile(path.join(root,'blobs',blobId),'changed');expect(verifyProtectedOriginal(root,artifact)).toBe(false);
  await rm(path.join(root,'blobs',blobId));const other=path.join(root,'private.txt');await writeFile(other,bytes);await symlink(other,path.join(root,'blobs',blobId));expect(verifyProtectedOriginal(root,artifact)).toBe(false);
  expect(verifyProtectedOriginal(root,{...artifact,blobId:'../private.txt'})).toBe(false);
 }finally{await rm(root,{recursive:true,force:true});}
});

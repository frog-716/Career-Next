import { it,expect } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash,randomUUID } from 'node:crypto';
import { createBlobBroker } from '../../packages/backend/platform/files/blobs';
it('publishes immutable bounded PDF bytes with cancellation checks and exact digest',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-g2-pdf-files-'));
 try{
  const files=createBlobBroker(root,1024);await files.initialize();
  const bytes=Buffer.from('%PDF-1.7\nreal byte fixture\n%%EOF');const digest=createHash('sha256').update(bytes).digest('hex');const id=randomUUID();
  await files.publishBytes(id,bytes,digest,async()=>undefined);
  expect(await files.readBytes(id,digest)).toEqual(bytes);
  await expect(files.publishBytes(id,Buffer.from('different'),digest,async()=>undefined)).rejects.toThrow('storage_failed');
  let checks=0;await expect(files.publishBytes(randomUUID(),bytes,digest,async()=>{checks++;throw Error('revoked');})).rejects.toThrow('revoked');expect(checks).toBe(1);
  await expect(files.publishBytes(randomUUID(),Buffer.alloc(1025),'x',async()=>undefined)).rejects.toThrow('storage_failed');
  expect(await files.readBytes(id,digest)).toEqual(bytes);
 }finally{await rm(root,{recursive:true,force:true});}
});

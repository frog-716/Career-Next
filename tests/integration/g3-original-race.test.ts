import {it,expect,vi} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
const race=vi.hoisted(()=>({afterStat:undefined as undefined|(()=>void),readBytes:0}));
vi.mock('node:fs',async importOriginal=>{
 const actual=await importOriginal<typeof import('node:fs')>();
 return {...actual,fstatSync:(...args:Parameters<typeof actual.fstatSync>)=>{const stat=actual.fstatSync(...args);race.afterStat?.();race.afterStat=undefined;return stat;},readFileSync:(...args:Parameters<typeof actual.readFileSync>)=>{const bytes=actual.readFileSync(...args);race.readBytes+=bytes.length;return bytes;},readSync:(...args:Parameters<typeof actual.readSync>)=>{const count=actual.readSync(...args);race.readBytes+=count;return count;}};
});
import {appendFileSync} from 'node:fs';
import {verifyProtectedOriginal} from '../../packages/backend/platform/files/protected-original';
it('real file growth after stat cannot cause an unbounded read inside the SQLite writer',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-original-race-'));
 try{
  await mkdir(path.join(root,'blobs'));const blobId=randomUUID(),file=path.join(root,'blobs',blobId),bytes=Buffer.from('x');await writeFile(file,bytes);
  race.readBytes=0;race.afterStat=()=>appendFileSync(file,Buffer.alloc(8*1024*1024));
  expect(verifyProtectedOriginal(root,{blobId,size:1,digest:createHash('sha256').update(bytes).digest('hex')})).toBe(false);
  expect(race.readBytes).toBeLessThanOrEqual(256*1024+1);
 }finally{race.afterStat=undefined;await rm(root,{recursive:true,force:true});}
});

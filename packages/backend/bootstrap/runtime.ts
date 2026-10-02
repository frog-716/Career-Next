import { randomUUID,createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { startWriter } from '../platform/database/client';
import { createMaterialsBackend } from '../domains/materials/public';
import { renderSnapshot } from '../domains/resume/public';
import { createBlobBroker } from '../platform/files/blobs';
import type { HumanSession } from '../platform/runtime/sessions';
import type { BusinessModule } from '../../contracts/common/bridge';
import { Result as ResumeResult } from '../../contracts/resume/schema';
import type { RuntimeStore } from './writer-commands';
const maximumPdfBytes=16*1024*1024;
export async function createRuntimeBackend(root:string,writerArtifact?:string){
 await mkdir(root,{recursive:true,mode:0o700});
 const writer=await startWriter<RuntimeStore>(root,randomUUID(),writerArtifact);
 const materials=await createMaterialsBackend(root,undefined,undefined,writer);
 const blobs=createBlobBroker(root,maximumPdfBytes);
 await blobs.initialize();
 let closing=false;
 const operations=new Set<Promise<unknown>>(),prints=new Map<string,Promise<ResumeResult>>();
 function track<T>(job:Promise<T>){operations.add(job);void job.finally(()=>operations.delete(job)).catch(()=>undefined);return job;}
 async function completePdf(session:HumanSession,commandId:string,input:Uint8Array):Promise<ResumeResult>{
  await writer.call('pdfCheck',session,commandId);
  const bytes=Buffer.from(input);
  if(bytes.length===0||bytes.length>maximumPdfBytes||bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.subarray(-1024).includes(Buffer.from('%%EOF'))){return writer.call('pdfFail',commandId);}
  const artifact={blobId:randomUUID(),digest:createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
  try{
   const prepared=await writer.call('pdfPrepare',session,commandId,artifact);
   if(prepared.kind==='receipt')return ResumeResult.parse(prepared.result);
   await blobs.publishBytes(artifact.blobId,bytes,artifact.digest,()=>writer.call('pdfCheck',session,commandId));
   const published=await blobs.readBytes(artifact.blobId,artifact.digest);
   if(published.length!==artifact.size)throw Error('storage_failed');
   await writer.call('pdfPublished',session,commandId,artifact.blobId);
   const result=ResumeResult.parse(await writer.call('pdfCommit',session,commandId,artifact));
   if(result.status==='version')return result;
   const failed=await writer.call('pdfFail',commandId);await materials.collectGarbage().catch(()=>undefined);return ResumeResult.parse(failed);
  }catch{
   const result=await writer.call('pdfFail',commandId);
   await materials.collectGarbage().catch(()=>undefined);
   return ResumeResult.parse(result);
  }
 }
 return {materials,
  async connectHuman(){if(closing)throw Error('disconnected');const session=await materials.connectHuman();await Promise.allSettled([...operations]);await writer.call('recoverPending');await materials.collectGarbage();return session;},
  business(session:HumanSession,module:BusinessModule,input:unknown){if(closing)return Promise.reject(Error('disconnected'));return track(writer.call('business',session,module,input));},
  async printHtml(session:HumanSession,commandId:string){if(closing)throw Error('disconnected');const snapshot=await writer.call('pdfCheck',session,commandId);return {html:renderSnapshot(snapshot)};},
  completePdf(session:HumanSession,commandId:string,input:Uint8Array){if(closing)return Promise.reject(Error('disconnected'));const key=session.connectionGeneration+'/'+commandId;const previous=prints.get(key);if(previous)return previous;const job=track(completePdf(session,commandId,input));prints.set(key,job);void job.finally(()=>prints.delete(key)).catch(()=>undefined);return job;},
  failPdf(session:HumanSession,commandId:string){return track((async()=>{await writer.call('pdfCheck',session,commandId);return writer.call('pdfFail',commandId);})());},
  async close(){closing=true;await Promise.allSettled([...operations]);await materials.close();},
 };
}

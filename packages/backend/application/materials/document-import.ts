import {createHash} from 'node:crypto';
import {FeishuDocumentImportRequest,FeishuDocumentImportResult,type FeishuDocumentPreview} from '../../../contracts/platform/feishu-document';
import {FeishuDocumentOrigin,type Confirm} from '../../../contracts/materials/schema';
import type {MaterialsBackend} from '../../domains/materials/public';
type Session=Parameters<MaterialsBackend['confirm']>[0];
type Result=ReturnType<typeof FeishuDocumentImportResult.parse>;
/** Confirmation composes the volatile connector snapshot with the sole Raw owner. No network ports. */
export function createFeishuDocumentImporter(ports:{materials:Pick<MaterialsBackend,'list'|'read'|'receipt'|'selectTextSnapshot'|'confirm'|'cancel'>;session():Session;resolvePreview(input:unknown):FeishuDocumentPreview|undefined}){
 const flights=new Map<string,Promise<Result>>(),attempts=new Map<string,{confirmation:Confirm;digest:string;previewRef:string;previewDigest:string}>();
 const failure=(reason:Extract<Result,{kind:'failure'}>['reason']):Result=>({kind:'failure',reason});
 return {async importPreview(input:unknown):Promise<Result>{
  const parsed=FeishuDocumentImportRequest.safeParse(input);if(!parsed.success)return failure('invalid_request');const request=parsed.data;
  const preview=ports.resolvePreview({previewRef:request.previewRef,previewDigest:request.previewDigest});if(!preview)return failure('preview_unavailable');
  let bound:Session;try{bound=ports.session();}catch{return failure('save_failed');}
  const sourceKey=preview.source.documentIdentity+'/'+preview.provenance.revision,key=bound.workspaceInstance+'/'+sourceKey;
  const check=()=>{if(ports.session()!==bound)throw Error('disconnected');const current=ports.resolvePreview({previewRef:request.previewRef,previewDigest:request.previewDigest});if(!current)throw Error('preview_unavailable');};
  const digest=createHash('sha256').update(preview.text,'utf8').digest('hex');if(digest!==preview.provenance.contentDigest)return failure('preview_unavailable');
  const running=flights.get(key);if(running){const result=await running;if(result.kind==='raw_saved'){try{check();const raw=await ports.materials.read(bound,result.materialId);check();if(raw.digest!==digest)return failure('source_version_conflict');return {...result,previewDigest:request.previewDigest,duplicate:true};}catch{return failure('result_unknown');}}return result;}
  const job=(async():Promise<Result>=>{
   async function saved(materialId:string,commandId:string,duplicate:boolean):Promise<Result>{check();const raw=await ports.materials.read(bound,materialId);check();const origin=raw.origin;
    if(origin?.kind!=='feishu_document'||origin.source.documentIdentity!==preview!.source.documentIdentity||origin.provenance.revision!==preview!.provenance.revision)return failure('save_failed');
    if(raw.digest!==digest||raw.text!==preview!.text||origin.provenance.contentDigest!==digest)return failure('source_version_conflict');
    return FeishuDocumentImportResult.parse({kind:'raw_saved',materialId:raw.id,commandId,source:raw.source,previewDigest:request.previewDigest,duplicate});
   }
   let stagedId:string|undefined;
   try{
    check();const items=await ports.materials.list(bound);check();const matches=items.filter(raw=>raw.origin?.kind==='feishu_document'&&raw.origin.source.documentIdentity===preview.source.documentIdentity&&raw.origin.provenance.revision===preview.provenance.revision);
    if(matches.length>1)return failure('source_version_conflict');const existing=matches[0];
    if(existing?.origin?.kind==='feishu_document'){if(existing.origin.provenance.contentDigest!==digest)return failure('source_version_conflict');const receipt=await ports.materials.receipt(bound,existing.origin.confirmationCommandId);check();return receipt.status==='committed'&&receipt.materialId===existing.id?saved(existing.id,receipt.commandId,true):failure('result_unknown');}
    const attempted=attempts.get(key);if(attempted){
     if(attempted.digest!==digest)return failure('source_version_conflict');
     if(request.continueAfterNotFound&&(request.commandId!==attempted.confirmation.commandId||request.previewRef!==attempted.previewRef||request.previewDigest!==attempted.previewDigest))return failure('invalid_request');
     const receipt=await ports.materials.receipt(bound,attempted.confirmation.commandId);check();
     if(receipt.status==='committed')return saved(receipt.materialId,receipt.commandId,true);
     if(receipt.status==='failed')return failure('save_failed');
     if(receipt.status!=='not_found'||!request.continueAfterNotFound)return failure('result_unknown');
     // Explicit continuation reuses the owner's original staged bytes and exact command.
     const continued=await ports.materials.confirm(bound,attempted.confirmation);check();
     return continued.status==='committed'?saved(continued.materialId,continued.commandId,false):failure(continued.status==='failed'?'save_failed':'result_unknown');
    }
    if(request.continueAfterNotFound)return failure('invalid_request');
    const origin=FeishuDocumentOrigin.parse({kind:'feishu_document',identity:'user',source:preview.source,provenance:preview.provenance,limitations:preview.limitations,readBoundary:preview.readBoundary,confirmationCommandId:request.commandId});
    const staged=await ports.materials.selectTextSnapshot(bound,preview.title.slice(0,255),preview.text,origin);stagedId=staged.importId;check();
    const confirmation={commandId:request.commandId,importId:staged.importId,expectedRevision:1 as const,digest:staged.digest};attempts.set(key,{confirmation,digest,previewRef:request.previewRef,previewDigest:request.previewDigest});
    const receipt=await ports.materials.confirm(bound,confirmation);check();return receipt.status==='committed'?saved(receipt.materialId,receipt.commandId,false):failure(receipt.status==='failed'?'save_failed':'result_unknown');
   }catch(error){if(stagedId&&!attempts.has(key))await ports.materials.cancel(bound,stagedId).catch(()=>{});return failure(error instanceof Error&&error.message==='preview_unavailable'&&!attempts.has(key)?'preview_unavailable':attempts.has(key)?'result_unknown':'save_failed');}
  })();flights.set(key,job);try{return await job;}finally{flights.delete(key);}
 }};
}

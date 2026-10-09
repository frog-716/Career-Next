import {createHash} from 'node:crypto';
import {BitableRawImportRequest,BitableRawImportResult,type BitableRawPreview} from '../../../contracts/platform/feishu-bitable-raw-preview';
import {FeishuBitableRecordOrigin,type Confirm} from '../../../contracts/materials/schema';
import type {MaterialsBackend} from '../../domains/materials/public';

type Session=Parameters<MaterialsBackend['confirm']>[0];
type Result=ReturnType<typeof BitableRawImportResult.parse>;
/** Composes the selected connector snapshot with the sole Raw owner. No external service ports. */
export function createBitableRawImporter(ports:{materials:Pick<MaterialsBackend,'list'|'read'|'receipt'|'selectTextSnapshot'|'confirm'|'cancel'>;session():Session;resolvePreview(input:unknown):BitableRawPreview|undefined}){
 const flights=new Map<string,Promise<Result>>(),attempts=new Map<string,Confirm>();
 const failure=(reason:'invalid_request'|'preview_unavailable'|'save_failed'|'result_unknown'):Result=>({kind:'failure',reason});
 return {async importPreview(input:unknown):Promise<Result>{
  const parsed=BitableRawImportRequest.safeParse(input);if(!parsed.success)return failure('invalid_request');
  const request=parsed.data,preview=ports.resolvePreview({previewRef:request.previewRef,previewDigest:request.previewDigest});if(!preview)return failure('preview_unavailable');
  const bound=ports.session(),key=bound.workspaceInstance+'/'+preview.provenance.preview_digest;
  const prior=flights.get(key);if(prior)return prior;
  const job=(async():Promise<Result>=>{
   const check=()=>{if(ports.session()!==bound)throw Error('disconnected');};
   const checkPreview=()=>{check();if(!ports.resolvePreview({previewRef:request.previewRef,previewDigest:request.previewDigest}))throw Error('preview_unavailable');};
   const digest=createHash('sha256').update(preview.text,'utf8').digest('hex');
   async function saved(materialId:string,commandId:string,duplicate:boolean):Promise<Result>{
    check();const raw=await ports.materials.read(bound,materialId);check();
    const origin=raw.origin;
    if(raw.text!==preview!.text||raw.digest!==digest||origin?.kind!=='feishu_bitable_record'||JSON.stringify(origin.source)!==JSON.stringify(preview!.source)||JSON.stringify(origin.provenance)!==JSON.stringify(preview!.provenance))return failure('save_failed');
    return BitableRawImportResult.parse({kind:'raw_saved',materialId:raw.id,commandId,source:raw.source,previewDigest:request.previewDigest,duplicate});
   }
   let stagedId:string|undefined;
   try{
    checkPreview();const items=await ports.materials.list(bound);checkPreview();
    const matches=items.filter(raw=>raw.origin?.kind==='feishu_bitable_record'&&raw.origin.provenance.preview_digest===request.previewDigest);
    if(matches.length>1)return failure('save_failed');
    const existing=matches[0];
    if(existing&&existing.origin?.kind==='feishu_bitable_record'){
     const receipt=await ports.materials.receipt(bound,existing.origin.confirmationCommandId);check();
     if(receipt.status!=='committed'||receipt.materialId!==existing.id)return failure('result_unknown');
     return saved(existing.id,receipt.commandId,true);
    }
    const attempted=attempts.get(key);
    if(attempted){const receipt=await ports.materials.receipt(bound,attempted.commandId);check();return receipt.status==='committed'?saved(receipt.materialId,receipt.commandId,true):failure(receipt.status==='failed'?'save_failed':'result_unknown');}
    const origin=FeishuBitableRecordOrigin.parse({kind:'feishu_bitable_record',identity:'user',source:preview.source,provenance:preview.provenance,confirmationCommandId:request.commandId});
    const staged=await ports.materials.selectTextSnapshot(bound,preview.title.slice(0,255),preview.text,origin);stagedId=staged.importId;checkPreview();
    const confirmation={commandId:request.commandId,importId:staged.importId,expectedRevision:1 as const,digest:staged.digest};attempts.set(key,confirmation);
    const receipt=await ports.materials.confirm(bound,confirmation);check();
    return receipt.status==='committed'?saved(receipt.materialId,receipt.commandId,false):failure(receipt.status==='failed'?'save_failed':'result_unknown');
   }catch(error){if(stagedId&&!attempts.has(key))await ports.materials.cancel(bound,stagedId).catch(()=>{});return failure(attempts.has(key)?'result_unknown':error instanceof Error&&error.message==='preview_unavailable'?'preview_unavailable':'save_failed');}
  })();
  flights.set(key,job);try{return await job;}finally{flights.delete(key);}
 }};
}

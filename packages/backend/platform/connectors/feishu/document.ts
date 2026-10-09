import {z} from 'zod';
import {createHash,randomUUID} from 'node:crypto';
import {DOCUMENT_MAX_BYTES,FeishuContentBlock,FeishuDocumentRequest,FeishuDocumentCachedPreviewRequest,FeishuDocumentPreview,FeishuDocumentPreviewReadyRequest,FeishuDocumentCancelRequest,type FeishuDocumentResult} from '../../../../contracts/platform/feishu-document';
import type {FeishuConnectionStatus} from './connector';
export type ResolvedFeishuDocument={token:string;type:'docx'|'wiki'|'doc';title:string;url:string|null;accountIdentity?:string};
export type DocumentBlock={id:string;parentId:string;type:number;children:string[];text:string;done?:boolean|null};
export type FeishuDocumentReadPorts={
 resolveWiki?(token:string,signal:AbortSignal):Promise<{documentToken:string;type:string;title:string}>;
 resolveLegacy?(token:string,signal:AbortSignal):Promise<{documentToken:string}|undefined>;
 readMetadata(token:string,signal:AbortSignal):Promise<{documentToken:string;title:string;revision:number}>;
 readBlocks(token:string,revision:number,pageToken:string|undefined,signal:AbortSignal):Promise<{items:DocumentBlock[];hasMore:boolean;pageToken?:string}>;
};
type Ports=FeishuDocumentReadPorts&{getConnectionStatus():Promise<FeishuConnectionStatus>;getAccountIdentity?():Promise<string|null>;resolveDocument(ref:string):ResolvedFeishuDocument|undefined};
const digest=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex');
const failure=(reason:Extract<FeishuDocumentResult,{kind:'failure'}>['reason']):FeishuDocumentResult=>({kind:'failure',reason});
const kinds:Record<number,FeishuContentBlock['kind']>={2:'paragraph',3:'heading',4:'heading',5:'heading',6:'heading',7:'heading',8:'heading',9:'heading',10:'heading',11:'heading',12:'bullet',13:'ordered',14:'code',15:'quote',17:'todo',19:'container',22:'divider',23:'attachment',24:'container',25:'container',27:'image',31:'table',32:'cell',34:'quote'};
const linked=new Set([18,20,21,26,28,29,30,33,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52]);
/** Volatile, selected-reference read capability. Only complete snapshots can reach Materials. */
export function createFeishuDocumentReader(ports:Ports){
 const previews=new Map<string,FeishuDocumentPreview>(),cachedBySelected=new Map<string,string>(),previewRequests=new Map<string,string>(),attempts=new Map<string,{selectedRef:string;result:Promise<FeishuDocumentResult>;controller:AbortController;previewRef?:string;sourceIdentity?:string}>();let busy=false,purgeClock=0;
 const previewSources=new Map<string,{sourceIdentity:string;selectedRef:string;requestId:string}>(),savedMaterials=new Map<string,string>(),purgedSources=new Map<string,number>(),revokedRequests=new Set<string>();
 const forgetPreview=(ref:string)=>{previews.delete(ref);previewRequests.delete(ref);for(const [selectedRef,previewRef]of cachedBySelected)if(previewRef===ref)cachedBySelected.delete(selectedRef);};
 const assertActive=(signal:AbortSignal)=>{if(signal.aborted)throw Error('cancelled');};
 return {
  cachedPreview(input:unknown):FeishuDocumentResult{const parsed=FeishuDocumentCachedPreviewRequest.safeParse(input);if(!parsed.success)return failure('invalid_request');const ref=cachedBySelected.get(parsed.data.selectedRef),preview=ref?previews.get(ref):undefined;return preview?structuredClone(preview):failure('preview_unavailable');},
  resolvePreview(input:unknown){const parsed=FeishuDocumentPreviewReadyRequest.safeParse(input);if(!parsed.success)return;const p=previews.get(parsed.data.previewRef);return p?.provenance.previewDigest===parsed.data.previewDigest?structuredClone(p):undefined;},
  cancel(input:unknown){const parsed=FeishuDocumentCancelRequest.safeParse(input);if(!parsed.success)return {kind:'failure' as const,reason:'invalid_request' as const};if('requestId'in parsed.data){const attempt=attempts.get(parsed.data.requestId);attempt?.controller.abort();if(attempt?.previewRef)forgetPreview(attempt.previewRef);for(const [previewRef,requestId]of previewRequests)if(requestId===parsed.data.requestId)forgetPreview(previewRef);}else{forgetPreview(parsed.data.previewRef);for(const attempt of attempts.values())if(attempt.previewRef===parsed.data.previewRef)attempt.controller.abort();}return {kind:'cancelled' as const};},
  bindSavedMaterial(previewRef:string,materialId:string){const source=previewSources.get(previewRef);if(!source||revokedRequests.has(source.requestId)||!z.uuid().safeParse(materialId).success)return false;savedMaterials.set(materialId,source.sourceIdentity);return true;},
  purgeSavedMaterials(materialIds:readonly string[]){const trackedMaterialIds=[...new Set(materialIds)].filter(id=>savedMaterials.has(id)),sources=new Set(trackedMaterialIds.map(id=>savedMaterials.get(id)!)),invalidatedPreviewRefs:string[]=[];if(sources.size){purgeClock++;for(const source of sources)purgedSources.set(source,purgeClock);const selectedRefs=new Set<string>();for(const metadata of previewSources.values())if(sources.has(metadata.sourceIdentity)){selectedRefs.add(metadata.selectedRef);revokedRequests.add(metadata.requestId);}for(const [ref,preview]of previews)if(sources.has(preview.source.documentIdentity)){invalidatedPreviewRefs.push(ref);forgetPreview(ref);}for(const [requestId,attempt]of attempts)if(attempt.sourceIdentity&&sources.has(attempt.sourceIdentity)||selectedRefs.has(attempt.selectedRef)){attempt.controller.abort();revokedRequests.add(requestId);attempts.delete(requestId);}}return {trackedMaterialIds,invalidatedPreviewRefs};},
  dispose(){const invalidatedPreviewRefs=[...previews.keys()];for(const [id,attempt]of attempts){attempt.controller.abort();revokedRequests.add(id);}previews.clear();cachedBySelected.clear();previewRequests.clear();attempts.clear();previewSources.clear();savedMaterials.clear();purgedSources.clear();return {invalidatedPreviewRefs};},
  async preview(input:unknown):Promise<FeishuDocumentResult>{
   const parsed=FeishuDocumentRequest.safeParse(input);if(!parsed.success)return failure('invalid_request');const {requestId,selectedRef}=parsed.data,prior=attempts.get(requestId);
   if(revokedRequests.has(requestId))return failure('cancelled');
   if(prior)return prior.selectedRef!==selectedRef?failure('invalid_request'):prior.controller.signal.aborted?failure('cancelled'):structuredClone(await prior.result);
   const selected=ports.resolveDocument(selectedRef);if(!selected)return failure('reference_unavailable');if(busy)return failure('read_busy');busy=true;
   const controller=new AbortController(),signal=controller.signal,startedPurgeClock=purgeClock;let sourceIdentity:string|undefined;const assertReadActive=()=>{assertActive(signal);if(sourceIdentity&&(purgedSources.get(sourceIdentity)??0)>startedPurgeClock)throw Error('cancelled');};
   const result=(async():Promise<FeishuDocumentResult>=>{try{
    const status=await ports.getConnectionStatus();assertReadActive();if(status.state!=='connected')return failure(status.state);
    const accountScope=ports.getAccountIdentity?await ports.getAccountIdentity():selected.accountIdentity??null;assertReadActive();if(accountScope!==null&&!/^[a-f0-9]{64}$/.test(accountScope))return failure('connection_invalid');
    let target={...selected,accountIdentity:accountScope??undefined};let requestsMade=0;
    if(target.type==='wiki'){if(!ports.resolveWiki)return failure('unsupported_type');requestsMade++;const resolved=await ports.resolveWiki(target.token,signal);assertReadActive();if(resolved.type!=='docx'&&resolved.type!=='doc')return failure('unsupported_type');target={...target,token:resolved.documentToken,title:resolved.title,type:resolved.type};}
    if(target.type==='doc'){if(!ports.resolveLegacy)return failure('unsupported_type');requestsMade++;const resolved=await ports.resolveLegacy(target.token,signal);assertReadActive();if(!resolved)return failure('unsupported_type');target={...target,token:resolved.documentToken,type:'docx'};}
    sourceIdentity=digest(JSON.stringify(['feishu',target.accountIdentity??null,target.token]));const activeAttempt=attempts.get(requestId);if(activeAttempt)activeAttempt.sourceIdentity=sourceIdentity;assertReadActive();
    requestsMade++;const metadata=await ports.readMetadata(target.token,signal);assertReadActive();if(metadata.documentToken!==target.token||!Number.isSafeInteger(metadata.revision)||metadata.revision<1||!metadata.title.trim())throw Error('read_failed');
    const blocks:DocumentBlock[]=[],pageTokens=new Set<string>();let pageToken:string|undefined,projectedTextBytes=0;
    for(let page=0;page<5;page++){
     requestsMade++;const data=await ports.readBlocks(target.token,metadata.revision,pageToken,signal);assertReadActive();blocks.push(...data.items);projectedTextBytes+=data.items.reduce((total,block)=>total+Buffer.byteLength(block.text,'utf8'),0);if(projectedTextBytes>DOCUMENT_MAX_BYTES)throw Error('limit_exceeded');if(blocks.length>500)throw Error('limit_exceeded');
     if(!data.hasMore)break;if(page===4)throw Error('limit_exceeded');if(!data.pageToken||pageTokens.has(data.pageToken))throw Error('read_failed');pageTokens.add(data.pageToken);pageToken=data.pageToken;
    }
    requestsMade++;const after=await ports.readMetadata(target.token,signal);assertReadActive();if(after.documentToken!==metadata.documentToken||after.revision!==metadata.revision||after.title!==metadata.title)throw Error('version_changed');
    if(ports.getAccountIdentity){const currentStatus=await ports.getConnectionStatus();assertReadActive();if(currentStatus.state!=='connected')return failure(currentStatus.state);const currentAccount=await ports.getAccountIdentity();assertReadActive();if(currentAccount!==accountScope)throw Error('account_changed');}
    const ids=new Map<string,DocumentBlock>();for(const block of blocks){if(ids.has(block.id)||!block.id)throw Error('read_failed');ids.set(block.id,block);}
    const root=ids.get(target.token);if(!root||root.type!==1)throw Error('read_failed');
    const visible:FeishuContentBlock[]=[],visited=new Set<string>(),limitations=new Set<FeishuDocumentPreview['limitations'][number]>();
    function visit(id:string,depth:number){if(depth>32)throw Error('limit_exceeded');const b=ids.get(id);if(!b||visited.has(id))throw Error('read_failed');visited.add(id);let kind=kinds[b.type]??(linked.has(b.type)?'linked_content':'unsupported');
     if(b.type!==1){let text=b.text;
      if(kind==='heading')text='#'.repeat(Math.min(6,b.type-2))+' '+text;else if(kind==='bullet')text='- '+text;else if(kind==='ordered')text='1. '+text;else if(kind==='quote')text='> '+text;else if(kind==='code')text='```\n'+text+'\n```';else if(kind==='todo')text=b.done===true?'- [x] '+text:b.done===false?'- [ ] '+text:'[状态未提供] '+text;else if(kind==='table')text='[表格]';else if(kind==='cell')text='[单元格]';else if(kind==='divider')text='---';else if(kind==='image'){text='[图片未下载]';limitations.add('images_not_downloaded');}else if(kind==='attachment'){text='[附件未下载]';limitations.add('attachments_not_downloaded');}else if(kind==='linked_content'){text='[关联内容未展开]';limitations.add('linked_content_not_expanded');}else if(kind==='unsupported'){text='[不支持的内容块]';limitations.add('unsupported_blocks');}
      if(Buffer.byteLength(text,'utf8')>DOCUMENT_MAX_BYTES)throw Error('limit_exceeded');visible.push(FeishuContentBlock.parse({kind,text,depth:Math.max(0,depth-1),...kind==='todo'?{done:b.done??null}:{}}));}
     // Linked/synced blocks can expose foreign block IDs: never traverse them.
     if(kind!=='linked_content')for(const child of b.children){const c=ids.get(child);if(!c||c.parentId!==b.id)throw Error('read_failed');visit(child,depth+1);}
    }
    visit(root.id,0);if([...ids.values()].some(b=>!visited.has(b.id)&&!linked.has(b.type)))throw Error('read_failed');
    const text=visible.map(b=>b.text).filter(Boolean).join('\n');if(Buffer.byteLength(text,'utf8')>DOCUMENT_MAX_BYTES||Buffer.byteLength(JSON.stringify(visible),'utf8')>256*1024)throw Error('limit_exceeded');
    const source={documentIdentity:digest(JSON.stringify(['feishu',target.accountIdentity??null,target.token])),type:'docx' as const,accountIdentity:target.accountIdentity??null,sourceUrl:target.url,displayTitle:metadata.title};
    if(!target.accountIdentity)limitations.add('connection_identity_unavailable');
    const contentDigest=digest(text),previewDigest=digest(JSON.stringify({source,revision:metadata.revision,contentDigest,blocks:visible}));
    const preview=FeishuDocumentPreview.parse({kind:'document_preview',ref:randomUUID(),title:metadata.title,text,blocks:visible,source,provenance:{revision:metadata.revision,retrievedAt:new Date().toISOString(),contentDigest,previewDigest,complete:true},limitations:[...limitations],readBoundary:{maxPages:5,pageSize:100,maxBlocks:500,maxTextBytes:DOCUMENT_MAX_BYTES,metadataRequests:2,requestsMade}});assertReadActive();previewSources.set(preview.ref,{sourceIdentity:preview.source.documentIdentity,selectedRef,requestId});previews.set(preview.ref,preview);previewRequests.set(preview.ref,requestId);cachedBySelected.set(selectedRef,preview.ref);if(previews.size>20)forgetPreview(previews.keys().next().value!);const attempt=attempts.get(requestId);if(attempt)attempt.previewRef=preview.ref;return structuredClone(preview);
   }catch(error){if(signal.aborted)return failure('cancelled');const msg=error instanceof Error?error.message:'';return failure(msg==='feishu_authorization_required'?'reauthorization_required':msg==='feishu_document_permission_required'?'permission_required':['limit_exceeded','version_changed','account_changed','cancelled'].includes(msg)?msg as 'limit_exceeded'|'version_changed'|'account_changed'|'cancelled':'read_failed');}finally{busy=false;}})();
   attempts.set(requestId,{selectedRef,result,controller});if(attempts.size>100)attempts.delete(attempts.keys().next().value!);return result;
  },
 };
}

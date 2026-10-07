import {randomUUID} from 'node:crypto';
import {FeishuSearchRequest,type FeishuSearchResult,type FeishuDocumentMetadata} from '../../../../contracts/platform/feishu-discovery';
import type {FeishuConnectionStatus} from './connector';

export type FeishuSearchPage={items:Array<Omit<FeishuDocumentMetadata,'ref'>&{documentId:string}>;hasMore:boolean};
export type FeishuDiscoveryPorts={getConnectionStatus():Promise<FeishuConnectionStatus>;searchDocuments(query:string):Promise<FeishuSearchPage>};
/** Metadata only: no database, body resolver or business writer is available here. */
export function createFeishuDiscovery(ports:FeishuDiscoveryPorts){
 const attempts=new Map<string,{query:string;result:Promise<FeishuSearchResult>}>();let busy=false;
 return {async searchDocuments(input:unknown):Promise<FeishuSearchResult>{
  const parsed=FeishuSearchRequest.safeParse(input);if(!parsed.success)return {kind:'failure',reason:'invalid_request'};
  const {searchId,query}=parsed.data,previous=attempts.get(searchId);
  if(previous)return previous.query===query?previous.result:{kind:'failure',reason:'invalid_request'};
  if(busy)return {kind:'failure',reason:'search_busy'};
  busy=true;
  const result=(async():Promise<FeishuSearchResult>=>{try{
   const status=await ports.getConnectionStatus();if(status.state!=='connected')return {kind:'failure',reason:status.state};
   const page=await ports.searchDocuments(query);
   return {kind:'results',hasMore:page.hasMore,items:page.items.map(item=>({ref:randomUUID(),title:item.title,type:item.type,updatedAt:item.updatedAt,url:item.url}))};
  }catch(error){const message=error instanceof Error?error.message:'';return {kind:'failure',reason:message==='feishu_authorization_required'?'reauthorization_required':message==='feishu_search_permission_required'?'permission_required':'search_failed'};}finally{busy=false;}})();
  attempts.set(searchId,{query,result});
  // Keep a bounded in-memory dedup window; restart never replays an attempt.
  if(attempts.size>100)attempts.delete(attempts.keys().next().value!);
  return result;
 }};
}

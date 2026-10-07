import {randomUUID} from 'node:crypto';
import {FeishuSearchRequest,type FeishuSearchResult,type FeishuDocumentMetadata} from '../../../../contracts/platform/feishu-discovery';
import type {FeishuConnectionStatus} from './connector';

export type FeishuSearchPage={items:Array<Omit<FeishuDocumentMetadata,'ref'>&{documentId:string}>;hasMore:boolean};
export type FeishuDiscoveryPorts={getConnectionStatus():Promise<FeishuConnectionStatus>;searchDocuments(query:string):Promise<FeishuSearchPage>};
/** Metadata only: no database, body resolver or business writer is available here. */
export function createFeishuDiscovery(ports:FeishuDiscoveryPorts){
 const attempts=new Map<string,{query:string;result:Promise<FeishuSearchResult>}>();let busy=false;
 const bitables=new Map<string,{appToken:string;title:string}>();let selected:FeishuDocumentMetadata|null=null;
 function register(title:string,url:string|null,ref=randomUUID()){
  if(!url)return;try{const source=new URL(url),match=/^\/base\/([A-Za-z0-9]{16,128})\/?$/.exec(source.pathname);
   if(source.protocol!=='https:'||source.username||source.password||!(source.hostname.endsWith('.feishu.cn')||source.hostname.endsWith('.larksuite.com'))||!match)return;
   bitables.set(ref,{appToken:match[1]!,title});if(bitables.size>2000)bitables.delete(bitables.keys().next().value!);return ref;
  }catch{return;}
 }
 return {
  // Trusted platform assembly only: no browser URL/token registration endpoint.
  registerSelectedBitable(input:{title:string;url:string}){if(!input.title.trim()||input.title.length>1000)throw Error('invalid_selected_bitable');const ref=register(input.title,input.url);if(!ref)throw Error('invalid_selected_bitable');selected={ref,title:input.title,type:'bitable',updatedAt:null,url:null};return selected;},
  getSelectedBitable(){return selected;},
  resolveBitable(ref:string){return bitables.get(ref);},
  async searchDocuments(input:unknown):Promise<FeishuSearchResult>{
  const parsed=FeishuSearchRequest.safeParse(input);if(!parsed.success)return {kind:'failure',reason:'invalid_request'};
  const {searchId,query}=parsed.data,previous=attempts.get(searchId);
  if(previous)return previous.query===query?previous.result:{kind:'failure',reason:'invalid_request'};
  if(busy)return {kind:'failure',reason:'search_busy'};
  busy=true;
  const result=(async():Promise<FeishuSearchResult>=>{try{
   const status=await ports.getConnectionStatus();if(status.state!=='connected')return {kind:'failure',reason:status.state};
   const page=await ports.searchDocuments(query);
   return {kind:'results',hasMore:page.hasMore,items:page.items.map(item=>{const ref=randomUUID();if(item.type==='bitable')register(item.title,item.url,ref);return {ref,title:item.title,type:item.type,updatedAt:item.updatedAt,url:item.type==='bitable'?null:item.url};})};
  }catch(error){const message=error instanceof Error?error.message:'';return {kind:'failure',reason:message==='feishu_authorization_required'?'reauthorization_required':message==='feishu_search_permission_required'?'permission_required':'search_failed'};}finally{busy=false;}})();
  attempts.set(searchId,{query,result});
  // Keep a bounded in-memory dedup window; restart never replays an attempt.
  if(attempts.size>100)attempts.delete(attempts.keys().next().value!);
  return result;
 }};
}

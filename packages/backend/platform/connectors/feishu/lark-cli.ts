import {execFile as nodeExecFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {access,realpath} from 'node:fs/promises';
import type {FeishuAuthState,FeishuUserProfile} from './connector';
import {FeishuSearchQuery,FeishuDocumentType} from '../../../../contracts/platform/feishu-discovery';
import type {FeishuSearchPage} from './discovery';
import {z} from 'zod';

const execFile=promisify(nodeExecFile);
export type FeishuCliRun=(args:string[])=>Promise<{stdout:string;code:number;failure?:'authorization'|'permission'|'unavailable'}>;
export function larkCliInvocation(binary:string,args:string[],nodeExecutable=process.execPath){
 return /\.(?:c|m)?js$/i.test(binary)?{executable:nodeExecutable,args:[binary,...args]}:{executable:binary,args};
}
function jsonEnvelope(text:string){
 const trimmed=text.trim();try{return JSON.parse(trimmed);}catch{}
 for(let i=0;i<trimmed.length;i++)if(trimmed[i]==='{'){
  let depth=0,quoted=false,escaped=false;
  for(let j=i;j<trimmed.length;j++){const c=trimmed[j]!;if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"'){quoted=true;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0){try{return JSON.parse(trimmed.slice(i,j+1));}catch{}break;}}
 }
 throw Error('feishu_cli_response_invalid');
}
async function defaultRunner(args:string[]):ReturnType<FeishuCliRun>{
 const candidates=[process.env.CAREER_LARK_CLI,path.join(os.homedir(),'.local/bin/lark-cli'),'/opt/homebrew/bin/lark-cli','/usr/local/bin/lark-cli'].filter((value):value is string=>!!value);
 let binary:string|undefined;for(const candidate of candidates){try{await access(candidate);binary=candidate;break;}catch{}}
 if(!binary)throw Error('feishu_cli_unavailable');
 try{const target=await realpath(binary).catch(()=>binary),invocation=larkCliInvocation(target,args);const result=await execFile(invocation.executable,invocation.args,{encoding:'utf8',timeout:20_000,maxBuffer:2*1024*1024,env:{...process.env,LARKSUITE_CLI_NO_UPDATE_NOTIFIER:'1',LARKSUITE_CLI_NO_SKILLS_NOTIFIER:'1'}});return {stdout:result.stdout,code:0};}
 catch(error){const value=error as NodeJS.ErrnoException&{stdout?:string;stderr?:string;code?:number};const clue=(value.stderr??'').toLowerCase();return {stdout:value.stdout??'',code:typeof value.code==='number'?value.code:1,failure:/missing_scope|99991679/.test(clue)?'permission':/token_expired|invalid_token|unauthorized|9999166[1348]/.test(clue)?'authorization':'unavailable'};}
}

// Projection happens inside the CLI before stdout reaches Career. In particular,
// summary_highlighted, author/contact fields and original response are discarded.
export const feishuMetadataProjection='{ok: .ok, data: {has_more: .data.has_more, results: [.data.results[]? | {documentId: (.entity_id // .result_meta.token // .result_meta.url), title: (.title // .title_highlighted), type: (.result_meta.doc_types // .entity_type), updatedAt: (.result_meta.update_time_iso // .result_meta.update_time), url: .result_meta.url}]}}';
const SearchProjection=z.object({ok:z.literal(true),data:z.object({has_more:z.boolean(),results:z.array(z.strictObject({documentId:z.string().min(1).max(2000),title:z.string().min(1).max(1000),type:z.string().nullable(),updatedAt:z.union([z.string(),z.number()]).nullable(),url:z.string().nullable()})).max(20)})});
function metadataUrl(value:string|null):string|null{if(!value)return null;try{const url=new URL(value),host=url.hostname.toLowerCase();if(url.protocol!=='https:'||url.username||url.password||!(host==='feishu.cn'||host.endsWith('.feishu.cn')||host==='larksuite.com'||host.endsWith('.larksuite.com')))return null;return url.href;}catch{return null;}}
function metadataTime(value:string|number|null):string|null{if(value===null)return null;const numeric=typeof value==='number'||/^\d+$/.test(value),milliseconds=numeric?Number(value)*(Number(value)<1e12?1000:1):Date.parse(String(value));if(!Number.isFinite(milliseconds))return null;try{return new Date(milliseconds).toISOString();}catch{return null;}}
/** Fixed title-only, single-page search. Never calls inspect, metadata follow-ups or body APIs. */
export function createLarkCliDiscoveryPorts(run:FeishuCliRun=defaultRunner){return {
 async searchDocuments(query:string):Promise<FeishuSearchPage>{
  FeishuSearchQuery.parse(query);
  const response=await run(['drive','+search','--query',query,'--only-title','--page-size','20','--as','user','--json','--jq',feishuMetadataProjection]);
  if(response.code!==0)throw Error(response.failure==='permission'?'feishu_search_permission_required':response.failure==='authorization'?'feishu_authorization_required':'feishu_search_unavailable');
  const projected=SearchProjection.parse(jsonEnvelope(response.stdout));
  return {hasMore:projected.data.has_more,items:projected.data.results.map(item=>({documentId:item.documentId,title:item.title.replace(/<\/?hb?>/g,''),type:FeishuDocumentType.catch('other').parse(item.type?.toLowerCase()),updatedAt:metadataTime(item.updatedAt),url:metadataUrl(item.url)}))};
 },
};}
function findAvatar(value:unknown):string|undefined{
 if(!value||typeof value!=='object')return;
 if(Array.isArray(value)){for(const item of value){const found=findAvatar(item);if(found)return found;}return;}
 for(const [key,item]of Object.entries(value as Record<string,unknown>)){
  if(/avatar/i.test(key)&&typeof item==='string'&&item.trim())return item.trim();
  const found=findAvatar(item);if(found)return found;
 }
}
function currentUserRecord(value:unknown,depth=0):unknown{
 if(!value||typeof value!=='object'||Array.isArray(value)||depth>3)return;
 const root=value as Record<string,unknown>,user=root.user??root.current_user;
 if(user&&typeof user==='object'&&!Array.isArray(user))return user;
 if(Object.hasOwn(root,'nickname'))return root;
 return currentUserRecord(root.data,depth+1);
}
function nicknameFromCurrentUser(value:unknown):string|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return;
 const nickname=(value as Record<string,unknown>).nickname;
 return typeof nickname==='string'&&nickname.trim()?nickname.trim():undefined;
}
function authStateFromPayload(payload:unknown):FeishuAuthState{
 if(!payload||typeof payload!=='object')return 'unavailable';
 const root=payload as Record<string,unknown>,identities=root.identities as Record<string,unknown>|undefined,user=identities?.user as Record<string,unknown>|undefined;
 const status=String(user?.status??'').toLowerCase(),tokenStatus=String(user?.tokenStatus??user?.token_status??'').toLowerCase();
 if(status==='ready'&&(!tokenStatus||['ready','valid','active'].includes(tokenStatus)))return 'ready';
 if(['needs_refresh','expired','refresh_required'].includes(status)||['needs_refresh','expired','refresh_required'].includes(tokenStatus))return 'needs_refresh';
 if(['missing','not_configured','not_logged_in','unconfigured'].includes(status))return 'not_configured';
 if(['denied','revoked','invalid'].includes(status)||['denied','revoked','invalid'].includes(tokenStatus))return 'denied';
 return 'unavailable';
}
function avatarUrlFromPayload(payload:unknown){
 const value=findAvatar(payload);
 if(!value)return undefined;try{const url=new URL(value);if(url.protocol!=='https:'||!(url.hostname==='feishucdn.com'||url.hostname.toLowerCase().endsWith('.feishucdn.com'))||url.username||url.password)return undefined;return url.href;}catch{return undefined;}
}

/** Fixed lark-cli identity adapter. It never returns raw CLI envelopes or credential fields. */
export function createLarkCliFeishuPorts(run:FeishuCliRun=defaultRunner){
 return {
  async authState():Promise<FeishuAuthState>{try{const result=await run(['auth','status','--json']);if(result.code!==0)return 'unavailable';return authStateFromPayload(jsonEnvelope(result.stdout));}catch{return 'unavailable';}},
  async readCurrentUser():Promise<FeishuUserProfile>{
   const local=await run(['auth','status','--json']);if(local.code!==0)throw Error('feishu_identity_unavailable');
   let authorization:Record<string,any>;try{authorization=jsonEnvelope(local.stdout);}catch{throw Error('feishu_identity_unavailable');}
   const current=authorization.identities?.user,openId=current?.openId??current?.open_id;
   if(authStateFromPayload(authorization)!=='ready'||typeof openId!=='string'||!/^ou_[A-Za-z0-9_-]{8,128}$/.test(openId))throw Error('feishu_identity_unavailable');
   const result=await run(['api','GET','/open-apis/contact/v3/users/'+openId,'--params','{"user_id_type":"open_id"}','--as','user','--json']);if(result.code!==0)throw Error('feishu_identity_unavailable');
   let payload:unknown;try{payload=jsonEnvelope(result.stdout);}catch{throw Error('feishu_identity_unavailable');}
   if(!(payload as Record<string,unknown>)?.ok)throw Error('feishu_identity_unavailable');
   const user=currentUserRecord(payload),name=nicknameFromCurrentUser(user);
   if(!name)throw Error('feishu_nickname_unavailable');
   const avatarUrl=avatarUrlFromPayload(user);return {displayName:name,...avatarUrl?{avatarUrl}:{}};
  },
  async downloadAvatar(value:string):Promise<{bytes:Buffer;mime:string}>{
   let current:URL;try{current=new URL(value);}catch{throw Error('invalid_avatar_source');}
   const allowed=(host:string)=>host==='feishucdn.com'||host.toLowerCase().endsWith('.feishucdn.com');
   if(current.protocol!=='https:'||!allowed(current.hostname)||current.username||current.password)throw Error('invalid_avatar_source');
   let response:Response|undefined;
   for(let i=0;i<4;i++){
    response=await fetch(current,{redirect:'manual',signal:AbortSignal.timeout(12_000),headers:{Accept:'image/avif,image/webp,image/png,image/jpeg'}});
    if([301,302,303,307,308].includes(response.status)){if(i===3)throw Error('avatar_redirect_limit');const location=response.headers.get('location');if(!location)throw Error('avatar_redirect_invalid');const next=new URL(location,current);if(next.protocol!=='https:'||!allowed(next.hostname)||next.username||next.password)throw Error('avatar_redirect_invalid');current=next;continue;}
    break;
   }
   if(!response?.ok)throw Error('avatar_unavailable');const mime=(response.headers.get('content-type')??'').split(';')[0]!.toLowerCase();if(!['image/png','image/jpeg','image/webp','image/gif','image/avif'].includes(mime))throw Error('avatar_type_invalid');
   const chunks:Buffer[]=[];let size=0;if(!response.body)throw Error('avatar_unavailable');for await(const chunk of response.body){const part=Buffer.from(chunk);size+=part.length;if(size>2*1024*1024)throw Error('avatar_too_large');chunks.push(part);}return {bytes:Buffer.concat(chunks),mime};
  },
 };
}

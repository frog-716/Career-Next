import {createHash,randomUUID} from 'node:crypto';
import {chmod,mkdir,open,readFile,rename,stat,unlink} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';

export type FeishuAuthState='ready'|'not_configured'|'needs_refresh'|'denied'|'unavailable';
export type FeishuConnectionState='not_connected'|'connected'|'connection_invalid'|'reauthorization_required';
export type FeishuIdentity={connected:true;provider:'feishu';displayName:string;avatar:'feishu/avatar'|null};
export type FeishuConnectionStatus={provider:'feishu';state:FeishuConnectionState};
export type FeishuUserProfile={displayName:string;avatarUrl?:string};
export type FeishuAvatar={bytes:Buffer;mime:string};
export type FeishuConnectorPorts={
 profileRoot:string;
 authState():Promise<FeishuAuthState>;
 readCurrentUser():Promise<FeishuUserProfile>;
 downloadAvatar(url:string):Promise<{bytes:Buffer;mime:string}>;
};

const CachedIdentity=z.strictObject({provider:z.literal('feishu'),status:z.literal('connected'),displayNameSource:z.literal('nickname'),displayName:z.string().min(1).max(255),avatarFile:z.string().regex(/^avatar\.(png|jpg|webp|gif|avif)$/).nullable(),avatarMime:z.enum(['image/png','image/jpeg','image/webp','image/gif','image/avif']).nullable(),avatarSha256:z.string().regex(/^[a-f0-9]{64}$/).nullable(),updatedAt:z.string().datetime()});
type CachedIdentity=z.infer<typeof CachedIdentity>;
const AvatarMime=z.enum(['image/png','image/jpeg','image/webp','image/gif','image/avif']);
const imageExtensions:Record<z.infer<typeof AvatarMime>,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
function authToState(state:FeishuAuthState):FeishuConnectionState{
 if(state==='ready')return 'connected';
 if(state==='needs_refresh')return 'reauthorization_required';
 if(state==='not_configured')return 'not_connected';
 return 'connection_invalid';
}
function safeAvatarUrl(value:string){const url=new URL(value);const host=url.hostname.toLowerCase();if(url.protocol!=='https:'||url.username||url.password||!(host==='feishucdn.com'||host.endsWith('.feishucdn.com')))throw Error('invalid_avatar_source');return url;}
async function syncDirectory(directory:string){const handle=await open(directory,'r');try{await handle.sync();}finally{await handle.close();}}
async function writeAtomic(filename:string,bytes:Buffer){const temporary=filename+'.'+randomUUID()+'.pending',file=await open(temporary,'wx',0o600);try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}try{await rename(temporary,filename);await syncDirectory(path.dirname(filename));}catch(error){await unlink(temporary).catch(()=>{});throw error;}}

/** Identity-only Feishu connector. It stores a local display cache, never credentials or business data. */
export function createFeishuConnector(ports:FeishuConnectorPorts){
 const root=path.resolve(ports.profileRoot,'connectors','feishu'),metadataPath=path.join(root,'identity.json');
 async function cached():Promise<{value?:CachedIdentity;invalid:boolean}>{
  try{const info=await stat(metadataPath);if(!info.isFile()||(info.mode&0o077)!==0)return {invalid:true};return {value:CachedIdentity.parse(JSON.parse(await readFile(metadataPath,'utf8'))),invalid:false};}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {invalid:false};return {invalid:true};}
 }
 async function state():Promise<FeishuConnectionStatus>{
  let auth:FeishuAuthState;try{auth=await ports.authState();}catch{return {provider:'feishu',state:'connection_invalid'};}
  if(auth!=='ready')return {provider:'feishu',state:authToState(auth)};
  const value=await cached();return {provider:'feishu',state:value.value?'connected':value.invalid?'connection_invalid':'not_connected'};
 }
 async function cacheIdentity(user:FeishuUserProfile){
  const displayName=z.string().trim().min(1).max(255).parse(user.displayName);let avatarFile:string|null=null,avatarMime:CachedIdentity['avatarMime']=null,avatarSha256:string|null=null;
  await mkdir(path.dirname(root),{recursive:true,mode:0o700});await chmod(path.dirname(root),0o700);await mkdir(root,{recursive:true,mode:0o700});await chmod(root,0o700);await syncDirectory(root);
  if(user.avatarUrl){try{
   const url=safeAvatarUrl(user.avatarUrl),avatar=await ports.downloadAvatar(url.href),mime=AvatarMime.safeParse(avatar.mime),ext=mime.success?imageExtensions[mime.data]:undefined;
   if(ext&&mime.success&&avatar.bytes.length>0&&avatar.bytes.length<=2*1024*1024){avatarFile='avatar.'+ext;avatarMime=mime.data;avatarSha256=createHash('sha256').update(avatar.bytes).digest('hex');await writeAtomic(path.join(root,avatarFile),avatar.bytes);}
  }catch{/* A missing avatar stays unavailable; the name remains a valid identity. */}}
  const entry=CachedIdentity.parse({provider:'feishu',status:'connected',displayNameSource:'nickname',displayName,avatarFile,avatarMime,avatarSha256,updatedAt:new Date().toISOString()});
  await writeAtomic(metadataPath,Buffer.from(JSON.stringify(entry)));return entry;
 }
 return {
  getConnectionStatus:state,
  async getCurrentIdentity():Promise<FeishuIdentity>{const current=await state();if(current.state!=='connected')throw Error(current.state);const value=(await cached()).value;if(!value)throw Error('not_connected');return {connected:true,provider:'feishu',displayName:value.displayName,avatar:value.avatarFile?'feishu/avatar':null};},
  async connect():Promise<FeishuConnectionStatus>{
   let auth:FeishuAuthState;try{auth=await ports.authState();}catch{return {provider:'feishu',state:'connection_invalid'};}
   if(auth!=='ready')return {provider:'feishu',state:authToState(auth)};
   try{const user=await ports.readCurrentUser();await cacheIdentity(user);return {provider:'feishu',state:'connected'};}
   catch{return {provider:'feishu',state:'connection_invalid'};}
  },
  async readAvatar():Promise<FeishuAvatar|undefined>{
   const current=await state();if(current.state!=='connected')return undefined;const value=(await cached()).value;if(!value?.avatarFile||!value.avatarMime||!value.avatarSha256)return undefined;
   const filename=path.join(root,value.avatarFile);try{const info=await stat(filename);if(!info.isFile()||(info.mode&0o077)!==0||info.size>2*1024*1024)return undefined;const bytes=await readFile(filename);if(createHash('sha256').update(bytes).digest('hex')!==value.avatarSha256)return undefined;return {bytes,mime:value.avatarMime};}catch{return undefined;}
  },
 };
}

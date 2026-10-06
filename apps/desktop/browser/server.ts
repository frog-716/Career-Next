import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
type Tab={workspace?:string;events:unknown[];expires:number};
export type BrowserContext={bind(workspace:string):void;replaceBinding(workspace:string):void;notify(notice:unknown,workspace:string,skipSelf?:boolean):void};
export type BrowserUpload={name:string;bytes:Buffer;target?:unknown};
type Options={root:string;port:number;identity():{workspaceInstance:string}|undefined;handlers:Record<string,(input:unknown,context:BrowserContext)=>Promise<unknown>>;
 uploads?:Record<string,{maximumBytes:number;handle(input:BrowserUpload,context:BrowserContext):Promise<unknown>}>;
 downloads?:Record<string,(input:unknown,context:BrowserContext)=>Promise<{bytes:Buffer;name:string;type:string}>>};
const token=()=>randomBytes(32).toString('base64url');
/** One loopback transport for enumerated Career contracts; never accepts paths, IPC channels or executable names. */
export async function createBrowserHost(options:Options){
 const sessions=new Map<string,Map<string,Tab>>();let origin='',cookieName='';
 const same=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
 function reply(response:ServerResponse,status:number,value:unknown){response.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});response.end(JSON.stringify(value));}
 // Retain the existing Main 1 MiB JSON-character guard, including multibyte Chinese text.
 async function bytes(request:IncomingMessage,maximum:number){let size=0;const chunks:Buffer[]=[];for await(const chunk of request){size+=chunk.length;if(size>maximum)throw Error('invalid_request');chunks.push(chunk);}return Buffer.concat(chunks);}
 async function body(request:IncomingMessage){return JSON.parse((await bytes(request,4*1024*1024)).toString('utf8')||'{}');}
 const server=createServer((request,response)=>{void (async()=>{
  if(request.headers.host!==new URL(origin).host||!['127.0.0.1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress??''))return reply(response,403,{error:'invalid_capability'});
  const url=new URL(request.url??'/',origin);
  if(url.origin!==origin||url.search)return reply(response,400,{error:'invalid_request'});
  if(url.pathname.startsWith('/api/')){
   if(request.method!=='POST')return reply(response,405,{error:'invalid_request'});
   const operation=url.pathname.slice(5),upload=options.uploads&&Object.hasOwn(options.uploads,operation)?options.uploads[operation]:undefined;
   if(request.headers.origin!==origin||request.headers['content-type']!==(upload?'application/octet-stream':'application/json')||request.headers['sec-fetch-site']&&request.headers['sec-fetch-site']!=='same-origin')return reply(response,403,{error:'invalid_capability'});
   const sessionId=(request.headers.cookie??'').split(';').map(item=>item.trim()).find(item=>item.startsWith(cookieName+'='))?.slice(cookieName.length+1);
   if(url.pathname==='/api/bootstrap'){
    const input=await body(request);if(!input||typeof input!=='object'||Object.keys(input).length)return reply(response,400,{error:'invalid_request'});
    const now=Date.now();for(const [id,tabs]of sessions){for(const [key,tab]of tabs)if(tab.expires<now)tabs.delete(key);if(!tabs.size)sessions.delete(id);}
    if(sessions.size>=64)return reply(response,429,{error:'session_limit'});
    const id=sessionId&&sessions.has(sessionId)?sessionId:token(),tabs=sessions.get(id)??new Map<string,Tab>();if(tabs.size>=64)return reply(response,429,{error:'session_limit'});
    const capability=token();tabs.set(capability,{events:[],expires:now+24*60*60*1000});sessions.set(id,tabs);
    response.setHeader('Set-Cookie',`${cookieName}=${id}; Path=/; HttpOnly; SameSite=Strict`);
    return reply(response,200,{capability,browserFiles:!!options.uploads,browserPdf:!!options.downloads,hostControl:Object.hasOwn(options.handlers,'host/stop')});
   }
   const value=request.headers['x-career-capability'];const capability=typeof value==='string'?value:'';
   if(!/^[A-Za-z0-9_-]{43}$/.test(capability))return reply(response,403,{error:'invalid_capability'});
   const tabs=sessionId?sessions.get(sessionId):undefined;const key=tabs&&[...tabs.keys()].find(key=>same(key,capability));const tab=key?tabs?.get(key):undefined;
   if(!tab||tab.expires<Date.now())return reply(response,403,{error:'invalid_capability'});
   if(operation==='close-tab'){if(key)tabs?.delete(key);return reply(response,200,{ok:true});}
   if(operation==='events'){const events=tab.events.splice(0);return reply(response,200,{ok:true,result:events});}
   const download=options.downloads&&Object.hasOwn(options.downloads,operation)?options.downloads[operation]:undefined;
   const handler=Object.hasOwn(options.handlers,operation)?options.handlers[operation]:undefined;if(!handler&&!upload&&!download)return reply(response,404,{error:'invalid_request'});
   if(operation!=='ready'&&operation!=='reconnect'&&(!tab.workspace||tab.workspace!==options.identity()?.workspaceInstance))return reply(response,409,{error:'workspace_changed_reload_required'});
   const admittedWorkspace=tab.workspace;
   let input:unknown;
   if(upload){const metadata=request.headers['x-career-upload-metadata'];if(typeof metadata!=='string'||metadata.length>8192)throw Error('invalid_request');const value=JSON.parse(decodeURIComponent(metadata));if(!value||typeof value.name!=='string'||Object.keys(value).some(key=>!['name','target'].includes(key)))throw Error('invalid_request');input={...value,bytes:await bytes(request,upload.maximumBytes)};}else input=await body(request);
   if(!key||tabs?.get(key)!==tab)return reply(response,403,{error:'invalid_capability'});
   // Restore may happen while a request body is arriving. Recheck immediately before dispatch.
   if(operation!=='ready'&&operation!=='reconnect'&&(admittedWorkspace!==options.identity()?.workspaceInstance||tab.workspace!==admittedWorkspace))return reply(response,409,{error:'workspace_changed_reload_required'});
   const context:BrowserContext={bind(workspace){if(tab.workspace&&tab.workspace!==workspace)throw Error('workspace_changed_reload_required');tab.workspace=workspace;},replaceBinding(workspace){tab.workspace=workspace;},notify(notice,workspace,skipSelf){for(const group of sessions.values())for(const other of group.values())if(other.workspace===workspace&&(!skipSelf||other!==tab)){other.events.push(notice);if(other.events.length>128)other.events=[{kind:'reload_required'}];}}};
   if(download){const result=await download(input,context);if(tabs?.get(key)!==tab||tab.workspace!==options.identity()?.workspaceInstance)throw Error('invalid_capability');response.writeHead(200,{...headers,'Content-Type':result.type,'Content-Disposition':`attachment; filename="Career-export.pdf"; filename*=UTF-8''${encodeURIComponent(result.name)}`});response.end(result.bytes);return;}
   const result=upload?await upload.handle(input as BrowserUpload,context):await handler!(input,context);return reply(response,200,{ok:true,result});
  }
  const topLevelAppNavigation=request.headers['sec-fetch-mode']==='navigate'&&request.headers['sec-fetch-dest']==='document'&&(url.pathname==='/'||url.pathname==='/index.html');
  if(!['GET','HEAD'].includes(request.method??'')||request.headers['sec-fetch-site']==='cross-site'&&!topLevelAppNavigation)return reply(response,403,{error:'invalid_capability'});
  if(url.pathname==='/host-status')return reply(response,200,{pid:process.pid,instance,ready:!!options.identity()});
  const filename=path.resolve(options.root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!filename.startsWith(path.resolve(options.root)+path.sep))return reply(response,403,{error:'invalid_capability'});
  try{const info=await lstat(filename);if(!info.isFile()||info.isSymbolicLink())return reply(response,403,{error:'invalid_capability'});const bytes=await readFile(filename);const extension=path.extname(filename);const type=({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'} as Record<string,string>)[extension];if(!type)return reply(response,404,{error:'invalid_request'});response.writeHead(200,{...headers,'Content-Type':type});response.end(request.method==='HEAD'?undefined:bytes);}catch{return reply(response,404,{error:'not_found'});}
 })().catch(error=>{if(response.headersSent){response.end();return;}const allowed=['disconnected','workspace_changed_reload_required','credential_cancelled','credential_denied','credential_timeout','credential_unavailable','invalid_request','invalid_capability'];reply(response,400,{error:allowed.includes(error?.message)?error.message:'invalid_request'});});});
 server.requestTimeout=30_000;server.headersTimeout=10_000;
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(options.port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});
 const address=server.address();if(!address||typeof address==='string')throw Error('browser_host_failed');origin=`http://127.0.0.1:${address.port}`;cookieName='career_session_'+address.port;
 const instance=token();
 return {url:origin,address:address.address,instance,close:()=>new Promise<void>((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();})};
}

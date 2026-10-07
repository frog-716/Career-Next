import {it,expect,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {randomUUID} from 'node:crypto';
import {createNodeHost} from '../../apps/desktop/node/host';

it('metadata search is a protected read capability, leaves business owners unchanged and does not refresh F1 on restart',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'career-F2-TEST-'));let host:Awaited<ReturnType<typeof createNodeHost>>|undefined;
 const identityRead=vi.fn(async()=>({displayName:'TEST nickname'})),searchDocuments=vi.fn(async()=>({hasMore:false,items:[{documentId:'private-document-reference',title:'TEST Material',type:'docx' as const,updatedAt:null,url:null}]}));
 const options={profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false,feishuPorts:{authState:async()=>'ready' as const,readCurrentUser:identityRead,downloadAvatar:async()=>({bytes:Buffer.alloc(0),mime:'image/png'})},feishuDiscoveryPorts:{searchDocuments}};
 const context={bind(){},replaceBinding(){},notify(){}};
 try{
  host=await createNodeHost(options);await host.handlers['feishu/connect']({},context);
  const readBusiness=async()=>({profile:await host!.handlers['business/profile']({operation:'profile.read'},context),wiki:await host!.handlers['business/wiki']({operation:'list',includeRetired:true},context),raw:await host!.handlers.materials({operation:'list'},context)});
  const before=await readBusiness(),input={searchId:randomUUID(),query:'Material'};
  const first:any=await host.handlers['feishu/search'](input,context);expect(first.kind).toBe('results');expect(first.items[0].title).toBe('TEST Material');expect(JSON.stringify(first)).not.toContain('private-document-reference');
  expect(await host.handlers['feishu/search'](input,context)).toEqual(first);expect(searchDocuments).toHaveBeenCalledTimes(1);expect(await readBusiness()).toEqual(before);
  const endpoint=host.url+'/api/feishu/search',post=(headers:Record<string,string>={},body=JSON.stringify(input))=>fetch(endpoint,{method:'POST',headers:{Origin:host!.url,'Content-Type':'application/json',...headers},body});
  expect((await post()).status).toBe(403);
  const boot=await fetch(host.url+'/api/bootstrap',{method:'POST',headers:{Origin:host.url,'Content-Type':'application/json'},body:'{}'}),cookie=boot.headers.get('set-cookie')!.split(';')[0]!,capability=(await boot.json()).capability;
  const headers={Cookie:cookie,'X-Career-Capability':capability,Origin:host.url,'Content-Type':'application/json'};
  await fetch(host.url+'/api/ready',{method:'POST',headers,body:'{}'});
  expect((await post({...headers,Origin:'https://other.example'})).status).toBe(403);
  const invalid=await post(headers,JSON.stringify({...input,path:'/docx/body',token:'NEVER PASS'}));expect((await invalid.json()).result).toEqual({kind:'failure',reason:'invalid_request'});
  expect((await fetch(host.url+'/api/feishu/body',{method:'POST',headers,body:'{}'})).status).toBe(404);expect(searchDocuments).toHaveBeenCalledTimes(1);
  await host.close();host=await createNodeHost(options);expect(await host.handlers['feishu/identity']({},context)).toMatchObject({displayName:'TEST nickname'});expect(identityRead).toHaveBeenCalledTimes(1);expect(await readBusiness()).toEqual(before);expect(searchDocuments).toHaveBeenCalledTimes(1);
 }finally{await host?.close();await rm(profile,{recursive:true,force:true});}
},30000);

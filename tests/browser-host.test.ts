import {afterEach,expect,test} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {request as httpRequest} from 'node:http';
import {createBrowserHost} from '../apps/desktop/browser/server';
let close:(()=>Promise<void>)|undefined,root:string;
afterEach(async()=>{await close?.();if(root)await rm(root,{recursive:true,force:true});});
test('only the loopback Career page can establish a bound, CSRF-protected tab',async()=>{
 root=await mkdtemp(path.join(tmpdir(),'career-web-'));await writeFile(path.join(root,'index.html'),'<h1>Career</h1>');
 const host=await createBrowserHost({root,port:0,identity:()=>({workspaceInstance:'workspace-a'}),handlers:{ready:async input=>({workspaceInstance:'workspace-a',characters:input&&typeof input==='object'&&'text'in input&&typeof input.text==='string'?input.text.length:0})}});close=host.close;
 expect(host.address).toBe('127.0.0.1');
 expect((await fetch(host.url+'/api/bootstrap',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'})).status).toBe(403);
 const boot=await fetch(host.url+'/api/bootstrap',{method:'POST',headers:{Origin:host.url,'Content-Type':'application/json'},body:'{}'});
 expect(boot.status).toBe(200);expect(boot.headers.get('set-cookie')).toContain('HttpOnly; SameSite=Strict');
 const cookie=boot.headers.get('set-cookie')!.split(';')[0]!,{capability}=await boot.json();
 const request=(extra:Record<string,string>={})=>fetch(host.url+'/api/ready',{method:'POST',headers:{Origin:host.url,'Content-Type':'application/json',Cookie:cookie,'X-Career-Capability':capability,...extra},body:'{}'});
 expect((await request()).status).toBe(200);
 const chinese=await fetch(host.url+'/api/ready',{method:'POST',headers:{Origin:host.url,'Content-Type':'application/json',Cookie:cookie,'X-Career-Capability':capability},body:JSON.stringify({text:'中'.repeat(500000)})});expect(chinese.status).toBe(200);expect((await chinese.json()).result.characters).toBe(500000);
 expect((await request({Origin:'https://evil.example'})).status).toBe(403);
 expect((await request({'X-Career-Capability':'forged'})).status).toBe(403);
 const forgedHost=await new Promise<number>(resolve=>{const req=httpRequest(host.url+'/api/ready',{method:'POST',headers:{Host:'evil.example',Origin:host.url,'Content-Type':'application/json',Cookie:cookie,'X-Career-Capability':capability}},response=>{response.resume();resolve(response.statusCode!);});req.end('{}');});expect(forgedHost).toBe(403);
 expect((await fetch(host.url+'/api/ready')).status).toBe(405);
 expect((await fetch(host.url+'/api/arbitrary',{method:'POST',headers:{Origin:host.url,'Content-Type':'application/json',Cookie:cookie,'X-Career-Capability':capability},body:'{}'})).status).toBe(404);
});
test('separate tab capabilities preserve purge delivery and refuse an old workspace after restore',async()=>{
 root=await mkdtemp(path.join(tmpdir(),'career-web-'));await writeFile(path.join(root,'index.html'),'<h1>Career</h1>');let workspace='a';
 const host=await createBrowserHost({root,port:0,identity:()=>({workspaceInstance:workspace}),handlers:{ready:async(_input,context)=>{context.bind(workspace);return {workspaceInstance:workspace};},read:async()=>({workspace}),purge:async(_input,context)=>{context.notify({purged:true},workspace);return {};},restore:async(_input,context)=>{const previous=workspace;workspace='b';context.notify({kind:'workspace_changed'},previous,true);context.replaceBinding(workspace);return {};}}});close=host.close;
 let cookie='';async function boot(){const response=await fetch(host.url+'/api/bootstrap',{method:'POST',headers:{Origin:host.url,'Content-Type':'application/json',Cookie:cookie},body:'{}'});cookie=response.headers.get('set-cookie')!.split(';')[0]!;return (await response.json()).capability as string;}
 const one=await boot(),two=await boot();expect(one).not.toBe(two);
 const post=(capability:string,route:string)=>fetch(host.url+'/api/'+route,{method:'POST',headers:{Origin:host.url,'Content-Type':'application/json',Cookie:cookie,'X-Career-Capability':capability},body:'{}'});
 await post(one,'ready');await post(two,'ready');await post(one,'purge');
 expect((await (await post(two,'events')).json()).result).toEqual([{purged:true}]);
 await post(one,'restore');expect((await post(one,'read')).status).toBe(200);expect((await post(two,'read')).status).toBe(409);expect((await post(two,'ready')).status).toBe(400);
 expect((await (await post(two,'events')).json()).result).toEqual([{kind:'workspace_changed'}]);
 const three=await boot();await post(three,'ready');expect((await (await post(three,'read')).json()).result.workspace).toBe('b');
});
test('does not turn file paths, keys, malformed bodies, or cross-site fetches into an RPC',async()=>{
 root=await mkdtemp(path.join(tmpdir(),'career-web-'));await writeFile(path.join(root,'index.html'),'<h1>Career</h1>');
 const host=await createBrowserHost({root,port:0,identity:()=>({workspaceInstance:'a'}),handlers:{ready:async(_input,context)=>{context.bind('a');return {};},'secrets/deepseek':async()=>({kind:'status',status:{configured:false,enabled:false}})}});close=host.close;
 const boot=await fetch(host.url+'/api/bootstrap',{method:'POST',headers:{Origin:host.url,'Content-Type':'application/json'},body:'{}'}),cookie=boot.headers.get('set-cookie')!.split(';')[0]!,capability=(await boot.json()).capability;
 const headers={Origin:host.url,'Content-Type':'application/json',Cookie:cookie,'X-Career-Capability':capability};
 await fetch(host.url+'/api/ready',{method:'POST',headers,body:'{}'});
 expect((await fetch(host.url+'/api/secrets/read',{method:'POST',headers,body:'{}'})).status).toBe(404);
 expect((await fetch(host.url+'/api/constructor',{method:'POST',headers,body:'{}'})).status).toBe(404);
 expect((await fetch(host.url+'/api/ready?key=not-a-secret',{method:'POST',headers,body:'{}'})).status).toBe(400);
 expect((await fetch(host.url+'/api/ready',{method:'POST',headers:{...headers,'Sec-Fetch-Site':'cross-site'},body:'{}'})).status).toBe(403);
 expect((await fetch(host.url+'/api/ready',{method:'POST',headers,body:'{'})).status).toBe(400);
 expect((await fetch(host.url+'/api/ready',{method:'POST',headers,body:JSON.stringify({large:'x'.repeat(4*1024*1024)})})).status).toBe(400);
 const page=await fetch(host.url);expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");expect(page.headers.get('cache-control')).toBe('no-store');
});
test('a slow request cannot write into a restored workspace, and closing a tab revokes its capability',async()=>{
 root=await mkdtemp(path.join(tmpdir(),'career-web-'));await writeFile(path.join(root,'index.html'),'<h1>Career</h1>');let workspace='a',writes=0;
 const host=await createBrowserHost({root,port:0,identity:()=>({workspaceInstance:workspace}),handlers:{ready:async(_input,context)=>{context.bind(workspace);return {};},write:async()=>{writes++;return {};},restore:async(_input,context)=>{workspace='b';context.replaceBinding(workspace);return {};}}});close=host.close;
 const boot=await fetch(host.url+'/api/bootstrap',{method:'POST',headers:{Origin:host.url,'Content-Type':'application/json'},body:'{}'}),cookie=boot.headers.get('set-cookie')!.split(';')[0]!,capability=(await boot.json()).capability;
 const headers={Origin:host.url,'Content-Type':'application/json',Cookie:cookie,'X-Career-Capability':capability};const post=(route:string)=>fetch(host.url+'/api/'+route,{method:'POST',headers,body:'{}'});await post('ready');
 let delayed:ReturnType<typeof httpRequest>;
 const response=new Promise<number>(resolve=>{delayed=httpRequest(host.url+'/api/write',{method:'POST',headers},result=>{result.resume();resolve(result.statusCode!);});delayed.write('{');});
 await new Promise(resolve=>setTimeout(resolve,40));await post('restore');delayed!.end('}');expect(await response).toBe(409);expect(writes).toBe(0);
 await post('close-tab');expect((await post('write')).status).toBe(403);
});

test('binary uploads and downloads retain session, origin and workspace admission',async()=>{
 close=undefined;
 const directory=await mkdtemp(path.join(tmpdir(),'career-E1-TEST-http-'));await writeFile(path.join(directory,'index.html'),'TEST');let current='w1',calls=0;
 const host=await createBrowserHost({root:directory,port:0,identity:()=>({workspaceInstance:current}),handlers:{ready:async(_,context)=>{context.bind(current);return {}; }},uploads:{'files/materials':{maximumBytes:8,handle:async input=>{calls++;return {size:input.bytes.length};}}},downloads:{'files/resume-pdf':async()=>({bytes:Buffer.from('%PDF-TEST'),name:'TEST.pdf',type:'application/pdf'})}});
 try{const post=(endpoint:string,body:BodyInit,headers:Record<string,string>={})=>fetch(host.url+'/api/'+endpoint,{method:'POST',headers:{Origin:host.url,'Content-Type':'application/json',...headers},body});const bootstrap=await post('bootstrap','{}'),cookie=bootstrap.headers.get('set-cookie')!.split(';')[0],capability=(await bootstrap.json()).capability,auth={Cookie:cookie,'X-Career-Capability':capability};await post('ready','{}',auth);
  expect((await post('files/materials',Buffer.from('TEST'),{...auth,'Content-Type':'application/octet-stream','X-Career-Upload-Metadata':encodeURIComponent(JSON.stringify({name:'TEST.txt'}))})).status).toBe(200);
  expect((await post('files/materials',Buffer.from('TEST'),{...auth,Origin:'https://example.com','Content-Type':'application/octet-stream'})).status).toBe(403);
  expect((await post('files/materials',Buffer.alloc(9),{...auth,'Content-Type':'application/octet-stream','X-Career-Upload-Metadata':encodeURIComponent(JSON.stringify({name:'TEST.txt'}))})).status).toBe(400);
  const pdf=await post('files/resume-pdf','{}',auth);expect(await pdf.text()).toBe('%PDF-TEST');expect(pdf.headers.get('content-disposition')).toContain('attachment');
  current='w2';expect((await post('files/materials',Buffer.from('TEST'),{...auth,'Content-Type':'application/octet-stream'})).status).toBe(409);expect(calls).toBe(1);
 }finally{await host.close();await rm(directory,{recursive:true,force:true});}
});

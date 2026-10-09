import {test,expect,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';
import {createNodeHost} from '../../apps/desktop/node/host';
import {createFeishuConnector} from '../../packages/backend/platform/connectors/feishu/connector';
test('Bitable structure is a protected session-only capability; business data and cached F1 identity stay unchanged',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'career-F3A-TEST-'));let host:Awaited<ReturnType<typeof createNodeHost>>|undefined;
 const reads=vi.fn(async()=>({displayName:'TEST nickname'})),search=vi.fn(async()=>{throw Error('NO SEARCH AUTHORIZED')});
 const options={profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false,feishuSelectedBitable:{title:'TEST Base',url:'https://test.feishu.cn/base/TESTBitableIdentity12345?table=wkfIGNORE'},feishuPorts:{authState:async()=>'ready' as const,readCurrentUser:reads,downloadAvatar:async()=>({bytes:Buffer.alloc(0),mime:'image/png'})},feishuDiscoveryPorts:{searchDocuments:search},feishuBitablePorts:{listTables:async()=>({items:[{id:'tblTEST',name:'TEST Table'}],hasMore:false}),listViews:async()=>({items:[{id:'vewTEST',name:'TEST All',type:'grid'}],hasMore:false}),listFields:async()=>({items:[{name:'TEST Field',type:'text'}],hasMore:false})}};
 const context={bind(){},replaceBinding(){},notify(){}};
 try{
  await createFeishuConnector({profileRoot:profile,...options.feishuPorts}).connect();host=await createNodeHost(options);
  const business=async()=>({profile:await host!.handlers['business/profile']({operation:'profile.read'},context),wiki:await host!.handlers['business/wiki']({operation:'list',includeRetired:true},context),raw:await host!.handlers.materials({operation:'list'},context)});const before=await business();
  const selected:any=await host.handlers['feishu/bitable/selected']({},context);expect(selected).toMatchObject({title:'TEST Base',type:'bitable',url:null});expect(JSON.stringify(selected)).not.toContain('TESTBitableIdentity12345');
  const boot=await fetch(host.url+'/api/bootstrap',{method:'POST',headers:{Origin:host.url,'Content-Type':'application/json'},body:'{}'});const headers={Origin:host.url,'Content-Type':'application/json',Cookie:boot.headers.get('set-cookie')!.split(';')[0]!,'X-Career-Capability':(await boot.json()).capability};await fetch(host.url+'/api/ready',{method:'POST',headers,body:'{}'});
  const send=(route:string,data:unknown,h=headers)=>fetch(host!.url+'/api/'+route,{method:'POST',headers:h,body:JSON.stringify(data)});
  expect((await send('feishu/bitable/tables',{selectedRef:selected.ref},{...headers,Origin:'https://other.example'})).status).toBe(403);
  const tables=(await(await send('feishu/bitable/tables',{selectedRef:selected.ref})).json()).result;expect(tables.kind).toBe('tables');expect(JSON.stringify(tables)).not.toContain('tblTEST');const tableRef=tables.items[0].ref;
  expect((await(await send('feishu/bitable/views',{tableRef})).json()).result).toMatchObject({kind:'views',items:[{name:'TEST All'}]});expect((await(await send('feishu/bitable/fields',{tableRef})).json()).result).toMatchObject({kind:'fields',items:[{name:'TEST Field'}]});
  expect((await(await send('feishu/bitable/fields',{tableRef,recordId:'FORBIDDEN'})).json()).result).toEqual({kind:'failure',reason:'invalid_request'});expect((await send('feishu/bitable/records',{})).status).toBe(404);expect((await send('feishu/rawApi',{})).status).toBe(404);expect(await business()).toEqual(before);expect(search).not.toHaveBeenCalled();
  await host.close();host=await createNodeHost(options);expect(await host.handlers['feishu/identity']({},context)).toMatchObject({displayName:'TEST nickname'});expect(reads).toHaveBeenCalledTimes(1);expect(await host.handlers['feishu/bitable/views']({tableRef},context)).toEqual({kind:'failure',reason:'reference_unavailable'});expect(await business()).toEqual(before);
 }finally{await host?.close();await rm(profile,{recursive:true,force:true});}
},30000);

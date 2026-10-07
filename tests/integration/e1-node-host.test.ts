import {it,expect,vi} from 'vitest';
import {mkdtemp,readdir,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
const disk=vi.hoisted(()=>({failManifest:false}));
vi.mock('node:fs/promises',async importOriginal=>{const real=await importOriginal<typeof import('node:fs/promises')>();return {...real,rm:async (file:any,options:any)=>{if(disk.failManifest&&String(file).endsWith('/node-bootstrap-pending.json')){disk.failManifest=false;throw Error('TEST_disk_write_failed');}return real.rm(file,options);}};});
import {createNodeHost} from '../../apps/desktop/node/host';
it('Feishu identity stays platform-only across restart and denies arbitrary Contact targets before any read',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'career-F1-TEST-host-'));let host:Awaited<ReturnType<typeof createNodeHost>>|undefined,reads=0;
 const feishuPorts={authState:async()=>'ready' as const,readCurrentUser:async()=>{reads++;return {displayName:'TEST nickname',avatarUrl:'https://s3-imfile.feishucdn.com/avatar.jpg'};},downloadAvatar:async()=>({bytes:Buffer.from('TEST AVATAR'),mime:'image/jpeg'})};
 const options={profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false,feishuPorts};
 const context={bind(){},replaceBinding(){},notify(){}};
 try{
  host=await createNodeHost(options);
  const before=await host.handlers['business/profile']({operation:'profile.read'},context);
  await expect(host.handlers['feishu/connect']({open_id:'ou_other_test_user'},context)).rejects.toThrow();expect(reads).toBe(0);
  expect(await host.handlers['feishu/connect']({},context)).toEqual({provider:'feishu',state:'connected'});expect(reads).toBe(1);
  expect(await host.handlers['feishu/identity']({},context)).toEqual({connected:true,provider:'feishu',displayName:'TEST nickname',avatar:'feishu/avatar'});
  expect(Object.keys(host.handlers).filter(x=>x.startsWith('feishu/')).sort()).toEqual(['feishu/bitable/fields','feishu/bitable/selected','feishu/bitable/tables','feishu/bitable/views','feishu/connect','feishu/identity','feishu/search','feishu/status']);
  expect(await host.handlers['business/profile']({operation:'profile.read'},context)).toEqual(before);
  const backup:any=await host.handlers['business/application']({operation:'data.backup'},context);expect(backup.kind).toBe('backup');
  expect((await readdir(path.join(profile,backup.copy.relativePath))).sort()).toEqual(['backup.json','blobs','career.sqlite']);
  await host.close();host=await createNodeHost(options);
  expect(await host.handlers['feishu/status']({},context)).toEqual({provider:'feishu',state:'connected'});
  expect(await host.handlers['feishu/identity']({},context)).toMatchObject({displayName:'TEST nickname'});expect(reads).toBe(1);
  expect(await host.handlers['business/profile']({operation:'profile.read'},context)).toEqual(before);
 }finally{await host?.close();await rm(profile,{recursive:true,force:true});}
});
it('standalone Node host persists through reconnect and refuses a second SQLite writer',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'career-e1-TEST-'));let host:Awaited<ReturnType<typeof createNodeHost>>|undefined;
 try{
  host=await createNodeHost({profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false});
  expect(host.address).toBe('127.0.0.1');
  const ready=await host.handlers.ready({}, {bind(){},replaceBinding(){},notify(){}});expect(ready).toHaveProperty('workspaceInstance');
  const created:any=await host.handlers['business/opportunity']({operation:'company.create',commandId:randomUUID(),name:'E1 TEST Company'}, {bind(){},replaceBinding(){},notify(){}});expect(created.kind).toBe('company');
  await expect(createNodeHost({profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false})).rejects.toThrow('workspace_busy');
  await host.close();host=await createNodeHost({profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false});
  const list:any=await host.handlers['business/opportunity']({operation:'company.list'}, {bind(){},replaceBinding(){},notify(){}});expect(list.items.map((x:any)=>x.id)).toEqual([created.company.id]);
 }finally{await host?.close();await rm(profile,{recursive:true,force:true});}
});

it('a failed final bootstrap disk operation releases the writer before a same-process retry',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'career-E1-TEST-init-cleanup-'));let host:Awaited<ReturnType<typeof createNodeHost>>|undefined;
 const options={profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false};
 try{disk.failManifest=true;await expect(createNodeHost(options)).rejects.toThrow('TEST_disk_write_failed');host=await createNodeHost(options);expect(host.identity().workspaceInstance).toMatch(/^[a-f0-9-]{36}$/);
 }finally{disk.failManifest=false;await host?.close();await rm(profile,{recursive:true,force:true});}
});

it('an interrupted first bootstrap retries its explicit startup journal without guessing a lost active pointer',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'career-E1-TEST-firstboot-')),bad=await mkdtemp(path.join(tmpdir(),'career-E1-TEST-missing-runtime-'));let host:Awaited<ReturnType<typeof createNodeHost>>|undefined;
 const options={profile,webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false};
 try{await expect(createNodeHost({...options,artifacts:bad})).rejects.toThrow();host=await createNodeHost({...options,artifacts:path.resolve('dist/application')});expect(host.identity().workspaceInstance).toMatch(/^[a-f0-9-]{36}$/);
 }finally{await host?.close();await rm(profile,{recursive:true,force:true});await rm(bad,{recursive:true,force:true});}
});

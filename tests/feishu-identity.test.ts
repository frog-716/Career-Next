import {afterEach,expect,test,vi} from 'vitest';
import {mkdir,mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createFeishuConnector,type FeishuAuthState} from '../packages/backend/platform/connectors/feishu/connector';
import {FeishuCurrentIdentity,FeishuConnectionStatus} from '../packages/contracts/platform/feishu-identity';

let root='';
afterEach(async()=>{if(root)await rm(root,{recursive:true,force:true});});

async function fixture(authState:FeishuAuthState='ready'){
 root=await mkdtemp(path.join(tmpdir(),'career-feishu-identity-'));
 const readCurrentUser=vi.fn(async()=>({displayName:'飞书测试用户',avatarUrl:'https://s3-imfile.feishucdn.com/avatar.jpg',accessToken:'never-persist-this'}));
 const downloadAvatar=vi.fn(async()=>({bytes:Buffer.from('TEST-AVATAR'),mime:'image/jpeg'}));
 const connector=createFeishuConnector({profileRoot:root,authState:async()=>authState,readCurrentUser,downloadAvatar});
 return{connector,readCurrentUser,downloadAvatar};
}

test('unconnected and expired user authorization have distinct safe states and do not read identity',async()=>{
 const first=await fixture('not_configured');
 expect(await first.connector.getConnectionStatus()).toEqual({provider:'feishu',state:'not_connected'});
 const second=await fixture('needs_refresh');
 expect(await second.connector.getConnectionStatus()).toEqual({provider:'feishu',state:'reauthorization_required'});
 expect(first.readCurrentUser).not.toHaveBeenCalled();expect(second.readCurrentUser).not.toHaveBeenCalled();
});

test('a connected identity is cached outside the business workspace and exposes only the connected nickname and protected avatar resource',async()=>{
 const {connector,readCurrentUser,downloadAvatar}=await fixture();
 expect(await connector.connect()).toEqual({provider:'feishu',state:'connected'});
 expect(await connector.getConnectionStatus()).toEqual({provider:'feishu',state:'connected'});
 expect(await connector.getCurrentIdentity()).toEqual({connected:true,provider:'feishu',displayName:'飞书测试用户',avatar:'feishu/avatar'});
 expect(await connector.readAvatar()).toEqual({bytes:Buffer.from('TEST-AVATAR'),mime:'image/jpeg'});
 expect(readCurrentUser).toHaveBeenCalledTimes(1);expect(downloadAvatar).toHaveBeenCalledTimes(1);
 const directory=path.join(root,'connectors','feishu'),metadata=JSON.parse(await readFile(path.join(directory,'identity.json'),'utf8'));
 expect((await stat(path.dirname(directory))).mode&0o777).toBe(0o700);
 expect(metadata).toMatchObject({provider:'feishu',status:'connected',displayName:'飞书测试用户',avatarFile:'avatar.jpg',avatarMime:'image/jpeg'});
 expect(JSON.stringify(metadata)).not.toMatch(/accessToken|refreshToken|never-persist-this|open_id|email|phone/i);
 expect((await stat(directory)).mode&0o777).toBe(0o700);
 expect((await stat(path.join(directory,'avatar.jpg'))).mode&0o777).toBe(0o600);
 expect(JSON.stringify(await connector.getCurrentIdentity())).not.toMatch(/token|email|phone|profile|resume/i);
});

test('backend restart reuses only the local identity cache without another Feishu lookup',async()=>{
 const first=await fixture();await first.connector.connect();
 const restarted=createFeishuConnector({profileRoot:root,authState:async()=>'ready',readCurrentUser:first.readCurrentUser,downloadAvatar:first.downloadAvatar});
 expect(await restarted.getConnectionStatus()).toEqual({provider:'feishu',state:'connected'});
 expect(await restarted.getCurrentIdentity()).toEqual({connected:true,provider:'feishu',displayName:'飞书测试用户',avatar:'feishu/avatar'});
 expect(first.readCurrentUser).toHaveBeenCalledTimes(1);
});

test('old name-based caches cannot present a directory label as a confirmed nickname',async()=>{
 const {connector,readCurrentUser}=await fixture();const directory=path.join(root,'connectors','feishu');await mkdir(directory,{recursive:true,mode:0o700});
 await writeFile(path.join(directory,'identity.json'),JSON.stringify({provider:'feishu',status:'connected',displayName:'旧目录测试标签',avatarFile:null,avatarMime:null,avatarSha256:null,updatedAt:new Date().toISOString()}),{mode:0o600});
 expect(await connector.getConnectionStatus()).toEqual({provider:'feishu',state:'connection_invalid'});
 await expect(connector.getCurrentIdentity()).rejects.toThrow('connection_invalid');
 expect(readCurrentUser).not.toHaveBeenCalled();
});

test('an explicit identity refresh updates the cached Feishu display name',async()=>{
 root=await mkdtemp(path.join(tmpdir(),'career-feishu-identity-'));let displayName='旧测试昵称';
 const readCurrentUser=vi.fn(async()=>({displayName,avatarUrl:'https://s3-imfile.feishucdn.com/avatar.jpg'}));
 const connector=createFeishuConnector({profileRoot:root,authState:async()=>'ready',readCurrentUser,downloadAvatar:async()=>({bytes:Buffer.from('TEST-AVATAR'),mime:'image/jpeg'})});
 await connector.connect();displayName='新测试昵称';await connector.connect();
 expect(await connector.getCurrentIdentity()).toMatchObject({displayName:'新测试昵称'});
 expect(readCurrentUser).toHaveBeenCalledTimes(2);
});

test('a failed identity refresh reports failure instead of claiming success from an old cache',async()=>{
 const {connector,readCurrentUser}=await fixture();await connector.connect();
 readCurrentUser.mockRejectedValueOnce(Error('private response details must stay internal'));
 expect(await connector.connect()).toEqual({provider:'feishu',state:'connection_invalid'});
});

test('unavailable local authorization is reported as invalid rather than connected or unconfigured',async()=>{
 const {connector,readCurrentUser}=await fixture('unavailable');
 expect(await connector.getConnectionStatus()).toEqual({provider:'feishu',state:'connection_invalid'});
 expect(readCurrentUser).not.toHaveBeenCalled();
});

test('a denied user authorization and a corrupt local identity cache remain explicitly invalid',async()=>{
 const denied=await fixture('denied');expect(await denied.connector.getConnectionStatus()).toEqual({provider:'feishu',state:'connection_invalid'});expect(denied.readCurrentUser).not.toHaveBeenCalled();
 const {connector}=await fixture();const directory=path.join(root,'connectors','feishu');await mkdir(directory,{recursive:true,mode:0o700});await writeFile(path.join(directory,'identity.json'),'{}',{mode:0o600});
 expect(await connector.getConnectionStatus()).toEqual({provider:'feishu',state:'connection_invalid'});
});

test('browser identity contracts reject credentials, Profile fields and remote avatar URLs',()=>{
 expect(FeishuCurrentIdentity.safeParse({connected:true,provider:'feishu',displayName:'测试用户',avatar:'feishu/avatar'}).success).toBe(true);
 expect(FeishuCurrentIdentity.safeParse({connected:true,provider:'feishu',displayName:'测试用户',avatar:'feishu/avatar',accessToken:'secret'}).success).toBe(false);
 expect(FeishuCurrentIdentity.safeParse({connected:true,provider:'feishu',displayName:'测试用户',avatar:'feishu/avatar',avatarUrl:'https://feishu.example/avatar'}).success).toBe(false);
 expect(FeishuConnectionStatus.safeParse({provider:'feishu',state:'reauthorization_required',token:'secret'}).success).toBe(false);
});

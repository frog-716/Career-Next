import {expect,test,vi} from 'vitest';
import {createLarkCliFeishuPorts,larkCliInvocation} from '../packages/backend/platform/connectors/feishu/lark-cli';

test('node-backed lark-cli scripts run through Career’s fixed Node even with a restricted PATH',()=>{
 expect(larkCliInvocation('/Users/frog/.local/opt/feishu-cli/.runtime/lib/node_modules/@larksuite/cli/scripts/run.js',['auth','status','--json'],'/Career/runtime/node')).toEqual({executable:'/Career/runtime/node',args:['/Users/frog/.local/opt/feishu-cli/.runtime/lib/node_modules/@larksuite/cli/scripts/run.js','auth','status','--json']});
 expect(larkCliInvocation('/usr/bin/example-native',['auth','status'],'/Career/runtime/node')).toEqual({executable:'/usr/bin/example-native',args:['auth','status']});
});

test('local lark-cli status is read as user metadata without token verification or broad scopes',async()=>{
 const run=vi.fn(async(args:string[])=>({code:0,stdout:JSON.stringify({ok:true,identity:'user',identities:{user:{status:'ready',tokenStatus:'valid',access_token:'DO_NOT_EXPOSE'}}})}));
 const ports=createLarkCliFeishuPorts(run);
 expect(await ports.authState()).toBe('ready');expect(run).toHaveBeenCalledWith(['auth','status','--json']);
});

test('current user lookup fixes the Contact target to local user authorization and returns only nickname and avatar',async()=>{
 const avatar='https://s3-imfile.feishucdn.com/profile/avatar.jpg?signature=not-a-token-for-ui';
 const run=vi.fn(async(args:string[])=>({code:0,stdout:JSON.stringify(args[0]==='auth'?{ok:true,identity:'user',identities:{user:{status:'ready',tokenStatus:'valid',openId:'ou_current_test_user'}}}:{ok:true,identity:'user',data:{user:{nickname:'飞书测试昵称',name:'飞书目录测试标签',open_id:'private-open-id',email:'private@example.test',phone:'00000000000',avatar:{avatar_240:avatar}},access_token:'NEVER-RETURN-THIS'}})}));
 const ports=createLarkCliFeishuPorts(run);
 const current=await ports.readCurrentUser();expect(current).toEqual({displayName:'飞书测试昵称',avatarUrl:avatar});
 expect(run.mock.calls.filter(([args])=>args[0]==='api')).toEqual([[['api','GET','/open-apis/contact/v3/users/ou_current_test_user','--params','{"user_id_type":"open_id"}','--as','user','--json']]]);
 expect(JSON.stringify(current)).not.toMatch(/open_id|email|phone|NEVER-RETURN-THIS/i);
});

test('the connected identity prefers the human-facing nickname over a generated directory label',async()=>{
 const run=vi.fn(async(args:string[])=>({code:0,stdout:JSON.stringify(args[0]==='auth'?{identities:{user:{status:'ready',tokenStatus:'valid',openId:'ou_current_test_user'}}}:{ok:true,data:{user:{name:'飞书目录测试标签',nickname:'测试昵称',avatar:{avatar_240:'https://s3-imfile.feishucdn.com/profile/avatar.jpg'}}}})}));
 const current=await createLarkCliFeishuPorts(run).readCurrentUser();
 expect(current.displayName).toBe('测试昵称');
});

test('missing or empty nickname stops after one Contact read instead of falling back to name or en_name',async()=>{
 for(const nickname of [undefined,'','   ']){
  const run=vi.fn(async(args:string[])=>({code:0,stdout:JSON.stringify(args[0]==='auth'?{identities:{user:{status:'ready',tokenStatus:'valid',openId:'ou_current_test_user'}}}:{ok:true,data:{user:{nickname,name:'目录测试标签',en_name:'Directory label',avatar:{avatar_240:'https://s3-imfile.feishucdn.com/avatar.jpg'}}}})}));
  await expect(createLarkCliFeishuPorts(run).readCurrentUser()).rejects.toThrow('feishu_nickname_unavailable');
  expect(run.mock.calls.filter(([args])=>args[0]==='api')).toHaveLength(1);
 }
});

test('the raw Contact success envelope preserves nickname without exposing unrelated returned fields',async()=>{
 const run=vi.fn(async(args:string[])=>({code:0,stdout:JSON.stringify(args[0]==='auth'?{identities:{user:{status:'ready',openId:'ou_current_test_user'}}}:{ok:true,identity:'user',data:{code:0,msg:'success',data:{user:{nickname:'测试昵称',name:'诊断名称',avatar:{avatar_240:'https://s3-imfile.feishucdn.com/avatar.jpg'},email:'unused@example.test'}}}})}));
 expect(await createLarkCliFeishuPorts(run).readCurrentUser()).toEqual({displayName:'测试昵称',avatarUrl:'https://s3-imfile.feishucdn.com/avatar.jpg'});
});

test('expired, revoked and unavailable user authorization remain distinct from an absent connection',async()=>{
 const response=(status:string)=>async()=>({code:0,stdout:JSON.stringify({ok:true,identities:{user:{status}}})});
 expect(await createLarkCliFeishuPorts(response('needs_refresh')).authState()).toBe('needs_refresh');
 expect(await createLarkCliFeishuPorts(response('revoked')).authState()).toBe('denied');
 expect(await createLarkCliFeishuPorts(response('not_configured')).authState()).toBe('not_configured');
 expect(await createLarkCliFeishuPorts(async()=>{throw Error('private failure details');}).authState()).toBe('unavailable');
});

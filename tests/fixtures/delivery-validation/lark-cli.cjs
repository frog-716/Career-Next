'use strict';
// SIMULATED external CLI. Never loads the user's lark-cli or credentials.
const fs = require('node:fs');
const path = require('node:path');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const args = process.argv.slice(2);
const flag = name => args[args.indexOf(name) + 1];
function log(category) {
  fs.appendFileSync(config.audit, JSON.stringify({time:new Date().toISOString(),pid:process.pid,mode:'SIMULATED',category})+'\n', {mode:0o600});
}
let data;
if (args[0] === 'auth' && args[1] === 'status') {
  log('feishu.auth-status');
  data = {identities:{user:{status:'ready',tokenStatus:'valid',openId:'ou_TEST_SIMULATED_USER'}}};
} else if (args[0] === 'api' && args[1] === 'GET' && args[2] === '/open-apis/contact/v3/users/ou_TEST_SIMULATED_USER') {
  log('feishu.contact');
  data = {ok:true,data:{user:{nickname:'TEST SIMULATED 飞书用户'}}};
} else if (args[0] === 'drive' && args[1] === '+search' && args.includes('--only-title') && flag('--as') === 'user') {
  log('feishu.metadata-search');
  data = {ok:true,data:{has_more:false,results:[{documentId:'TESTDocumentToken12345',title:'TEST SIMULATED 云文档项目复盘',type:'docx',updatedAt:'2026-10-08T00:00:00.000Z',url:'https://test.feishu.cn/docx/TESTDocumentToken12345'},{documentId:'TESTSimulatedBase0001',title:'TEST SIMULATED 项目素材',type:'bitable',updatedAt:'2026-10-08T00:00:00.000Z',url:'https://test.feishu.cn/base/TESTSimulatedBase0001'}]}};
} else if (args[0] === 'api' && args[1] === 'GET' && args[2] === '/open-apis/docx/v1/documents/TESTDocumentToken12345' && flag('--as') === 'user') {
  log('feishu.document-metadata');
  data = {ok:true,data:{documentToken:'TESTDocumentToken12345',title:'TEST SIMULATED 云文档项目复盘',revision:7}};
} else if (args[0] === 'api' && args[1] === 'GET' && args[2] === '/open-apis/docx/v1/documents/TESTDocumentToken12345/blocks' && flag('--as') === 'user') {
  const params=JSON.parse(flag('--params'));
  if (params.page_size===100 && params.document_revision_id===7 && !params.page_token) {
    log('feishu.document-blocks');
    data = {ok:true,data:{items:[{id:'TESTDocumentToken12345',parentId:'',type:1,children:['TESTa','TESTb'],text:''},{id:'TESTa',parentId:'TESTDocumentToken12345',type:2,children:[],text:'TEST DATA：虚构职业工作台交付项目。负责资料整理、界面协作与交付验证。'},{id:'TESTb',parentId:'TESTDocumentToken12345',type:2,children:[],text:'SIMULATED：该正文来自模拟飞书云文档，不代表任何真实工作或外部事实。'}],hasMore:false,pageToken:null}};
  }
} else if (args[0] === 'wiki' && args[1] === '+node-get' && flag('--node-token') === 'TESTWikiNodeToken12345' && flag('--as') === 'user') {
  log('feishu.wiki-resolve');data={ok:true,data:{documentToken:'TESTDocumentToken12345',type:'docx',title:'TEST SIMULATED 云文档项目复盘'}};
} else if (args[0] === 'api' && args[1] === 'GET' && args[2] === '/open-apis/doc/v2/meta/TESTLegacyDocToken12345' && flag('--as') === 'user') {
  log('feishu.legacy-resolve');data={ok:true,data:{documentToken:null}};
} else if (args[0] === 'base' && flag('--base-token') === 'TESTSimulatedBase0001' && flag('--as') === 'user') {
  const commands = {
    '+table-list': {total:1,tables:[{id:'tblTESTMaterial01',name:'TEST SIMULATED 项目记录'}]},
    '+view-list': {total:1,views:[{id:'vewTESTMaterial01',name:'TEST SIMULATED 有限预览',type:'grid'}]},
    '+field-list': {total:2,fields:[{name:'标题',type:'text'},{name:'正文',type:'text'}]},
    '+record-list': {columns:[{name:'标题',type:'text'},{name:'正文',type:'text'}],rows:[[{kind:'text',value:'TEST SIMULATED 交付复盘'},{kind:'text',value:'TEST DATA：虚构职业工作台交付项目。负责资料整理、界面协作与交付验证；在隔离演示中完成连续旅程。此资料来自模拟飞书响应，不代表任何真实工作或外部事实。'}]],hasMore:false},
  };
  if (commands[args[1]]) {
    log('feishu.'+args[1].slice(1));
    data = {ok:true,data:commands[args[1]]};
  }
}
if (!data) { log('blocked.cli-command'); process.stderr.write('SIMULATED_CLI_COMMAND_BLOCKED\n'); process.exitCode=1; }
else process.stdout.write(JSON.stringify(data));

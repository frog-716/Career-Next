'use strict';
// Instrument only external I/O. Career's native launcher, host, owner and writer
// bytes remain unchanged in the TEST bundle. Unknown outbound traffic fails closed.
const fs=require('node:fs'), path=require('node:path'), cp=require('node:child_process');
const {isMainThread,workerData}=require('node:worker_threads');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'),'utf8'));
const profileArg=process.argv.find(arg=>arg.startsWith('--user-data-dir='));
function insideTestProfile(value){
  if(typeof value!=='string')return false;
  try{const real=fs.existsSync(value)?fs.realpathSync(value):path.join(fs.realpathSync(path.dirname(value)),path.basename(value));return real.startsWith(fs.realpathSync(config.profile)+path.sep);}catch{return false;}
}
const moduleRoot=path.join(config.bundle,'Contents/Resources/application/node_modules/better-sqlite3');
const snapshotWorker=!isMainThread&&workerData&&Object.keys(workerData).sort().join(',')==='destination,driver,source'&&insideTestProfile(workerData.source)&&insideTestProfile(workerData.destination)&&path.basename(workerData.source)==='career.sqlite'&&path.basename(workerData.destination)==='working.sqlite'&&[moduleRoot,path.join(moduleRoot,'lib/index.js')].includes(workerData.driver);
const profileMatches=isMainThread?profileArg&&path.resolve(profileArg.slice('--user-data-dir='.length))===config.profile:insideTestProfile(workerData?.root)||snapshotWorker;
if (!profileMatches || !config.profile.includes('TEST')) throw Error('isolated_TEST_profile_required');
function log(category, extra={}) { fs.appendFileSync(config.audit,JSON.stringify({time:new Date().toISOString(),pid:process.pid,mode:'SIMULATED',category,...extra})+'\n',{mode:0o600}); }
process.env.CAREER_LARK_CLI=path.join(__dirname,'lark-cli.cjs');
const originalSpawn=cp.spawn;
cp.spawn=function(command,args=[],options={}) {
  if (path.basename(command)==='career-keychain') {
    log('boundary.keychain-redirect');
    return originalSpawn.call(this,process.execPath,[path.join(__dirname,'keychain.cjs')],options);
  }
  if (args.some(arg=>path.basename(arg)==='node-host.cjs')) {
    log('boundary.host-preload');
    return originalSpawn.call(this,command,['--require',__filename,...args],options);
  }
  // Only bundled Node, bundled PDF engine and our own subprocesses are admitted.
  const resolved=path.resolve(command);
  if (!(resolved.startsWith(config.bundle+path.sep)||resolved===process.execPath)) { log('blocked.spawn',{command:path.basename(command)}); throw Error('SIMULATED_EXTERNAL_PROCESS_BLOCKED'); }
  return originalSpawn.call(this,command,args,options);
};
const originalExecFile=cp.execFile;
cp.execFile=function(command,args=[],...rest) {
  if (command==='/usr/bin/open' && args[0]==='-a' && args[1]==='Google Chrome') {
    const url=new URL(args[2]);if(url.hostname!=='127.0.0.1')throw Error('SIMULATED_BROWSER_TARGET_BLOCKED');
    log('boundary.chrome-isolated');
    return originalExecFile.call(this,command,['-na','Google Chrome','--args','--user-data-dir='+config.chromeProfile,'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost','--remote-debugging-port=0','--app='+url.href],...rest);
  }
  if (command!==process.execPath || args[0]!==process.env.CAREER_LARK_CLI) { log('blocked.execFile',{command:path.basename(command)}); throw Error('SIMULATED_EXTERNAL_PROCESS_BLOCKED'); }
  return originalExecFile.call(this,command,args,...rest);
};
cp.execFile[require('node:util').promisify.custom]=function(command,args,options) {
  return new Promise((resolve,reject)=>cp.execFile(command,args,options,(error,stdout,stderr)=>error?reject(Object.assign(error,{stdout,stderr})):resolve({stdout,stderr})));
};
const originalFetch=globalThis.fetch;
globalThis.fetch=async function(input,init) {
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if (url.hostname==='127.0.0.1'||url.hostname==='localhost'||url.hostname==='[::1]') return originalFetch(input,init);
  if (url.href==='https://api.deepseek.com/chat/completions') {
    if(new Headers(init?.headers).get('authorization')!=='Bearer TEST_SIMULATED_DEEPSEEK_KEY')throw Error('SIMULATED_CREDENTIAL_REJECTED');
    const request=JSON.parse(init?.body||'{}');
    const connection=request.max_tokens===16;
    log(connection?'deepseek.connection-test':'deepseek.research-request');
    const content=connection?{status:'ready'}:{proposals:[{kind:'create',content:{title:'TEST SIMULATED 研究整理',body:'TEST DATA：根据当前人工选定的隔离资料生成的模拟研究摘要。该输出来自 fixture，没有向 DeepSeek 发送请求，也不代表核实后的外部事实。',nature:'hypothesis'},reason:'SIMULATED fixture response for authorized isolated TEST data.',citations:[],unknowns:['SIMULATED；未进行独立事实核实。']}]};
    return Response.json({model:'deepseek-flash',choices:[{finish_reason:'stop',message:{content:JSON.stringify(content)}}],usage:{prompt_tokens:100,completion_tokens:50,total_tokens:150}});
  }
  if (url.href==='https://api.tavily.com/search') {
    if(new Headers(init?.headers).get('authorization')!=='Bearer TEST_SIMULATED_TAVILY_KEY')throw Error('SIMULATED_CREDENTIAL_REJECTED');
    const request=JSON.parse(init?.body||'{}');
    log(request.max_results===1?'tavily.connection-test':'tavily.search-request');
    return Response.json({query:'OpenAI official website',request_id:'TEST_SIMULATED_SEARCH',results:[{title:'TEST SIMULATED 职业研究资料',url:'https://example.test/TEST-SIMULATED-research',content:'TEST DATA：模拟搜索结果，仅用于隔离连续旅程，不来自 Tavily 或真实网站。'}]});
  }
  log('blocked.fetch',{hostname:url.hostname}); throw Error('SIMULATED_EXTERNAL_NETWORK_BLOCKED');
};
// Defense in depth for clients that bypass fetch. Local loopback remains usable.
const net=require('node:net');const originalConnect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args) {
  const options=args[0];
  const host=typeof options==='object'?options.host:(typeof args[1]==='string'?args[1]:'localhost');
  const unix=typeof options==='object'&&typeof options.path==='string';
  if (!unix && host && !['127.0.0.1','localhost','::1'].includes(host)) {log('blocked.socket',{hostname:host});throw Error('SIMULATED_EXTERNAL_NETWORK_BLOCKED');}
  return originalConnect.apply(this,args);
};
log('preload.loaded',{entry:path.basename(process.argv[1]||''),...snapshotWorker?{workerRole:'readonly-backup-snapshot'}:{}});

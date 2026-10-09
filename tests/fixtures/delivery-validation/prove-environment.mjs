// Engineering proof only. No product journey or expected UI answers are supplied.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
const run=promisify(execFile),repository=path.resolve(import.meta.dirname,'../../..');
const root=path.resolve(process.argv[2]??'out/delivery-validation/harness-proof-SIMULATED-TEST');
if(!root.startsWith(path.join(repository,'out/delivery-validation')+path.sep)||!path.basename(root).includes('TEST'))throw Error('isolated_TEST_root_required');
const fixture=path.join(root,'external-IO-SIMULATED-TEST'),config=JSON.parse(await readFile(path.join(fixture,'config.json'),'utf8'));
const native=path.join(config.bundle,'Contents/MacOS/Career'),node=path.join(config.bundle,'Contents/Resources/runtime/node.real');
const args=['--user-data-dir='+config.profile,'--no-browser-open'];
const getState=async()=>JSON.parse(await readFile(path.join(config.profile,'browser-host.json'),'utf8'));
const proof={mode:'SIMULATED',startedAt:new Date().toISOString(),root,checks:{}};
async function lockTest(expected){
  const pointer=JSON.parse(await readFile(path.join(config.profile,'active-workspace-pointer.json'),'utf8'));
  const lock=path.join(config.profile,pointer.relativePath,'writer-lock.sqlite');
  const source=`const Database=require(${JSON.stringify(path.join(config.bundle,'Contents/Resources/application/node_modules/better-sqlite3'))});const db=new Database(${JSON.stringify(lock)});db.pragma('busy_timeout=0');let acquired=false;try{db.exec('BEGIN EXCLUSIVE');acquired=true;db.exec('ROLLBACK');}catch(error){if(error.code!=='SQLITE_BUSY')throw error;}finally{db.close();}console.log(JSON.stringify({acquired}));`;
  const {stdout}=await run(node,['-e',source]);assert.equal(JSON.parse(stdout).acquired,expected);
}
try {
  const launches=await Promise.all([run(native,args,{timeout:45000}),run(native,args,{timeout:45000})]);
  const states=launches.map(value=>JSON.parse(value.stdout));assert.equal(states[0].pid,states[1].pid);assert.equal(states[0].instance,states[1].instance);
  proof.checks.concurrentNativeLaunchReusesOneHost={pass:true,pid:states[0].pid,instance:states[0].instance};
  await lockTest(false);proof.checks.secondWriterRejectedBySQLiteLock={pass:true};
  await run(native,['stop','--user-data-dir='+config.profile],{timeout:45000});
  await lockTest(true);proof.checks.lockReleasedAfterFormalStop={pass:true};
  await run(native,args,{timeout:45000});const restarted=await getState();assert.notEqual(restarted.pid,states[0].pid);assert.notEqual(restarted.instance,states[0].instance);
  proof.checks.formalRestart={pass:true,previousPid:states[0].pid,newPid:restarted.pid,previousInstance:states[0].instance,newInstance:restarted.instance};
  const simulation=`(async()=>{const assert=require('node:assert/strict'),cp=require('node:child_process'),{promisify}=require('node:util'),crypto=require('node:crypto');const run=promisify(cp.execFile),fixture=${JSON.stringify(fixture)};const cli=async args=>JSON.parse((await run(process.execPath,[fixture+'/lark-cli.cjs',...args],{encoding:'utf8'})).stdout);assert.equal((await cli(['auth','status','--json'])).identities.user.status,'ready');assert.equal((await cli(['drive','+search','--query','TEST','--only-title','--as','user'])).data.results[0].type,'docx');assert.equal((await cli(['api','GET','/open-apis/docx/v1/documents/TESTDocumentToken12345','--as','user'])).data.revision,7);let blocked=false;try{await fetch('https://example.test/NO-REAL-NETWORK');}catch(error){blocked=error.message==='SIMULATED_EXTERNAL_NETWORK_BLOCKED';}assert.ok(blocked);const deep=await fetch('https://api.deepseek.com/chat/completions',{headers:{authorization:'Bearer TEST_SIMULATED_DEEPSEEK_KEY'},body:JSON.stringify({max_tokens:16})});assert.equal(JSON.parse((await deep.json()).choices[0].message.content).status,'ready');const search=await fetch('https://api.tavily.com/search',{headers:{authorization:'Bearer TEST_SIMULATED_TAVILY_KEY'},body:JSON.stringify({query:'OpenAI official website'})});assert.equal((await search.json()).request_id,'TEST_SIMULATED_SEARCH');const helper=input=>new Promise((resolve,reject)=>{const child=cp.spawn(${JSON.stringify(path.join(config.bundle,'Contents/Resources/application/career-keychain'))},[],{stdio:['pipe','pipe','pipe']});let result='';child.stdout.on('data',value=>result+=value);child.once('error',reject);child.once('close',code=>code===0?resolve(JSON.parse(result)):reject(Error('helper_failed')));child.stdin.end(JSON.stringify(input));});const input={namespace:crypto.createHash('sha256').update(${JSON.stringify(config.profile)}).digest('hex'),slot:'deepseek'};assert.equal((await helper({...input,action:'available'})).available,true);const encrypted=await helper({...input,action:'encrypt',value:'TEST_SIMULATED_DEEPSEEK_KEY'});assert.equal((await helper({...input,action:'decrypt',value:encrypted.value})).value,'TEST_SIMULATED_DEEPSEEK_KEY');console.log(JSON.stringify({simulatedCLI:true,simulatedProvider:true,simulatedSearch:true,simulatedKeychain:true,unknownNetworkBlocked:true}));})().catch(error=>{console.error(error.message);process.exitCode=1;});`;
  const {stdout}=await run(node,['--require',path.join(fixture,'preload.cjs'),'-e',simulation,'--','--user-data-dir='+config.profile],{timeout:30000});
  proof.checks.externalIsolation={pass:true,...JSON.parse(stdout)};
  const rows=(await readFile(config.audit,'utf8')).trim().split('\n').filter(Boolean).map(value=>JSON.parse(value));const counts={};for(const row of rows)counts[row.category]=(counts[row.category]??0)+1;
  proof.simulatedSourceCounts=counts;proof.realExternalRequests=0;proof.checks.auditContainsNoSyntheticKeys={pass:!rows.some(row=>JSON.stringify(row).includes('TEST_SIMULATED_DEEPSEEK_KEY')||JSON.stringify(row).includes('TEST_SIMULATED_TAVILY_KEY'))};assert.equal(proof.checks.auditContainsNoSyntheticKeys.pass,true);
  proof.finishedAt=new Date().toISOString();await writeFile(path.join(root,'engineering-proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof,null,2));
} finally {try{await run(native,['stop','--user-data-dir='+config.profile],{timeout:45000});}catch{}}

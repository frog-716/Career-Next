import {cp,mkdir,readFile,writeFile,rename,chmod,readdir,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile), repository=path.resolve(import.meta.dirname,'..');
const action=process.argv[2]??'status';
const rootArg=process.argv.find(value=>value.startsWith('--root='));
const parent=path.join(repository,'out/delivery-validation');
const root=path.resolve(rootArg?.slice('--root='.length)??path.join(parent,'packaged-SIMULATED-TEST'));
if(!root.startsWith(parent+path.sep)||!path.basename(root).includes('TEST'))throw Error('isolated_TEST_root_required');
const source=path.join(repository,'out/Career-arm64/Career.app'),bundle=path.join(root,'Career SIMULATED TEST.app');
const fixture=path.join(root,'external-IO-SIMULATED-TEST'),configPath=path.join(fixture,'config.json');
const application='Contents/Resources/application';
const binary=path.join(bundle,'Contents/MacOS/Career');
const digest=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
async function files(directory,prefix='') {
  const result=[];for(const entry of await readdir(directory,{withFileTypes:true})) {
    const relative=path.join(prefix,entry.name);if(entry.isDirectory())result.push(...await files(path.join(directory,entry.name),relative));else if(entry.isFile())result.push(relative);
  }return result.sort();
}
async function config(){const value=JSON.parse(await readFile(configPath,'utf8'));if(value.mode!=='SIMULATED'||value.bundle!==bundle||value.profile!==path.join(root,'career-profile-TEST')||value.chromeProfile!==path.join(root,'chrome-profile-TEST'))throw Error('TEST_configuration_invalid');return value;}
async function state(config){try{return JSON.parse(await readFile(path.join(config.profile,'browser-host.json'),'utf8'));}catch{return undefined;}}
async function counts(config){let rows=[];try{rows=(await readFile(config.audit,'utf8')).trim().split('\n').filter(Boolean).map(value=>JSON.parse(value));}catch{}const counts={};for(const row of rows)counts[row.category]=(counts[row.category]??0)+1;return counts;}
async function chromePids(config){const {stdout}=await run('/bin/ps',['-ax','-o','pid=,command=']);return stdout.split('\n').filter(line=>line.includes('--user-data-dir='+config.chromeProfile)&&line.includes('Google Chrome')).map(line=>Number(line.trim().split(/\s+/)[0]));}
if(action==='prepare') {
  try{await stat(root);throw Error('TEST_root_already_exists_use_new_root');}catch(error){if(error.code!=='ENOENT')throw error;}
  await mkdir(root,{recursive:true,mode:0o700});
  await cp(source,bundle,{recursive:true,verbatimSymlinks:true,mode:constants.COPYFILE_FICLONE});
  await cp(path.join(repository,'tests/fixtures/delivery-validation'),fixture,{recursive:true});
  const value={mode:'SIMULATED',bundle,profile:path.join(root,'career-profile-TEST'),chromeProfile:path.join(root,'chrome-profile-TEST'),audit:path.join(root,'external-IO-SIMULATED-TEST.jsonl')};
  await writeFile(configPath,JSON.stringify(value,null,2),{mode:0o600});
  const runtime=path.join(bundle,'Contents/Resources/runtime/node'),original=runtime+'.real';
  await rename(runtime,original);
  const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
  await writeFile(runtime,'#!/bin/sh\nexec '+quote(original)+' --require '+quote(path.join(fixture,'preload.cjs'))+' "$@"\n',{mode:0o755});await chmod(runtime,0o755);
  const applicationFiles=(await readdir(path.join(source,application),{withFileTypes:true})).filter(entry=>entry.isFile()).map(entry=>application+'/'+entry.name);
  const preserved=['Contents/MacOS/Career',...applicationFiles,...(await files(path.join(source,'Contents/Resources/materials-renderer'))).map(file=>'Contents/Resources/materials-renderer/'+file),...(await files(path.join(source,'Contents/Resources/recovery-renderer'))).map(file=>'Contents/Resources/recovery-renderer/'+file)];
  const evidence=[];for(const relative of preserved){const sourceSha=await digest(path.join(source,relative)),testSha=await digest(path.join(bundle,relative));if(sourceSha!==testSha)throw Error('preserved_file_changed:'+relative);evidence.push({relative,sourceSha256:sourceSha,testSha256:testSha,equal:true});}
  const sourceNode=await digest(path.join(source,'Contents/Resources/runtime/node')),testNode=await digest(original);if(sourceNode!==testNode)throw Error('original_Node_changed');
  evidence.push({relative:'Contents/Resources/runtime/node -> node.real',sourceSha256:sourceNode,testSha256:testNode,equal:true});
  const manifest={mode:'SIMULATED',preparedAt:new Date().toISOString(),source,bundle,profile:value.profile,chromeProfile:value.chromeProfile,preserved:evidence,differences:['TEST copy runtime/node is a shell shim loading TEST preload; original bundled Node is preserved as node.real.','Original signatures are copied unchanged but TEST resource changes invalidate whole-bundle resource verification; start directly through the native executable, not Gatekeeper/Finder distribution.','External Feishu CLI, Provider/Search fetch and Keychain helper calls are SIMULATED. No production code or renderer byte is modified.','Chrome launch is redirected to its own TEST profile; other Chrome processes are never stopped.'],realExternalCalls:0};
  await writeFile(path.join(root,'hash-evidence.json'),JSON.stringify(manifest,null,2));
  await writeFile(path.join(root,'START-STOP.md'),`# SIMULATED TEST 环境\n\n这是正式 Career.app 启动链的外部 I/O 仪器化测试副本。原始正式包位于 \`${source}\`，保持原样；两者的差异与不变文件哈希见 \`hash-evidence.json\`。此环境不能证明真实 Feishu / DeepSeek / Tavily 或 macOS Keychain 的外部服务可用性。\n\n- 启动：\`node scripts/delivery-validation.mjs start --root=${root}\`\n- 状态与模拟来源计数：\`node scripts/delivery-validation.mjs status --root=${root}\`\n- 停止本 TEST 后台与本 TEST Chrome：\`node scripts/delivery-validation.mjs stop --root=${root}\`\n- 重新启动使用同一条启动命令；资料由正式 owner 保存在 \`${value.profile}\`。\n\n本环境使用独立 Chrome TEST profile：\`${value.chromeProfile}\`。模拟外部 I/O 计数日志：\`${value.audit}\`（只记种类、时间、PID；不记密钥或业务正文）。\n\n如正常界面要求输入服务凭据，隔离替身只接受 \`TEST_SIMULATED_DEEPSEEK_KEY\` 与 \`TEST_SIMULATED_TAVILY_KEY\` 这类显式 TEST_SIMULATED 值。请勿输入真实 Key。Feishu、Provider/Search 所有结果均为 SIMULATED；未知外联会被拒绝。\n\n此文件只提供环境操作。产品行为、规则和旅程应仅从仓库 README、MAP 及其正式产品文档理解。\n`);
  console.log(JSON.stringify({prepared:true,root,bundle,profile:value.profile,evidence:path.join(root,'hash-evidence.json')},null,2));
} else {
  const value=await config();
  if(action==='start'||action==='start-no-browser') {
    const args=['--user-data-dir='+value.profile,...action==='start-no-browser'?['--no-browser-open']:[]];
    const {stdout}=await run(binary,args,{timeout:45000});console.log(stdout.trim());
  }else if(action==='stop') {
    const saved=await state(value);if(saved){const {stdout}=await run(binary,['status','--user-data-dir='+value.profile],{timeout:45000});if(JSON.parse(stdout).running)await run(binary,['stop','--user-data-dir='+value.profile],{timeout:45000});}
    const pids=await chromePids(value);for(const pid of pids){try{process.kill(pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}}
    console.log(JSON.stringify({stopped:true,TESTChromePids:pids}));
  }else if(action==='status') {
    const {stdout}=await run(binary,['status','--user-data-dir='+value.profile],{timeout:45000});console.log(JSON.stringify({...JSON.parse(stdout),mode:'SIMULATED',root,profile:value.profile,chromePids:await chromePids(value),sourceCounts:await counts(value),realExternalCalls:0},null,2));
  }else if(action==='verify-hashes') {
    const evidence=JSON.parse(await readFile(path.join(root,'hash-evidence.json'),'utf8'));
    for(const row of evidence.preserved){const relative=row.relative.replace('Contents/Resources/runtime/node -> node.real','Contents/Resources/runtime/node.real');if(await digest(path.join(bundle,relative))!==row.testSha256)throw Error('TEST_preserved_file_changed:'+relative);const sourceRelative=row.relative.split(' -> ')[0];if(await digest(path.join(source,sourceRelative))!==row.sourceSha256)throw Error('source_package_changed:'+sourceRelative);}
    console.log(JSON.stringify({mode:'SIMULATED',verified:true,preservedCount:evidence.preserved.length}));
  }else throw Error('unknown_action');
}

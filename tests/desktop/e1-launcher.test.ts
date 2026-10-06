import {it,expect} from 'vitest';import {execFile,spawn} from 'node:child_process';import {promisify} from 'node:util';import {mkdtemp,readFile,readlink,rm,cp} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';
const run=promisify(execFile),binary=path.resolve('out/Career-arm64/Career.app/Contents/MacOS/Career');
it('packaged Chrome framework links stay inside the bundle instead of the development cache',async()=>{
 const framework=path.resolve('out/Career-arm64/Career.app/Contents/Resources/engine/Chrome for Testing.app/Contents/Frameworks/Google Chrome for Testing Framework.framework');
 for(const relative of ['Resources','Versions/Current'])expect(path.isAbsolute(await readlink(path.join(framework,relative)))).toBe(false);
});
it('arm64 launcher reuses one Node backend, restarts after crash, and handles Chinese/space profile paths',async()=>{
 const profile=await mkdtemp(path.join(tmpdir(),'Career E1 TEST 中文 '));let state:any;
 const args=['--user-data-dir='+profile,'--no-browser-open'];
 try{await Promise.all([run(binary,args),run(binary,args)]);state=JSON.parse(await readFile(path.join(profile,'browser-host.json'),'utf8'));expect(state.host).toBe('node-v1');const firstPid=state.pid;
  expect((await run('/bin/ps',['-p',String(firstPid),'-o','comm='])).stdout).not.toContain('Electron');expect((await run(binary,args)).stdout).toContain(String(firstPid));
  process.kill(firstPid,'SIGKILL');await expect.poll(async()=>{try{process.kill(firstPid,0);return false;}catch{return true;}},{timeout:10000}).toBe(true);
  await run(binary,args);state=JSON.parse(await readFile(path.join(profile,'browser-host.json'),'utf8'));expect(state.pid).not.toBe(firstPid);expect(state.instance).not.toBe('');
  await run(binary,['stop','--user-data-dir='+profile]);expect(JSON.parse((await run(binary,['status','--user-data-dir='+profile])).stdout).running).toBe(false);
 }finally{if(state?.pid){try{process.kill(state.pid,'SIGTERM');}catch{}}await rm(profile,{recursive:true,force:true});}
},90000);

it('a relocated Career.app with spaces and Chinese uses only its bundled runtime',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'Career E1 TEST 安装目录 ')),relocated=path.join(root,'Career.app'),profile=path.join(root,'TEST 资料'),copied=path.join(relocated,'Contents/MacOS/Career');
 try{const {constants}=await import('node:fs');await cp(path.resolve('out/Career-arm64/Career.app'),relocated,{recursive:true,verbatimSymlinks:true,mode:constants.COPYFILE_FICLONE});await run(copied,['--user-data-dir='+profile,'--no-browser-open']);const state=JSON.parse(await readFile(path.join(profile,'browser-host.json'),'utf8'));expect((await run('/bin/ps',['-p',String(state.pid),'-o','command='])).stdout).toContain(path.join(relocated,'Contents/Resources/runtime/node'));await run(copied,['stop','--user-data-dir='+profile]);
 }finally{try{await run(copied,['stop','--user-data-dir='+profile]);}catch{}await rm(root,{recursive:true,force:true});}
},90000);

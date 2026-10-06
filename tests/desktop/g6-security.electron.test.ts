import {it,expect} from 'vitest';
import {_electron,type ElectronApplication} from 'playwright';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {spawn,execFile,type ChildProcess} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import path from 'node:path';
const execute=promisify(execFile),executable=process.env.CAREER_PACKAGED_EXECUTABLE;
const evidence=process.env.CAREER_G6_SECURITY_EVIDENCE??'/tmp/career-g6-security';
async function record(name:string,value:unknown){
 if(!executable)throw Error('normal packaged executable required');
 const asar=path.resolve(executable,'../../Resources/app.asar');
 await mkdir(evidence,{recursive:true});await writeFile(path.join(evidence,name+'.json'),JSON.stringify({executable,appAsarSha256:createHash('sha256').update(await readFile(asar)).digest('hex'),...value as object},null,2));
}
async function finish(app:ElectronApplication|undefined,root:string){if(app){await app.evaluate(({dialog})=>{dialog.showMessageBoxSync=(()=>1) as typeof dialog.showMessageBoxSync;}).catch(()=>{});await app.close().catch(()=>{});}await rm(root,{recursive:true,force:true});}

it('final normal Main rejects foreign preload callers and external navigation; its actual PDF window has no business capability',async()=>{
 if(!executable)throw Error('normal packaged executable required');
 const root=await mkdtemp(path.join(tmpdir(),'career-g6-security-'));let app:ElectronApplication|undefined,requests=0;
 const sentinel=createServer((_request,response)=>{requests++;response.end('unrelated local fixture');});await new Promise<void>(resolve=>sentinel.listen(0,'127.0.0.1',resolve));const address=sentinel.address();if(!address||typeof address==='string')throw Error('fixture address');const external=`http://127.0.0.1:${address.port}/untrusted`;
 try{
  app=await _electron.launch({executablePath:executable,args:['--career-desktop-ui',`--user-data-dir=${root}/profile`],timeout:30000});const page=await app.firstWindow();await page.getByRole('navigation',{name:'一级导航'}).waitFor();await app.evaluate(({BrowserWindow})=>{for(const win of BrowserWindow.getAllWindows())win.hide();});
  const baseline=await page.evaluate(()=>window.careerMaterials.ready());
  const foreign=await app.evaluate(async({app,BrowserWindow},commandId)=>{
   const results=[];
   for(const url of ['data:text/html,untrusted-g6-fixture','career://app/index.html']){
    const win=new BrowserWindow({show:false,webPreferences:{preload:app.getAppPath()+'/dist/application/preload.cjs',sandbox:true,contextIsolation:true,nodeIntegration:false,devTools:false}});
    try{await win.loadURL(url);const denied=await win.webContents.executeJavaScript(`(async()=>{
     const cases=[['materials-ready',()=>window.careerMaterials.ready()],['materials-list',()=>window.careerMaterials.request({operation:'list'})],['materials-reconnect',()=>window.careerMaterials.reconnect()],['business-ready',()=>window.career.ready()],['business-list',()=>window.career.request('wiki',{operation:'list'})],['business-write',()=>window.career.request('opportunity',{operation:'company.create',commandId:${JSON.stringify(commandId)},name:'Rejected foreign fixture'})],['business-reconnect',()=>window.career.reconnect()],['secret-status',()=>window.careerSecrets.request({operation:'status'})],['secret-save',()=>window.careerSecrets.request({operation:'save',value:'G6_VIRTUAL_UNTRUSTED'})],['secret-disable',()=>window.careerSecrets.request({operation:'disable'})],['search',()=>window.careerSearch.request({operation:'local-search.query',owner:'wiki',query:'fixture',includeInactive:false})],['sent-file',()=>window.careerSentFiles.select()]];
     const denied=[];for(const [name,call]of cases){try{await call();denied.push({name,rejected:false});}catch(error){denied.push({name,rejected:true,error:String(error)});}}return {bridges:{materials:typeof window.careerMaterials,business:typeof window.career,secrets:typeof window.careerSecrets,search:typeof window.careerSearch},denied};
    })()`);results.push({url,denied});}finally{win.destroy();}
   }
   const plain=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,devTools:false}});
   try{await plain.loadURL('data:text/html,no-preload-external');results.push({url:'external-without-preload',denied:await plain.webContents.executeJavaScript('({materials:typeof window.careerMaterials,business:typeof window.career,secrets:typeof window.careerSecrets,search:typeof window.careerSearch})')});}finally{plain.destroy();}
   return results;
  },randomUUID());
  for(const item of foreign.slice(0,2)){expect(item.denied.bridges).toEqual({materials:'object',business:'object',secrets:'object',search:'object'});expect(item.denied.denied).toHaveLength(12);for(const attack of item.denied.denied){expect(attack.rejected,attack.name).toBe(true);expect(attack.error,attack.name).toContain('invalid_capability');}}
  expect(foreign[2]!.denied).toEqual({materials:'undefined',business:'undefined',secrets:'undefined',search:'undefined'});
  expect(await page.evaluate(()=>window.careerMaterials.ready())).toEqual(baseline);expect(await page.evaluate(()=>window.career.request('opportunity',{operation:'company.list'}))).toMatchObject({kind:'companies',items:[]});
  expect(await page.evaluate(()=>window.careerMaterials.request({operation:'list'}))).toEqual({kind:'list',items:[]});expect(await page.evaluate(()=>window.careerSecrets.request({operation:'status'}))).toMatchObject({kind:'status',status:{configured:false,enabled:false}});
  const count=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),originalUrl=page.url();await page.evaluate(url=>{window.open(url);},external);await page.waitForTimeout(150);expect(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length)).toBe(count);
  await app.evaluate(({BrowserWindow})=>{const primary=BrowserWindow.getAllWindows()[0]!;(globalThis as any).__g6NavigationAttempts=[];primary.webContents.on('will-frame-navigate',()=>{(globalThis as any).__g6NavigationAttempts.push('will-frame-navigate');});primary.webContents.on('will-navigate',()=>{(globalThis as any).__g6NavigationAttempts.push('will-navigate');});});await page.evaluate(url=>{location.href=url;},external);await expect.poll(()=>app!.evaluate(()=>(globalThis as any).__g6NavigationAttempts.length)).toBeGreaterThan(0);expect(page.url()).toBe(originalUrl);expect(requests).toBe(0);
  const resume=await page.evaluate(async()=>{const company=await window.career.request('opportunity',{operation:'company.create',commandId:crypto.randomUUID(),name:'G6 PDF security fixture'}) as any;const opportunity=await window.career.request('opportunity',{operation:'create',commandId:crypto.randomUUID(),companyId:company.company.id,role:'Print isolation'}) as any;return window.career.request('resume',{operation:'resume.open',commandId:crypto.randomUUID(),opportunityId:opportunity.opportunity.id});}) as any;
  expect(resume.status).toBe('document');
  await app.evaluate(({app})=>{app.once('browser-window-created',(_event,win)=>{const original=win.webContents.printToPDF.bind(win.webContents);win.webContents.printToPDF=async options=>{const capability=await win.webContents.executeJavaScript('({materials:typeof window.careerMaterials,business:typeof window.career,secrets:typeof window.careerSecrets,search:typeof window.careerSearch,node:typeof require,process:typeof process})');const bytes=await original(options);(globalThis as any).__g6PrintSecurity={sandboxed:app.getAppMetrics().find(item=>item.pid===win.webContents.getOSProcessId())?.sandboxed,registeredPreloads:win.webContents.session.getPreloads(),devToolsOpened:win.webContents.isDevToolsOpened(),capability,pdfHeader:bytes.subarray(0,5).toString(),pdfBytes:bytes.length,hidden:!win.isVisible()};return bytes;};});});
  const version=await page.evaluate(resume=>window.career.request('resume',{operation:'resume.name-version',commandId:crypto.randomUUID(),resumeId:resume.document.id,expectedRevision:resume.document.revision,expectedProfileRevision:resume.profile.revision,name:'G6 isolated PDF'}),resume) as any;expect(version.status).toBe('version');
  const print=await app.evaluate(()=>(globalThis as any).__g6PrintSecurity);expect(print).toMatchObject({sandboxed:true,registeredPreloads:[],devToolsOpened:false,capability:{materials:'undefined',business:'undefined',secrets:'undefined',search:'undefined',node:'undefined',process:'undefined'},pdfHeader:'%PDF-',hidden:true});expect(print.pdfBytes).toBeGreaterThan(500);
  const attempts=await app.evaluate(()=>(globalThis as any).__g6NavigationAttempts);await record('main-boundaries',{status:'PASS',normalMain:true,foreign,identityUnchangedAfterRejectedReconnect:true,navigation:{originalUrl,attempts,externalRequests:requests,childWindowsCreated:0},actualPrint:print,driverInspector:'Playwright-owned test transport; standalone test separately checks production without driver',realExternalServices:'NOT TESTED'});
 }finally{sentinel.close();await finish(app,root);}
},120000);

async function ownedProcesses(pid:number){const rows=(await execute('/bin/ps',['-axo','pid=,ppid='])).stdout.trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number));const owned=new Set([pid]);for(let changed=true;changed;){changed=false;for(const [child,parent]of rows)if(owned.has(parent!)&&!owned.has(child!)){owned.add(child!);changed=true;}}return [...owned];}
async function exit(child:ChildProcess){if(child.exitCode!==null||child.signalCode!==null)return;await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('owned standalone app failed to stop')),15000);child.once('exit',()=>{clearTimeout(timer);resolve();});});}
it('standalone normal package exposes no TCP/inspector listener and never reuses or stops an unrelated occupied port',async()=>{
 if(!executable)throw Error('normal packaged executable required');const root=await mkdtemp(path.join(tmpdir(),'career-g6-listener-')),profile=path.join(root,'profile');let app:ChildProcess|undefined,requests=0;
 const token=randomUUID(),sentinel=createServer((_request,response)=>{requests++;response.end(token);});await new Promise<void>(resolve=>sentinel.listen(0,'127.0.0.1',resolve));const address=sentinel.address();if(!address||typeof address==='string')throw Error('fixture address');const url=`http://127.0.0.1:${address.port}/`;
 try{
  expect(await(await fetch(url)).text()).toBe(token);app=spawn(executable,['--career-desktop-ui',`--user-data-dir=${profile}`],{stdio:'ignore'});if(!app.pid)throw Error('owned PID missing');const pid=app.pid;
  await expect.poll(async()=>{try{return JSON.parse(await readFile(path.join(profile,'active-workspace-pointer.json'),'utf8')).workspaceInstance;}catch{return undefined;}},{timeout:30000}).not.toBeUndefined();expect(app.exitCode).toBe(null);const owned=await ownedProcesses(pid);
  const argv=(await execute('/bin/ps',['-p',owned.join(','),'-o','pid=,command='])).stdout;expect(argv).not.toMatch(/--inspect(?:-brk)?(?:=|\s|$)|--remote-debugging-(?:port|pipe)(?:=|\s|$)/);
  let listeners:string;try{listeners=(await execute('/usr/sbin/lsof',['-nP','-a','-p',owned.join(','),'-iTCP','-sTCP:LISTEN'])).stdout;}catch(error){if((error as {code?:number}).code!==1)throw error;listeners=(error as {stdout?:string}).stdout??'';}
  expect(listeners.trim()).toBe('');expect(await(await fetch(url)).text()).toBe(token);
  app.kill('SIGTERM');await exit(app);expect(await(await fetch(url)).text()).toBe(token);expect(requests).toBe(3);
  await record('standalone-listeners',{status:'PASS',normalMainWithoutPlaywright:true,ownedPids:owned,argv,tcpListenOutput:listeners,occupiedSentinelPort:address.port,sentinelResponses:requests,sentinelAliveAfterOwnedAppStop:true,stopSignal:'SIGTERM',stopExitCode:app.exitCode,stopSignalCode:app.signalCode,inspector:'none',realExternalServices:'NOT TESTED'});
 }finally{if(app&&app.exitCode===null&&app.signalCode===null){app.kill('SIGKILL');await exit(app).catch(()=>{});}sentinel.close();await rm(root,{recursive:true,force:true});}
},60000);

import path from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createRuntimeBackend} from '../../../packages/backend/bootstrap/runtime';
import {checkActiveIdentity} from '../../../packages/backend/platform/database/active-check';
import {createManagedCopies,durableJson} from '../../../packages/backend/platform/backup/managed-copies';
import {dispatchMaterials} from '../../../packages/backend/transport/materials';
import {BusinessModuleSchema,parseBusinessRequest,parseBusinessResult} from '../../../packages/contracts/registry';
import {Identity,Request as MaterialRequest,Result as MaterialResult,ImportTarget,MAX_TEXT_BYTES} from '../../../packages/contracts/materials/schema';
import {z} from 'zod';
import {SecretInput} from '../../../packages/contracts/ai/secret-input';
import {Request as ResumeRequest,Result as ResumeResult} from '../../../packages/contracts/resume/schema';
import {Result as DataResult,PurgeNotification} from '../../../packages/contracts/application/schema';
import {nodeActiveWorkspace,finishNodeBootstrap} from './workspace';
import {createSecretVault} from '../capabilities/secret-vault';
import {createSecretCoordinator} from '../capabilities/secret-coordinator';
import {createTavilyCredentials} from '../capabilities/tavily-credentials';
import {resolveStartupProviderBinding} from '../capabilities/provider-startup';
import {createBrowserHost,type BrowserContext} from '../browser/server';
import {createNativeKeychainStorage} from '../capabilities/native-keychain';
import {createHeadlessPrinter} from '../capabilities/headless-pdf';
import {withBrowserFile,cleanAbandonedBrowserFiles} from '../capabilities/browser-files';
import {ProviderBinding} from '../../../packages/backend/platform/providers/binding';
import {createProviderConnectionTester} from '../../../packages/backend/platform/providers/connection-test';
import {ProviderConnectionTestRequest} from '../../../packages/contracts/ai/connection-test';
import {createFeishuConnector,type FeishuConnectorPorts} from '../../../packages/backend/platform/connectors/feishu/connector';
import {createLarkCliFeishuPorts} from '../../../packages/backend/platform/connectors/feishu/lark-cli';

// Trusted assembly ports for isolated fixtures; main.ts never supplies a fake binding or transport.
export type NodeHostOptions={profile:string;artifacts:string;webRoot:string;port?:number;automaticBackups?:boolean;requestExit?:()=>void;providerBinding?:ProviderBinding;providerTransport?:typeof fetch;tavilyTransport?:typeof fetch;feishuPorts?:Omit<FeishuConnectorPorts,'profileRoot'>};
/** Platform assembly only. Existing owners, writer and authorization controller remain the authority. */
export async function createNodeHost(options:NodeHostOptions){
 const profile=path.resolve(options.profile);await mkdir(profile,{recursive:true,mode:0o700});
 const active=await nodeActiveWorkspace(profile);if(active.expected)checkActiveIdentity(active.root,active.expected);
 const printer=createHeadlessPrinter(path.join(options.artifacts,'pdf-environment.json'));
 const native=(slot:'deepseek'|'tavily')=>createNativeKeychainStorage({helper:path.join(options.artifacts,'career-keychain'),profile,slot});
 const deepseekStorage=native('deepseek'),tavilyStorage=native('tavily');
 const feishu=createFeishuConnector({profileRoot:profile,...(options.feishuPorts??createLarkCliFeishuPorts())});
 const secrets=createSecretVault(path.join(profile,'security-native-v1'),deepseekStorage);
 const tavilySecrets=createSecretVault(path.join(profile,'security-tavily-native-v1'),tavilyStorage,undefined,'tavily');
 let providerBinding=options.providerBinding?ProviderBinding.parse(options.providerBinding):await resolveStartupProviderBinding(path.join(profile,'security-native-v1'),()=>secrets.request({operation:'status'}));
 if(providerBinding.provider&&providerBinding.enabled){let grant:any;try{grant=JSON.parse(await readFile(path.join(profile,'security-native-v1','workspace-activation.json'),'utf8'));}catch{}if(grant?.generation!==providerBinding.generation||grant?.workspaceInstance!==active.expected){await secrets.request({operation:'disable'});providerBinding={...providerBinding,enabled:false};}}
 const tavilyStatus=await tavilySecrets.request({operation:'status'});if(tavilyStatus.kind==='status'&&tavilyStatus.status.enabled){let grant:any;try{grant=JSON.parse(await readFile(path.join(profile,'security-tavily-native-v1','workspace-activation.json'),'utf8'));}catch{}if(grant?.generation!==tavilyStatus.status.generation||grant?.workspaceInstance!==active.expected)await tavilySecrets.request({operation:'disable'});}
 if(!options.providerBinding&&!providerBinding.provider)providerBinding={...providerBinding,enabled:false};
 const runtime=await createRuntimeBackend(active.root,path.join(options.artifacts,'writer.cjs'),profile,{automaticBackups:options.automaticBackups,providerBinding,providerTransport:options.providerTransport,providerKey:generation=>secrets.readCredential(generation),tavilyKey:generation=>tavilySecrets.readCredential(generation),tavilyTransport:options.tavilyTransport,printMetadata:printer.metadata});
 try{
 let session:Awaited<ReturnType<typeof runtime.connectHuman>>;let closed=false;
 session=await runtime.connectHuman();await cleanAbandonedBrowserFiles(profile);
 const identity=()=>Identity.parse({protocolVersion:session.protocolVersion,workspaceInstance:session.workspaceInstance,backendGeneration:session.backendGeneration,connectionGeneration:session.connectionGeneration});
 const copies=createManagedCopies(profile),copy=copies.register({relativePath:path.relative(profile,active.root),kind:'current_workspace',state:'ready'});
 if(active.initial){durableJson(path.join(profile,'active-workspace-pointer.json'),{copyId:copy.id,relativePath:path.relative(profile,active.root),workspaceInstance:session.workspaceInstance});await finishNodeBootstrap(profile);}
 const coordinator=createSecretCoordinator(secrets,async binding=>{if(binding.enabled&&binding.provider)durableJson(path.join(profile,'security-native-v1','workspace-activation.json'),{workspaceInstance:session.workspaceInstance,generation:binding.generation});runtime.configureProvider(binding);});
 const tavily=createTavilyCredentials(tavilySecrets,async()=>{runtime.invalidateTavily();});
 const connectionTester=createProviderConnectionTester({deepseekKey:generation=>secrets.readCredential(generation),tavilyKey:generation=>tavilySecrets.readCredential(generation),deepseekTransport:options.providerTransport,tavilyTransport:options.tavilyTransport});
 async function connectionGeneration(provider:'deepseek'|'tavily'){
  const result=provider==='deepseek'?await coordinator.request({operation:'status'}):await tavily.request({operation:'status'});
  if(result.kind!=='status'||!result.status.configured||!result.status.enabled||!result.status.generation)return undefined;
  if(provider==='deepseek'&&result.status.provider!=='deepseek-v4.1-flash')return undefined;
  return result.status.generation;
 }
 const printing=new Map<string,Promise<unknown>>();
 const handlers:Record<string,(input:unknown,context:BrowserContext)=>Promise<unknown>>={
  ready:async(_,context)=>{if(closed)throw Error('disconnected');context.bind(session.workspaceInstance);return identity();},
  reconnect:async(_,context)=>{if(closed)throw Error('disconnected');context.bind(session.workspaceInstance);return identity();},
  materials:async input=>dispatchMaterials(runtime.materials,session,identity(),MaterialRequest.parse(input)),
  'secrets/deepseek':async input=>{const parsed=SecretInput.safeParse(input);if(!parsed.success)return {kind:'failure' as const,code:'invalid_request' as const};const value=parsed.data;return coordinator.request(value.operation==='save'?{...value,provider:'deepseek-v4.1-flash'}:value);},
  'secrets/tavily':async input=>{const result=await tavily.request(input as never);if((input as {operation?:string})?.operation==='save'&&result.kind==='status'&&result.status.enabled&&result.status.generation)durableJson(path.join(profile,'security-tavily-native-v1','workspace-activation.json'),{workspaceInstance:session.workspaceInstance,generation:result.status.generation});return result;},
  'connection/test':async input=>{if(closed)throw Error('disconnected');const parsed=ProviderConnectionTestRequest.safeParse(input);if(!parsed.success)throw Error('invalid_request');return connectionTester.request(parsed.data,()=>connectionGeneration(parsed.data.provider));},
  'search/local':async input=>runtime.search(session,input),
  'search/tavily':async input=>{const operation=(input as {operation?:string})?.operation;return runtime.externalSearch(session,input,operation==='receipt'?undefined:await tavily.generationForDispatch().catch(()=>undefined));},
  'feishu/status':async input=>{z.strictObject({}).parse(input);return feishu.getConnectionStatus();},
  'feishu/identity':async input=>{z.strictObject({}).parse(input);return feishu.getCurrentIdentity();},
  'feishu/connect':async input=>{z.strictObject({}).parse(input);return feishu.connect();},
 };
 if(options.requestExit){let requested=false;handlers['host/stop']=async input=>{z.strictObject({confirmed:z.literal(true)}).parse(input);if(!requested){requested=true;setTimeout(()=>options.requestExit!(),250);}return {stopping:true};};}
 for(const module of BusinessModuleSchema.options)handlers['business/'+module]=async(input,context)=>{
  if(JSON.stringify(input).length>1024*1024)throw Error('invalid_request');
  const request=parseBusinessRequest(module,input),bound=session;
  const result=parseBusinessResult(module,await runtime.business(bound,module,request));
  if(module==='application'){
   const data=DataResult.parse(result),refs=data.kind==='purged'?data.references:data.kind==='failure'?data.purgeReferences:undefined;
   if(refs?.length)context.notify(PurgeNotification.parse({workspaceInstance:bound.workspaceInstance,references:refs}),bound.workspaceInstance);
   if(data.kind==='restored'||data.kind==='failure'&&data.code==='restore_failed_reconnected'){
    await Promise.all([coordinator.request({operation:'disable'}),tavily.request({operation:'disable'})]);session=await runtime.connectHuman();if(session.workspaceInstance!==bound.workspaceInstance){context.notify({kind:'workspace_changed'},bound.workspaceInstance,true);context.replaceBinding(session.workspaceInstance);}
   }
  }
  if(module!=='resume')return result;
  const inputResume=ResumeRequest.parse(request),value=ResumeResult.parse(result);
  if(!['resume.name-version','resume.export'].includes(inputResume.operation)||value.status!=='pending-job'||!('commandId'in inputResume))return value;
  const commandId=inputResume.commandId,key=bound.connectionGeneration+'/'+commandId;
  const previous=printing.get(key);if(previous)return previous;
  const job=(async()=>{try{const payload=await runtime.printHtml(bound,commandId);const bytes=await printer.print(payload.html);if(session!==bound)throw Error('disconnected');return await runtime.completePdf(bound,commandId,bytes);}catch{if(session!==bound)throw Error('disconnected');return runtime.failPdf(bound,commandId);}})();
  printing.set(key,job);void job.finally(()=>printing.delete(key)).catch(()=>{});return job;
 };
 let browser:Awaited<ReturnType<typeof createBrowserHost>>;
 browser=await createBrowserHost({root:options.webRoot,port:options.port??0,identity,handlers,uploads:{
  'files/materials':{maximumBytes:MAX_TEXT_BYTES,handle:async input=>{const target=input.target===undefined?undefined:ImportTarget.parse(input.target),bound=session;return withBrowserFile(profile,input,['.txt','.md'],MAX_TEXT_BYTES,async filename=>{if(session!==bound)throw Error('invalid_capability');return MaterialResult.parse({kind:'preview',preview:await runtime.materials.selectFile(bound,filename,target)});});}},
  'files/sent':{maximumBytes:16*1024*1024,handle:async input=>{if(input.target!==undefined)throw Error('invalid_request');const bound=session;return withBrowserFile(profile,input,['.pdf','.txt','.md','.png','.jpg','.jpeg','.webp'],16*1024*1024,async filename=>{if(session!==bound)throw Error('invalid_capability');return runtime.selectSentFile(bound,filename);});}},
 },downloads:{'files/resume-pdf':async input=>{const value=z.strictObject({resumeId:z.uuid(),versionId:z.uuid()}).parse(input);const bytes=await runtime.readVersionPdf(session,value.resumeId,value.versionId);return {bytes,name:'Career-Resume.pdf',type:'application/pdf'};}},assets:{'feishu/avatar':async input=>{z.strictObject({}).parse(input);const avatar=await feishu.readAvatar();if(!avatar)throw Error('avatar_unavailable');return {bytes:avatar.bytes,type:avatar.mime};}}});
 return {...browser,handlers,identity,async close(){if(closed)return;closed=true;await Promise.allSettled([secrets.request({operation:'cancel'}),tavilySecrets.request({operation:'cancel'})]);await browser.close();deepseekStorage.close();tavilyStorage.close();await printer.close();await Promise.allSettled([...printing.values()]);await runtime.close();}};
 }catch(error){deepseekStorage.close();tavilyStorage.close();await printer.close();await runtime.close();throw error;}
}

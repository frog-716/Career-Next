import { createRuntimeBackend } from './runtime';
import { BusinessModuleSchema } from '../../contracts/registry';
import { dispatchMaterials } from '../transport/materials';
import { Identity } from '../../contracts/materials/schema';
import type { MessagePortMain } from 'electron';
import {z} from 'zod';
import {ProviderBinding} from '../platform/providers/binding';
import {Result as DataResult} from '../../contracts/application/schema';
async function start() {
const recoveryBackup=process.argv[4]?z.uuid().parse(process.argv[4]):undefined;
const runtime=await createRuntimeBackend(process.argv[2]!,undefined,process.argv[3]??process.argv[2]!,{automaticBackups:!recoveryBackup,...process.argv[5]?{providerBinding:ProviderBinding.parse(JSON.parse(process.argv[5]))}:{}});
// This isolated, empty maintenance candidate is never exposed as the active business workspace.
if(recoveryBackup){const human=await runtime.connectHuman();const candidate=DataResult.parse(await runtime.business(human,'application',{operation:'data.restore.prepare',backupId:recoveryBackup}));if(candidate.kind!=='restore_candidate'){await runtime.close();throw Error('restore_invalid');}const restored=DataResult.parse(await runtime.business(human,'application',{operation:'data.restore.activate',candidateId:candidate.copy.id,confirmed:true}));if(restored.kind!=='restored'){await runtime.close();throw Error('restore_invalid');}}

let currentPort: MessagePortMain | undefined;
let connectionQueue=Promise.resolve();
process.parentPort!.on('message',event=>{
  connectionQueue=connectionQueue.then(async()=>{
    currentPort?.close();
    const port: MessagePortMain=event.ports[0]!;
    const session=await runtime.connectHuman();
    const identity=Identity.parse({protocolVersion:session.protocolVersion,workspaceInstance:session.workspaceInstance,backendGeneration:session.backendGeneration,connectionGeneration:session.connectionGeneration});
    currentPort=port;
    port.on('message',async event=>{
      if(currentPort!==port) return;
      const {requestId,request,identity: bound,selectedFile,module,printAction,commandId,pdf,sentFileAction,searchAction,providerAction,binding}=event.data;
      if(providerAction){try{const parsed=Identity.parse(bound);if(JSON.stringify(parsed)!==JSON.stringify(identity)||providerAction!=='configure')throw Error('invalid_capability');runtime.configureProvider(ProviderBinding.parse(binding));if(currentPort===port)port.postMessage({requestId,identity,result:{configured:true}});}catch{if(currentPort===port)port.postMessage({requestId,identity,error:'invalid_request'});}return;}
      if(searchAction){try{const parsed=Identity.parse(bound);if(JSON.stringify(parsed)!==JSON.stringify(identity)||searchAction!=='query')throw Error('invalid_capability');const result=await runtime.search(session,request);if(currentPort===port)port.postMessage({requestId,identity,result});}catch{if(currentPort===port)port.postMessage({requestId,identity,error:'invalid_request'});}return;}
      if(sentFileAction){try{const parsed=Identity.parse(bound);if(JSON.stringify(parsed)!==JSON.stringify(identity)||sentFileAction!=='select'||typeof selectedFile!=='string')throw Error('invalid_capability');const result=await runtime.selectSentFile(session,selectedFile);if(currentPort===port)port.postMessage({requestId,identity,result});}catch{if(currentPort===port)port.postMessage({requestId,identity,error:'file_failed'});}return;}
      if(printAction){
        try{
          const parsed=Identity.parse(bound);if(JSON.stringify(parsed)!==JSON.stringify(identity))throw Error('invalid_capability');
          if(typeof commandId!=='string')throw Error('invalid_request');
          const result=printAction==='html'?await runtime.printHtml(session,commandId):printAction==='complete'&&pdf instanceof Uint8Array?await runtime.completePdf(session,commandId,pdf):printAction==='fail'?await runtime.failPdf(session,commandId):undefined;
          if(!result)throw Error('invalid_request');
          if(currentPort===port)port.postMessage({requestId,identity,result});
        }catch{if(currentPort===port)port.postMessage({requestId,identity,error:'invalid_request'});}
        return;
      }
      if(module){
        try {const parsed=Identity.parse(bound);if(JSON.stringify(parsed)!==JSON.stringify(identity))throw Error('invalid_capability');
          const result=await runtime.business(session,BusinessModuleSchema.parse(module),request);
          if(currentPort===port)port.postMessage({requestId,identity,result});
        }catch{if(currentPort===port)port.postMessage({requestId,identity,error:'invalid_request'});}
        return;
      }
      const result=await dispatchMaterials(runtime.materials,session,bound,request,selectedFile);
      if(currentPort===port) port.postMessage({requestId,identity,result});
    });
    port.start(); port.postMessage({ready:identity});
  }).catch(()=>{ process.exitCode=1; });
});
process.on('SIGTERM',()=>{ currentPort?.close(); void runtime.close().finally(()=>process.exit(0)); });

}
void start().catch(() => { console.error('CAREER_BACKEND_STARTUP_FAILED'); process.exit(1); });

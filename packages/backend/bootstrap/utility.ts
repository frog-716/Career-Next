import { createRuntimeBackend } from './runtime';
import { BusinessModuleSchema } from '../../contracts/registry';
import { dispatchMaterials } from '../transport/materials';
import { Identity } from '../../contracts/materials/schema';
import type { MessagePortMain } from 'electron';
async function start() {
const runtime=await createRuntimeBackend(process.argv[2]!,undefined,process.argv[3]??process.argv[2]!);

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
      const {requestId,request,identity: bound,selectedFile,module,printAction,commandId,pdf,sentFileAction}=event.data;
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

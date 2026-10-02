import { createMaterialsBackend } from '../domains/materials/public';
import { dispatchMaterials } from '../transport/materials';
import { Identity } from '../../contracts/materials/schema';
import type { MessagePortMain } from 'electron';
async function start() {
const backend=await createMaterialsBackend(process.argv[2]!);
let currentPort: MessagePortMain | undefined;
let connectionQueue=Promise.resolve();
process.parentPort!.on('message',event=>{
  connectionQueue=connectionQueue.then(async()=>{
    currentPort?.close();
    const port: MessagePortMain=event.ports[0]!;
    const session=await backend.connectHuman();
    const identity=Identity.parse({protocolVersion:session.protocolVersion,workspaceInstance:session.workspaceInstance,backendGeneration:session.backendGeneration,connectionGeneration:session.connectionGeneration});
    currentPort=port;
    port.on('message',async event=>{
      if(currentPort!==port) return;
      const {requestId,request,identity: bound,selectedFile}=event.data;
      const result=await dispatchMaterials(backend,session,bound,request,selectedFile);
      if(currentPort===port) port.postMessage({requestId,identity,result});
    });
    port.start(); port.postMessage({ready:identity});
  }).catch(()=>{ process.exitCode=1; });
});
process.on('SIGTERM',()=>{ currentPort?.close(); void backend.close().finally(()=>process.exit(0)); });

}
void start().catch(() => { console.error('CAREER_BACKEND_STARTUP_FAILED'); process.exit(1); });

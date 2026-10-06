import {createHeadlessPdfEngine} from '../capabilities/headless-pdf-engine';
let engine:ReturnType<typeof createHeadlessPdfEngine>|undefined,started=false,cancelled=false;
async function cancel(){cancelled=true;await engine?.close();}
const disconnected=()=>{void cancel().finally(()=>process.exit(1));};
process.on('disconnect',disconnected);
process.on('SIGTERM',()=>{void cancel().finally(()=>process.exit(1));});
process.on('message',(input:any)=>{
 if(input?.cancel){void cancel();return;}
 if(started||typeof input?.manifestFile!=='string'||typeof input?.html!=='string')return;
 started=true;engine=createHeadlessPdfEngine(input.manifestFile,pid=>process.send?.({browserPid:pid}));
 void engine.print(input.html).then(bytes=>{if(!cancelled)process.send?.({bytes:Uint8Array.from(bytes)});},()=>{}).finally(async()=>{await engine!.close();process.send?.({browserClosed:true},()=>{process.off('disconnect',disconnected);process.disconnect();process.exit(cancelled?1:0);});});
});

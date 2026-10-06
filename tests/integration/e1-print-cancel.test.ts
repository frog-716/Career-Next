import {it,expect} from 'vitest';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createHeadlessPrinter} from '../../apps/desktop/capabilities/headless-pdf';

function descendants(){const rows=execFileSync('/bin/ps',['-axo','pid=,ppid=,comm='],{encoding:'utf8'}).trim().split('\n').map(line=>{const m=line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/)!;return {pid:Number(m[1]),parent:Number(m[2]),name:m[3]};});const owned=new Set([process.pid]);for(let i=0;i<rows.length;i++)for(const row of rows)if(owned.has(row.parent))owned.add(row.pid);return rows.filter(row=>owned.has(row.pid)&&row.pid!==process.pid);}
function alive(pid:number){try{process.kill(pid,0);return true;}catch{return false;}}
async function until(check:()=>boolean){for(let i=0;i<200;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('test_process_wait_failed');}
it.each(['close','timeout'] as const)('%s releases active print Chromium and settles the caller',async mode=>{
 const before=new Set(descendants().map(row=>row.pid)),printer=createHeadlessPrinter(path.resolve('dist/application/pdf-environment.json'),mode==='timeout'?5000:60000);let owned:number[]=[];
 const result=printer.print('<html><script>while(true){}</script></html>').catch(()=>null);
 try{await until(()=>{owned=descendants().filter(row=>!before.has(row.pid)&&row.name.includes('Google Chrome for Testing')).map(row=>row.pid);return owned.length>0;});if(mode==='close')await printer.close();expect(await result).toBeNull();await until(()=>owned.every(pid=>!alive(pid)));expect(owned.every(pid=>!alive(pid))).toBe(true);
 }finally{await printer.close();for(const pid of owned)if(alive(pid))try{process.kill(pid,'SIGKILL');}catch{}}
},30000);

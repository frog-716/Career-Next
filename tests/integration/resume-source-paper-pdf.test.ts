import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {createHeadlessPrinter} from '../../apps/desktop/capabilities/headless-pdf';
import {renderSnapshot} from '../../packages/backend/domains/resume/render';
it('source paper PDF preserves real Chinese codepoints, duties, dates, A4, links and deterministic layout without placeholder text',async()=>{
 const printer=createHeadlessPrinter(path.resolve('dist/application/pdf-environment.json')),entry=randomUUID();
 const snapshot={id:randomUUID(),resumeId:randomUUID(),opportunityId:randomUUID(),resumeRevision:1,profileRevision:0,contentHash:'a'.repeat(64),...printer.metadata(),templateVersion:'miaoda-paper-1',rendererVersion:'career-print-2',recordedAt:new Date().toISOString(),profile:{revision:0,name:'TEST Candidate',contact:'TEST Contact',links:[{label:'TEST Link',href:'https://example.com/'}]},content:{schemaVersion:1,layout:{template:'miaoda-paper',fontSize:12,contentScale:0.965,identityPosition:'top',identityNameAlignment:'center'},sections:[{id:randomUUID(),kind:'project',title:'项目经历',blocks:[{id:randomUUID(),type:'paragraph',entry:{id:entry,field:'name'},spans:[{text:'TEST 项目',marks:[{type:'bold'}]}]},{id:randomUUID(),type:'paragraph',entry:{id:entry,field:'responsibility'},spans:[{text:'TEST 项目负责人',marks:[]}]},{id:randomUUID(),type:'paragraph',entry:{id:entry,field:'date'},spans:[{text:'2024.01 - 2025.06',marks:[]}]},{id:randomUUID(),type:'bullet-list',items:[{id:randomUUID(),paragraphId:randomUUID(),spans:[{text:'TEST 口径分析目标交付：日期、职责、项目与中文。',marks:[{type:'italic'}]}]}]}]}]}};
 let baseline='';
 try{for(let n=0;n<2;n++){
  const bytes=await printer.print(renderSnapshot(snapshot)),job=getDocument({data:new Uint8Array(bytes)}),pdf=await job.promise;expect(pdf.numPages).toBe(1);const page=await pdf.getPage(1),content=await page.getTextContent(),items=content.items.filter((i:any)=>'str'in i) as any[],text=items.map(i=>i.str).join('');expect(text).toContain('TEST 项目负责人');expect(text).toContain('2024.01 - 2025.06');expect(text).toContain('口径分析目标交付');expect(text).not.toMatch(/[\u2e80-\u2fff\ufffd\u0000]/);expect(text).not.toContain('起止时间');expect(page.view[2]).toBeCloseTo(595,0);expect(page.view[3]).toBeCloseTo(842,0);expect((await page.getAnnotations()).some(a=>a.url==='https://example.com/')).toBe(true);const values=JSON.stringify(items.map(i=>({text:i.str,xy:i.transform,width:i.width})));if(baseline)expect(values).toBe(baseline);else baseline=values;await job.destroy();
 }}finally{await printer.close();}
},60000);

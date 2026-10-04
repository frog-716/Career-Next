import {it,expect} from 'vitest';
import {_electron} from 'playwright';
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

it('packaged editor freezes alignment in real PDF and history, retaining it through AI undo/redo and reopening',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-resume-alignment-'));const packaged=process.env.CAREER_PACKAGED==='1';
 const options={executablePath:packaged?path.resolve(process.env.CAREER_PACKAGED_EXECUTABLE??'out/CareerNext-darwin-arm64/CareerNext.app/Contents/MacOS/CareerNext'):undefined,args:packaged?[`--user-data-dir=${root}/profile`]:['.',`--user-data-dir=${root}/profile`],timeout:30000};
 let app=await _electron.launch(options);
 try{
  let page=await app.firstWindow();page.setDefaultTimeout(10000);await page.getByRole('navigation',{name:'一级导航'}).waitFor();
  const fixture=await page.evaluate(async()=>{
   const call=(module:any,input:any)=>window.career.request(module,input) as Promise<any>;
   await call('profile',{operation:'profile.save',commandId:crypto.randomUUID(),expectedRevision:0,name:'TEST 姓名',contact:'',links:[]});
   const company=(await call('opportunity',{operation:'company.create',commandId:crypto.randomUUID(),name:'Alignment TEST DATA'})).company;
   const opportunity=(await call('opportunity',{operation:'create',commandId:crypto.randomUUID(),companyId:company.id,role:'Alignment TEST'})).opportunity;
   const opened=await call('resume',{operation:'resume.open',commandId:crypto.randomUUID(),opportunityId:opportunity.id});const content=structuredClone(opened.document.content);
   content.sections[0].blocks=[{id:crypto.randomUUID(),type:'paragraph',spans:[{text:'蒸牛蛙，这是对齐测试 中文 CENTER TEST',marks:[{type:'bold'},{type:'italic'}]}]},{id:crypto.randomUUID(),type:'paragraph',spans:[{text:'LEFT TEST',marks:[]}]},{id:crypto.randomUUID(),type:'paragraph',spans:[{text:'RIGHT TEST',marks:[]}]},{id:crypto.randomUUID(),type:'bullet-list',items:[{id:crypto.randomUUID(),paragraphId:crypto.randomUUID(),spans:[{text:'BULLET TEST',marks:[]}]}]}];
   const saved=await call('resume',{operation:'resume.save',commandId:crypto.randomUUID(),resumeId:opened.document.id,expectedRevision:1,expectedProfileRevision:1,content});if(saved.status!=='document')throw Error('save');location.hash='#/opportunity/'+opportunity.id+'/resume';return {resumeId:opened.document.id,opportunityId:opportunity.id};
  });
  const editor=()=>page.getByRole('textbox',{name:'简历正文',exact:true});await editor().waitFor();
  const alignment=()=>editor().locator('p').first().evaluate(el=>getComputedStyle(el).textAlign);
  await editor().locator('p').first().click();await page.getByRole('button',{name:'正文居中',exact:true}).click();expect(await alignment()).toBe('center');
  await page.getByRole('button',{name:'撤销',exact:true}).click();expect(await alignment()).toBe('start');
  await page.getByRole('button',{name:'重做',exact:true}).click();expect(await alignment()).toBe('center');
  await page.getByRole('button',{name:'姓名居中',exact:true}).click();expect(await page.getByLabel('基础资料姓名',{exact:true}).evaluate(el=>getComputedStyle(el).textAlign)).toBe('center');
  await page.getByRole('button',{name:'撤销',exact:true}).click();expect(await page.getByLabel('基础资料姓名',{exact:true}).evaluate(el=>getComputedStyle(el).textAlign)).toBe('left');
  await page.getByRole('button',{name:'重做',exact:true}).click();
  await editor().locator('p').filter({hasText:'RIGHT TEST'}).click({position:{x:10,y:8}});await page.getByRole('button',{name:'正文右对齐',exact:true}).click();
  expect(await editor().locator('p').filter({hasText:'RIGHT TEST'}).evaluate(el=>getComputedStyle(el).textAlign)).toBe('right');await editor().locator('li p').click({position:{x:10,y:8}});await page.getByRole('button',{name:'正文居中',exact:true}).click();
  // Synthetic composition covers save gating only; real macOS IME is a separate human acceptance.
  await editor().dispatchEvent('compositionstart',{data:'zhongwen'});expect(await page.getByTestId('resume-save-state').textContent()).toBe('正在中文输入，暂不保存');await editor().dispatchEvent('compositionend',{data:'中文'});
  await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');
  await page.getByRole('button',{name:'命名版本（⌘S）',exact:true}).click();await page.getByLabel('版本名称').fill('CENTER frozen TEST');await page.getByRole('button',{name:'保存版本及 PDF',exact:true}).click();await page.getByText('命名版本及 PDF 已冻结保存',{exact:true}).waitFor({timeout:45000});
  const version=await page.evaluate(async id=>{const result:any=await window.career.request('resume',{operation:'resume.versions',resumeId:id});return result.versions[0];},fixture.resumeId);
  expect(version.snapshot.content.layout.identityNameAlignment).toBe('center');expect(version.snapshot.content.sections[0].blocks[0].alignment).toBe('center');
  const bytes=await readFile(path.join(root,'profile/workspaces/local/blobs',version.pdf.blobId));const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true});const pdf=await loading.promise;const pdfPage=await pdf.getPage(1);const width=pdfPage.getViewport({scale:1}).width;
  const lines=new Map<number,{text:string;left:number;right:number}>();for(const item of (await pdfPage.getTextContent()).items)if('str'in item){const y=Math.round(item.transform[5]),line=lines.get(y)??{text:'',left:Infinity,right:-Infinity};line.text+=item.str;line.left=Math.min(line.left,item.transform[4]);line.right=Math.max(line.right,item.transform[4]+item.width);lines.set(y,line);}
  const find=(text:string)=>{const line=[...lines.values()].find(line=>line.text.includes(text));if(!line)throw Error('PDF text missing: '+text);return line;};
  const center=find('CENTER TEST'),left=find('LEFT TEST'),right=find('RIGHT TEST'),name=find('TEST 姓名');expect(center.text).toContain('蒸牛蛙，这是对齐测试 中文');expect(Math.abs((center.left+center.right)/2-width/2)).toBeLessThan(3);expect(Math.abs((name.left+name.right)/2-width/2)).toBeLessThan(3);expect(Math.abs(left.left-18/25.4*72)).toBeLessThan(3);expect(Math.abs(right.right-(width-18/25.4*72))).toBeLessThan(3);await loading.destroy();
  await editor().locator('p').first().click();await page.getByRole('button',{name:'正文左对齐',exact:true}).click();await page.getByRole('button',{name:'姓名左对齐',exact:true}).click();await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');
  await page.getByRole('button',{name:'版本历史',exact:true}).click();await page.getByRole('button',{name:'CENTER frozen TEST',exact:true}).click();expect(await page.locator('.resume-frozen-body p').first().evaluate(el=>getComputedStyle(el).textAlign)).toBe('center');expect(await page.getByTestId('frozen-resume-name').evaluate(el=>getComputedStyle(el).textAlign)).toBe('center');expect(await page.locator('.resume-frozen-body strong em, .resume-frozen-body em strong').count()).toBeGreaterThan(0);await page.getByRole('button',{name:'关闭历史',exact:true}).click();
  await editor().locator('p').first().click();await page.getByRole('button',{name:'正文居中',exact:true}).click();await page.getByRole('button',{name:'姓名居中',exact:true}).click();await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');
  await page.getByRole('button',{name:'简历优化提案',exact:true}).click();const selection=page.getByLabel('简历优化选择');await selection.getByLabel(/个人简介 · 蒸牛蛙，这是对齐测试 中文 CENTER TEST/).check();const ai=selection.getByRole('region',{name:'产品任务辅助'});await ai.getByRole('button',{name:'准备当前任务与最终预览'}).click();await ai.getByRole('button',{name:'授权这份最终请求'}).click();const proposal=ai.getByRole('article',{name:'产品待审提案'}).filter({has:page.getByRole('heading',{name:/^选定简历区块/})});await proposal.waitFor();const before=await editor().locator('p').first().textContent();await proposal.getByRole('button',{name:'接受本条并立即生效'}).click();await page.getByText('仅选定区块的提案已生效，可独立撤销；其他输入保留。',{exact:true}).waitFor();const after=await editor().locator('p').first().textContent();expect(after).not.toBe(before);expect(await alignment()).toBe('center');
  await page.getByRole('button',{name:'撤销',exact:true}).click();expect(await editor().locator('p').first().textContent()).toBe(before);expect(await alignment()).toBe('center');await page.getByRole('button',{name:'重做',exact:true}).click();expect(await editor().locator('p').first().textContent()).toBe(after);expect(await alignment()).toBe('center');expect(await proposal.getByRole('heading').textContent()).toContain('accepted');await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');
  await app.close();app=await _electron.launch(options);page=await app.firstWindow();await page.getByRole('navigation',{name:'一级导航'}).waitFor();await page.evaluate(id=>{location.hash='#/opportunity/'+id+'/resume';},fixture.opportunityId);await editor().waitFor();expect(await alignment()).toBe('center');expect(await page.getByLabel('基础资料姓名',{exact:true}).evaluate(el=>getComputedStyle(el).textAlign)).toBe('center');expect(await editor().locator('p').first().textContent()).toBe(after);
  await mkdir('out/verification/resume-alignment',{recursive:true});await writeFile('out/verification/resume-alignment/test.pdf',bytes);await writeFile('out/verification/resume-alignment/results.json',JSON.stringify({packaged,saveReopen:true,version:true,history:true,pdfCoordinates:{width,center,left,right,name},chineseSelectable:true,aiApplyUndoRedo:true,manualUndoRedo:true,syntheticComposition:true,realIME:'PENDING HUMAN'},null,2));
 }finally{await app.evaluate(({dialog})=>{dialog.showMessageBoxSync=(()=>1) as typeof dialog.showMessageBoxSync;}).catch(()=>{});await app.close();await rm(root,{recursive:true,force:true});}
},120000);

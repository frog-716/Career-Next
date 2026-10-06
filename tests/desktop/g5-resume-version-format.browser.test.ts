import {it,expect} from 'vitest';
import {launchBrowserFixture,skipTutorial} from '../fixtures/browser-host';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Result as ResumeResult} from '../../packages/contracts/resume/schema';

it('named rich ResumeVersion retains frozen marks in history, actual PDF and a durable restore',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-E2-TEST-g5-version-format-')),packaged=false;
 const f=await launchBrowserFixture({profile:path.join(root,'profile'),fake:false});
 try{
  let page=f.page;await skipTutorial(page);page.setDefaultTimeout(10000);await page.getByRole('navigation',{name:'一级导航'}).waitFor();
  const fixture=await page.evaluate(async()=>{
   const call=(module:any,input:any)=>window.career.request(module,input) as Promise<any>;
   const company=(await call('opportunity',{operation:'company.create',commandId:crypto.randomUUID(),name:'Version format fixture'})).company;
   const opportunity=(await call('opportunity',{operation:'create',commandId:crypto.randomUUID(),companyId:company.id,role:'Freeze rich body'})).opportunity;
   const opened=await call('resume',{operation:'resume.open',commandId:crypto.randomUUID(),opportunityId:opportunity.id});
   const content=structuredClone(opened.document.content);content.sections[0].blocks=[{id:crypto.randomUUID(),type:'paragraph',spans:[{text:'蒸牛蛙，plain text ',marks:[]},{text:'这是中文输入测试 Bold sample',marks:[{type:'bold'}]},{text:' abc123 ',marks:[]},{text:'Italic sample',marks:[{type:'italic'}]}]},{id:crypto.randomUUID(),type:'bullet-list',items:[{id:crypto.randomUUID(),paragraphId:crypto.randomUUID(),spans:[{text:'List plain ',marks:[]},{text:'List bold',marks:[{type:'bold'}]},{text:' List italic',marks:[{type:'italic'}]}]}]}];
   const saved=await call('resume',{operation:'resume.save',commandId:crypto.randomUUID(),resumeId:opened.document.id,expectedRevision:opened.document.revision,expectedProfileRevision:opened.profile.revision,content});if(saved.status!=='document')throw Error('save failed');
   location.hash='#/opportunity/'+opportunity.id+'/resume';return {resumeId:opened.document.id,opportunityId:opportunity.id,content};
  });
  const editor=page.getByRole('textbox',{name:'简历正文',exact:true});await editor.waitFor();
  await page.getByLabel('简历更多',{exact:true}).click();await page.getByRole('button',{name:'命名版本（⌘S）',exact:true}).click();await page.getByLabel('版本名称').fill('Frozen formatting');await page.getByRole('button',{name:'保存版本及 PDF',exact:true}).click();await page.getByText('命名版本及 PDF 已冻结保存',{exact:true}).waitFor({timeout:45000});
  const versions=ResumeResult.parse(await page.evaluate(id=>window.career.request('resume',{operation:'resume.versions',resumeId:id}),fixture.resumeId));if(versions.status!=='versions')throw Error('versions failed');expect(versions.versions).toHaveLength(1);const version=versions.versions[0];expect(version.snapshot.content).toEqual(fixture.content);
  await editor.locator('p').first().fill('Later ordinary current body');await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');
  await page.getByLabel('简历更多',{exact:true}).click();await page.getByRole('button',{name:'版本历史',exact:true}).click();await page.getByRole('button',{name:'Frozen formatting',exact:true}).click();
  const history=page.locator('.resume-frozen-body');expect(await history.locator('strong').allTextContents()).toEqual(['这是中文输入测试 Bold sample','List bold']);expect(await history.locator('em').allTextContents()).toEqual(['Italic sample',' List italic']);expect(await history.locator('ul > li').allTextContents()).toEqual(['List plain List bold List italic']);expect(await history.locator('strong').first().evaluate(el=>getComputedStyle(el).fontWeight)).toBe('700');expect(await history.locator('em').first().evaluate(el=>getComputedStyle(el).fontStyle)).toBe('italic');expect(await history.locator('ul').evaluate(el=>getComputedStyle(el).listStyleType)).toBe('disc');expect(await history.textContent()).not.toContain('Later ordinary current body');
  const bytes=await readFile(path.join(root,'profile/workspaces/local/blobs',version.pdf.blobId));expect(createHash('sha256').update(bytes).digest('hex')).toBe(version.pdf.digest);expect(bytes.length).toBe(version.pdf.size);
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=getDocument({data:new Uint8Array(bytes),useSystemFonts:true,fontExtraProperties:true});const pdf=await loading.promise;
  const fonts:{text:string;name:string}[]=[];for(let n=1;n<=pdf.numPages;n++){const p=await pdf.getPage(n);await p.getOperatorList();for(const item of (await p.getTextContent()).items)if('str'in item)fonts.push({text:item.str,name:p.commonObjs.get(item.fontName).name});}await loading.destroy();
  const text=fonts.map(item=>item.text).join('').normalize('NFKC');expect(text).toContain('蒸牛蛙');expect(text).toContain('这是中文输入测试');expect(text).toContain('List plain List bold List italic');
  expect(fonts.some(item=>item.text.includes('Bold sample')&&/Bold/.test(item.name))).toBe(true);expect(fonts.some(item=>item.text.includes('Italic sample')&&/Italic|Oblique/.test(item.name))).toBe(true);expect(fonts.some(item=>item.text.includes('abc123')&&!/Bold|Semibold|Italic/.test(item.name))).toBe(true);expect(fonts.some(item=>item.text.includes('List bold')&&/Bold/.test(item.name))).toBe(true);expect(fonts.some(item=>item.text.includes('List italic')&&/Italic|Oblique/.test(item.name))).toBe(true);
  await writeFile('/tmp/career-g5-version-format-pdf.pdf',bytes);await writeFile('/tmp/career-g5-version-format-pdf-fonts.json',JSON.stringify({versionId:version.id,pdf:version.pdf,fonts},null,2));await page.screenshot({path:'/tmp/career-g5-version-format-history.png'});
  await page.getByRole('button',{name:'恢复此版本正文',exact:true}).click();await expect.poll(()=>page.getByTestId('resume-save-state').textContent()).toBe('已保存');
  const restored=ResumeResult.parse(await page.evaluate(id=>window.career.request('resume',{operation:'resume.read',resumeId:id}),fixture.resumeId));if(restored.status!=='document')throw Error('restore read failed');expect(restored.document.content).toEqual(fixture.content);
  page=await f.reopen('#/opportunity/'+fixture.opportunityId+'/resume');await page.getByRole('navigation',{name:'一级导航'}).waitFor();
  await page.evaluate(id=>{location.hash='#/opportunity/'+id+'/resume';},fixture.opportunityId);await page.getByRole('textbox',{name:'简历正文',exact:true}).waitFor();expect(await page.getByRole('textbox',{name:'简历正文',exact:true}).locator('strong').allTextContents()).toEqual(['这是中文输入测试 Bold sample','List bold']);expect(ResumeResult.parse(await page.evaluate(id=>window.career.request('resume',{operation:'resume.versions',resumeId:id}),fixture.resumeId))).toEqual(versions);expect(await readFile(path.join(root,'profile/workspaces/local/blobs',version.pdf.blobId))).toEqual(bytes);
  await writeFile('/tmp/career-g5-version-format-packaged-results.json',JSON.stringify({packaged,frozenJson:true,richHistory:true,actualPdfMarks:true,durableRestore:true,realIME:'not tested by automatic document fixture'},null,2));
 }finally{await f.close();await rm(root,{recursive:true,force:true});}
},90000);

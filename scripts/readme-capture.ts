/** Public README media: real UI + local owners, fictional data, no external services. */
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {createNodeHost} from '../apps/desktop/node/host';

async function main() {
 const output=path.resolve('docs/assets/readme');
 const frames=path.resolve('out/readme-frames');
 await mkdir(output,{recursive:true});
 await rm(frames,{recursive:true,force:true});
 await mkdir(frames,{recursive:true});
 const profile=await mkdtemp(path.join(tmpdir(),'career-README-TEST-'));
 const unavailable=async()=>{throw Error('README capture forbids external services');};
 const host=await createNodeHost({profile,artifacts:path.resolve('dist/application'),webRoot:path.resolve('dist/materials-renderer'),port:0,automaticBackups:false,
  providerTransport:unavailable,tavilyTransport:unavailable,
  feishuPorts:{authState:async()=> 'not_configured',readCurrentUser:unavailable,downloadAvatar:unavailable},
  feishuDiscoveryPorts:{searchDocuments:unavailable},
  feishuBitablePorts:{listTables:unavailable,listViews:unavailable,listFields:unavailable},
  feishuBitableRecordPorts:{readRecords:unavailable},
 });
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
 const errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin===host.url?route.continue():route.abort());
 page.on('dialog',dialog=>void dialog.accept());
 try {
  await page.goto(host.url);
  await page.getByRole('navigation',{name:'一级导航'}).waitFor();
  const tutorial=page.getByRole('region',{name:'新手教程'});
  if(await tutorial.isVisible())await tutorial.getByRole('button',{name:'跳过',exact:true}).click();
  const ids=await page.evaluate(async()=>{
   const call=async(module:any,input:any):Promise<any>=>{
    const result:any=await window.career.request(module,input);
    if(result.kind==='failure'||result.status==='failure')throw Error(JSON.stringify(result));
    return result;
   };
   const commandId=()=>crypto.randomUUID();
   await call('profile',{operation:'profile.save',commandId:commandId(),expectedRevision:0,name:'林知远 · 演示',contact:'产品经理  |  lin@example.test',links:[]});
   const opportunities=[];
   for(const [company,role,phase] of [['山岚科技（演示）','AI 产品经理','preparation'],['远川设计（演示）','高级产品经理','submitted'],['知行工作室（演示）','产品负责人','interview'],['星屿实验室（演示）','增长产品经理','offer']]){
    const c=await call('opportunity',{operation:'company.create',commandId:commandId(),name:company});
    let o=(await call('opportunity',{operation:'create',commandId:commandId(),companyId:c.company.id,role})).opportunity;
    o=(await call('opportunity',{operation:'save-jd',commandId:commandId(),id:o.id,expectedRevision:o.revision,jd:'面向知识工作者，设计易用、可信的 AI 产品。\n负责用户研究、交互设计与产品落地；重视真实需求与可验证的交付。\n演示岗位，所有公司、人物和经历均为虚构。',reason:'保存虚构演示岗位',businessTime:{kind:'unknown'}})).opportunity;
    if(phase!=='preparation')await call('opportunity',{operation:'record-stage',commandId:commandId(),id:o.id,expectedRevision:o.revision,stage:phase,reason:'虚构演示阶段',businessTime:{kind:'unknown'}});
    opportunities.push(o);
   }
   const opportunity=opportunities[0];
   const opened=await call('resume',{operation:'resume.open',commandId:commandId(),opportunityId:opportunity.id});
   const paragraph=(text:string)=>({id:commandId(),type:'paragraph',spans:[{text,marks:[]}]});
   const entry=(fields:Record<string,string>)=>{const id=commandId();return Object.entries(fields).map(([field,text])=>({...paragraph(text),entry:{id,field}}));};
   const bullets=(texts:string[])=>({id:commandId(),type:'bullet-list',items:texts.map(text=>({id:commandId(),paragraphId:commandId(),spans:[{text,marks:[]}]}))});
   const content={schemaVersion:1,layout:{template:'miaoda-paper',fontSize:12,identityPosition:'top',identityNameAlignment:'center'},sections:[
    {id:commandId(),kind:'summary',title:'个人简介',blocks:[paragraph('关注复杂工具的易用性。把用户访谈、交互设计与数据反馈串起来，让产品更好用，也更可信。')]},
    {id:commandId(),kind:'experience',title:'工作经历',blocks:[...entry({company:'云舟科技（演示）',position:'产品经理',date:'2023.07 — 2026.06'}),bullets(['负责团队知识工具，从用户访谈到需求排序，持续跟进交付。','设计资料导入与来源回看流程，帮助团队减少重复整理。'])]},
    {id:commandId(),kind:'project',title:'项目经历',blocks:[...entry({name:'团队知识工作台',responsibility:'产品设计与推进',date:'2025.03 — 2026.02'}),bullets(['梳理「保存材料 → 形成理解 → 复用经验」的完整使用流程。','将 AI 建议与正式内容分开，增加预览、人工采纳与来源追踪。'])]},
    {id:commandId(),kind:'skills',title:'专业技能',blocks:[paragraph('用户研究 / 信息架构 / 交互设计 / SQL / AI 产品设计')]},
    {id:commandId(),kind:'education',title:'教育经历',blocks:[...entry({school:'示例大学',major:'信息管理 · 本科',date:'2019.09 — 2023.06'})]},
   ]};
   const saved=await call('resume',{operation:'resume.save',commandId:commandId(),resumeId:opened.document.id,expectedRevision:opened.document.revision,expectedProfileRevision:1,content});
   await call('resume',{operation:'resume.name-version',commandId:commandId(),resumeId:opened.document.id,expectedRevision:saved.document.revision,expectedProfileRevision:1,name:'投递前 · 第一版（演示）'});
   await call('research',{operation:'create',commandId:commandId(),owner:{kind:'opportunity',id:opportunity.id},title:'岗位判断：把可信的 AI 做成日常工具',body:'这份演示岗位重视知识工具的易用性。准备简历时，突出资料整理、来源追踪和人工确认的产品经验。\n\n下一步：面试时核对目标用户、团队分工和实际成功标准。以上是演示推断，尚未独立核验。',nature:'inference',sources:[],leads:[],userConfirmed:true,independentlyVerified:false});
   for(const [title,body] of [['让 AI 建议更容易被信任','先让用户看清来源与修改，再由用户决定是否采纳。演示经验。'],['项目复盘：把成果写具体','写清做了什么、为什么做、结果如何；不把团队成果全部记成个人成绩。演示经验。'],['面试准备：先核对岗位重点','把已确认的信息、自己的判断和待核对的问题分开记录。演示经验。']])await call('wiki',{operation:'create',commandId:commandId(),title,body,scope:'personal',nature:'observation',sources:[]});
   return {opportunityId:opportunity.id,resumeId:opened.document.id};
  });
  await page.goto(host.url+'/#/opportunity');
  await page.reload();
  const pipeline=page.getByRole('table',{name:'机会管线'});
  await pipeline.getByRole('row').nth(4).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(output,'opportunity.png'),clip:{x:0,y:0,width:1440,height:540}});
  await page.getByRole('button',{name:'山岚科技（演示） · AI 产品经理',exact:true}).click();
  const tabs=page.getByRole('navigation',{name:'机会分区'});
  await tabs.waitFor();
  await page.screenshot({path:path.join(output,'overview.png'),clip:{x:0,y:0,width:1440,height:760}});
  await tabs.getByRole('button',{name:'简历',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'简历正文',exact:true});
  await editor.getByText('团队知识工作台',{exact:true}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(output,'resume.png')});
  await page.getByRole('button',{name:'历史版本',exact:true}).click();
  await page.getByRole('button',{name:'投递前 · 第一版（演示）',exact:true}).click();
  await page.getByRole('heading',{name:'投递前 · 第一版（演示）（冻结材料）',exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'resume-history.png')});
  await page.getByRole('button',{name:'关闭历史',exact:true}).click();
  await page.getByRole('button',{name:'返回所属机会',exact:true}).click();
  await tabs.waitFor();

  // Capture actual switching and the product's existing tab-indicator transition.
  let frame=0;
  async function snap(){await page.screenshot({path:path.join(frames,String(frame++).padStart(3,'0')+'.png'),clip:{x:0,y:0,width:1440,height:720}});}
  for(const label of ['概览','情报','沟通','面试','Offer','概览']){
   await tabs.getByRole('button',{name:label,exact:true}).click();
   for(let n=0;n<5;n++){await page.waitForTimeout(80);await snap();}
   await page.waitForTimeout(350);await snap();
  }
  await page.getByRole('navigation',{name:'一级导航'}).getByRole('link',{name:'Wiki',exact:true}).click();
  await page.getByText('让 AI 建议更容易被信任',{exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'wiki.png'),clip:{x:0,y:0,width:1440,height:600}});
  if(errors.length)throw Error(errors.join('\n'));
  await writeFile(path.join(frames,'capture.json'),JSON.stringify({fictionalData:true,realUI:true,externalServices:false,profileRemovedOnExit:true,frames:frame,pageErrors:errors},null,2));
  console.log('README media captured from isolated TEST workspace.');
 } catch(error) {await page.screenshot({path:path.join(frames,'failure.png')});await writeFile(path.join(frames,'failure.txt'),await page.locator('body').innerText());throw error;}
 finally {await browser.close();await host.close();await rm(profile,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

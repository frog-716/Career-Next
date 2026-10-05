import {it,expect} from 'vitest';
import {toEditor,fromEditor} from '../packages/frontend/features/resume/adapter';
import {createResumeSaveSession} from '../packages/frontend/features/resume/save-session';
import {randomUUID} from 'node:crypto';
import type {CareerDocument,Result,Request} from '../packages/contracts/resume/schema';
const content:CareerDocument={schemaVersion:1,sections:[{id:'00000000-0000-4000-8000-000000000001',kind:'skills',title:'技能',blocks:[{id:'00000000-0000-4000-8000-000000000002',type:'paragraph',spans:[{text:'中文与English',marks:[{type:'bold'},{type:'link',href:'https://example.test/'}]}]}]}],layout:{template:'a4-basic',fontSize:12,identityPosition:'top'}};
it('Career document round-trip preserves section identity and supported rich text; rejects unknown editor structures',()=>{
 expect(fromEditor(toEditor(content),content.layout)).toEqual(content);
 expect(()=>fromEditor({type:'doc',content:[{type:'unknown',content:[]}]},content.layout)).toThrow();
});
it('composition never autosaves unfinished text; successful earlier response cannot mark later input saved',async()=>{
 const calls:Request[]=[];let finish!:(r:Result)=>void;
 const session=createResumeSaveSession({resumeId:randomUUID(),revision:1,profileRevision:0,content},input=>{calls.push(input);return new Promise(resolve=>{finish=resolve;});});
 session.composition(true);session.change(content);
 expect(await session.flush()).toBe(false);expect(calls).toHaveLength(0);
 session.composition(false);const saving=session.flush();expect(calls).toHaveLength(1);
 const changed=structuredClone(content);changed.sections[0].title='新输入';session.change(changed);
 finish({status:'document',document:{id:(calls[0] as Extract<Request,{operation:'resume.save'}>).resumeId,opportunityId:randomUUID(),revision:2,content,recordedAt:new Date().toISOString()},profile:{revision:0,name:'',contact:'',links:[]},opportunity:{id:randomUUID(),companyName:'X',role:'Y'}});
 await saving;expect(session.state().status).toBe('dirty');expect(session.state().content).toEqual(changed);
 session.dispose();
});

it('lost receipt preserves original command and checks committed body before further saves',async()=>{
 let input:Extract<Request,{operation:'resume.save'}>|undefined;
 const resumeId=randomUUID();const opportunityId=randomUUID();
 const session=createResumeSaveSession({resumeId,revision:1,profileRevision:0,content},async request=>{
  if(request.operation==='resume.save'){input=request;throw new Error('connection lost after commit');}
  if(request.operation==='resume.receipt')return {status:'document',document:{id:resumeId,opportunityId,revision:2,content,recordedAt:new Date().toISOString()},profile:{revision:0,name:'',contact:'',links:[]},opportunity:{id:opportunityId,companyName:'X',role:'Y'}};
  throw new Error('unexpected operation');
 });
 session.change(content);expect(await session.flush()).toBe(false);expect(session.state().status).toBe('unknown');
 expect(await session.flush()).toBe(false);expect(input).toBeDefined();
 expect(await session.verify()).toBe(true);expect(session.state().status).toBe('saved');expect(session.state().revision).toBe(2);session.dispose();
});

it('frozen PDF rendering escapes user HTML and disallows resource/script links',async()=>{
 const {renderSnapshot}=await import('../packages/backend/domains/resume/public');
 const snapshot={id:randomUUID(),resumeId:randomUUID(),opportunityId:randomUUID(),resumeRevision:1,profileRevision:1,content,profile:{revision:1,name:'<script>alert(1)</script>',contact:'a & b',links:[{label:'我的网页',href:'https://example.test/'}]},contentHash:'d'.repeat(64),templateVersion:'a4-basic-1',fontVersion:'macos-system-cjk',engineVersion:'electron-44.5.1',rendererVersion:'career-print-1',recordedAt:new Date().toISOString()};
 const html=renderSnapshot(snapshot);expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');expect(html).not.toContain('<script>');expect(html).toContain('a &amp; b');expect(html).toContain('size:A4');expect(()=>renderSnapshot({...snapshot,profile:{...snapshot.profile,links:[{label:'bad',href:'javascript:alert(1)'}]}})).toThrow();
});
it('keeping local text at a newer conflict baseline submits it before claiming saved',async()=>{
 const calls:Request[]=[];const resumeId=randomUUID(),opportunityId=randomUUID();
 const session=createResumeSaveSession({resumeId,revision:1,profileRevision:0,content},async request=>{calls.push(request);return {status:'document',document:{id:resumeId,opportunityId,revision:3,content,recordedAt:new Date().toISOString()},profile:{revision:0,name:'',contact:'',links:[]},opportunity:{id:opportunityId,companyName:'X',role:'Y'}};});
 const formal=structuredClone(content);formal.sections[0].blocks=[{id:randomUUID(),type:'paragraph',spans:[{text:'服务器另一个正文',marks:[]}]}];
 session.compare({status:'conflict',document:{id:resumeId,opportunityId,revision:2,content:formal,recordedAt:new Date().toISOString()},profile:{revision:0,name:'',contact:'',links:[]}});
 session.useComparisonRevision();expect(await session.flush()).toBe(true);expect(calls).toHaveLength(1);
 expect(calls[0]).toMatchObject({operation:'resume.save',expectedRevision:2,content});session.dispose();
});

it('unknown Resume save cannot continue until receipt checking confirms it was not recorded, and retains command identity',async()=>{
 const calls:Request[]=[];let sends=0;
 const session=createResumeSaveSession({resumeId:randomUUID(),revision:1,profileRevision:0,content},async input=>{calls.push(input);if(input.operation==='resume.receipt')return {status:'not-found'};sends++;throw Error('controlled lost response');});
 session.change(content);await session.flush();expect(sends).toBe(1);
 await session.continueOriginal();expect(sends).toBe(1);
 await session.verify();expect(session.state().mayContinue).toBe(true);
 await session.continueOriginal();expect(sends).toBe(2);expect(calls[0]).toEqual(calls[2]);expect(session.state().mayContinue).toBe(false);
 session.dispose();
});

import {it,expect} from 'vitest';
import {CareerDocument,Snapshot} from '../packages/contracts/resume/schema';
import {toEditor,fromEditor} from '../packages/frontend/features/resume/adapter';
import {renderSnapshot} from '../packages/backend/domains/resume/render';
const old={schemaVersion:1,sections:[{id:'00000000-0000-4000-8000-000000000001',kind:'summary',title:'测试',blocks:[{id:'00000000-0000-4000-8000-000000000002',type:'paragraph',spans:[{text:'中文 Test',marks:[{type:'bold'},{type:'italic'}]}]}]}],layout:{template:'a4-basic',fontSize:12,identityPosition:'top'}};
it('schema v1 alignment is explicit and round-trips without changing an old frozen document',()=>{
 const legacy=CareerDocument.parse(old);expect(legacy).toEqual(old);expect(fromEditor(toEditor(legacy),legacy.layout)).toEqual(old);
 for(const alignment of ['left','center','right']){
  const input=structuredClone(old) as any;input.sections[0].blocks[0].alignment=alignment;input.layout.identityNameAlignment=alignment;
  const document=CareerDocument.parse(input);expect(fromEditor(toEditor(document),document.layout)).toEqual(input);
 }
 const bad=structuredClone(old) as any;bad.sections[0].blocks[0].alignment='arbitrary-css';expect(CareerDocument.safeParse(bad).success).toBe(false);
 const bullet=CareerDocument.parse({...old,sections:[{...old.sections[0],blocks:[{id:'00000000-0000-4000-8000-000000000003',type:'bullet-list',items:[{id:'00000000-0000-4000-8000-000000000004',paragraphId:'00000000-0000-4000-8000-000000000005',alignment:'right',spans:[{text:'列表',marks:[{type:'italic'}]}]}]}]}]});
 expect(fromEditor(toEditor(bullet),bullet.layout)).toEqual(bullet);
 const centered=CareerDocument.parse({...old,layout:{...old.layout,identityNameAlignment:'center'}});const undone=toEditor(centered);undone.attrs!.careerIdentityNameAlignment=null;
 expect(fromEditor(undone,centered.layout)).toEqual(old);
 const frozen={id:old.sections[0].id,resumeId:old.sections[0].id,opportunityId:old.sections[0].id,resumeRevision:1,profileRevision:0,content:old,profile:{revision:0,name:'TEST',contact:'',links:[]},contentHash:'a'.repeat(64),templateVersion:'a4-basic-1',fontVersion:'test',engineVersion:'test',rendererVersion:'career-print-1',recordedAt:'2026-10-04T00:00:00.000Z'};
 expect(Snapshot.parse(frozen)).toEqual(frozen);
 expect(renderSnapshot(frozen)).toContain("font-family:Arial,'PingFang SC','Hiragino Sans GB',sans-serif");
});
it('PDF uses Career paragraph, bullet and identity alignment rather than editor CSS',()=>{
 const content=CareerDocument.parse({...old,sections:[{...old.sections[0],blocks:[{...old.sections[0].blocks[0],alignment:'center'},{id:'00000000-0000-4000-8000-000000000003',type:'bullet-list',items:[{id:'00000000-0000-4000-8000-000000000004',paragraphId:'00000000-0000-4000-8000-000000000005',alignment:'right',spans:[{text:'列表中文',marks:[]}]}]}]}],layout:{...old.layout,identityNameAlignment:'center'}});
 const html=renderSnapshot({id:old.sections[0].id,resumeId:old.sections[0].id,opportunityId:old.sections[0].id,resumeRevision:1,profileRevision:0,content,profile:{revision:0,name:'TEST NAME',contact:'',links:[]},contentHash:'a'.repeat(64),templateVersion:'a4-basic-1',fontVersion:'test',engineVersion:'test',rendererVersion:'career-print-2',recordedAt:'2026-10-04T00:00:00.000Z'});
 expect(html).toContain('<h1 style="text-align:center">');expect(html).toContain('<p style="text-align:center">');expect(html).toContain('<li style="text-align:right">');
 expect(html).toContain("font-family:Arial,'Arial Unicode MS','Hiragino Sans GB','PingFang SC',sans-serif");
});

import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {sourcePaperFixture} from './fixtures/source-resume';
import {CareerDocument,Snapshot} from '../packages/contracts/resume/schema';
import {toEditor,fromEditor} from '../packages/frontend/features/resume/adapter';
import {renderSnapshot} from '../packages/backend/domains/resume/render';


it('the active source paper preserves project title / responsibility / date slots and never prints empty editing hints',()=>{
 const document=CareerDocument.parse(sourcePaperFixture());expect(fromEditor(toEditor(document),document.layout)).toEqual(document);
 const snapshot=Snapshot.parse({id:randomUUID(),resumeId:randomUUID(),opportunityId:randomUUID(),resumeRevision:1,profileRevision:0,profile:{revision:0,name:'TEST Name',contact:'TEST Contact',links:[{label:'TEST Link',href:'https://example.com/'}]},content:document,contentHash:'a'.repeat(64),templateVersion:'miaoda-paper-1',rendererVersion:'career-print-2',fontVersion:'test',engineVersion:'test',recordedAt:new Date().toISOString()});
 const html=renderSnapshot(snapshot);expect(html.indexOf('专业技能')).toBeLessThan(html.indexOf('项目经历'));expect(html).toContain('source-entry-row');expect(html).toContain('data-field="responsibility"');expect(html).toContain('data-field="date"');expect(html).not.toContain('项目职责');expect(html).not.toContain('起止时间');expect(html).not.toContain('undefined');expect(html).not.toContain('\uFFFD');expect(html).toContain('<em>TEST 负责交付</em>');expect(html).toContain('https://example.com/');
 const project=document.sections[1];project.blocks[1]={...project.blocks[1],spans:[{text:'TEST 项目负责人',marks:[]}]} as any;project.blocks[2]={...project.blocks[2],spans:[{text:'2024.01 - 2025.06',marks:[]}]} as any;
 const filled=renderSnapshot({...snapshot,content:document});expect(filled).toContain('TEST 项目负责人');expect(filled).toContain('2024.01 - 2025.06');expect(filled.indexOf('TEST 项目</')).toBeLessThan(filled.indexOf('TEST 项目负责人'));
});

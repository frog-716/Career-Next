import { it,expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { CareerShell,resolveRoute } from '../packages/frontend/shell';
it('a direct Resume route belongs to Opportunity without adding a top-level entry',()=>{
 const id='73f3667b-b4d9-4bca-a14b-ac4623ebf7d9';
 expect(resolveRoute('/opportunity/'+id+'/resume')).toEqual({module:'opportunity',view:'resume',opportunityId:id});
 expect(resolveRoute('/unknown/object')).toEqual({view:'not-found'});
 const pages={wiki:createElement('input',{defaultValue:'draft Wiki'}),employment:'任职业务',project:'项目业务',opportunity:'机会业务'};
 const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/opportunity/'+id+'/resume']},createElement(CareerShell,{pages,resume:createElement('div',null,'当前简历正文')})));
 const nav=html.slice(html.indexOf('<nav'),html.indexOf('</nav>'));
 expect(nav).toContain('aria-current="page"');expect(nav).not.toContain('Resume');expect(nav).not.toContain('简历');
 expect(html).toContain('当前简历正文');expect(html).toContain('draft Wiki');
 expect(html).toContain('hidden=""');
});
it('keeps named compact navigation and auxiliary actions while moving pin/reorder controls out of the sidebar',()=>{
 const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/project']},createElement(CareerShell,{pages:{wiki:'W',opportunity:'O',project:'P',employment:'E'},auxiliary:createElement('button',null,'帮助')})));
 const nav=html.slice(html.indexOf('<nav'),html.indexOf('</nav>'));
 expect(nav).toContain('帮助');expect(nav).toContain('辅助入口');
 expect(nav).not.toContain('置顶');expect(nav).not.toContain('上移');
 expect(['Wiki','机会','项目','任职'].every(label=>nav.includes(label))).toBe(true);
 expect(nav).toContain('aria-current="page"');
});
it('an unsupported object link is visible instead of silently becoming the homepage',()=>{
 const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/wiki/missing-object']},createElement(CareerShell,{pages:{wiki:'Wiki业务',employment:'E',project:'P',opportunity:'O'}})));
 expect(html).toContain('链接暂不可访问');
 expect(resolveRoute('/')).toEqual({module:'wiki',view:'module'});
});
it('six-section links retain the Opportunity owner and reject unsupported sections',()=>{
 const id='73f3667b-b4d9-4bca-a14b-ac4623ebf7d9';
 for(const section of ['overview','research','communication','interview','offer'])expect(resolveRoute('/opportunity/'+id+'/'+section)).toEqual({module:'opportunity',view:'opportunity-detail',opportunityId:id,section});
 expect(resolveRoute('/opportunity/'+id+'/invalid')).toEqual({view:'not-found'});
 expect(resolveRoute('/opportunity/not-an-id/research')).toEqual({view:'not-found'});
 const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/opportunity/'+id+'/research']},createElement(CareerShell,{pages:{wiki:'W',opportunity:'Target opportunity research',project:'P',employment:'E'}})));
 expect(html).toContain('Target opportunity research');expect(html).toContain('aria-current="page"');
});

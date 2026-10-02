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
it('an unsupported object link is visible instead of silently becoming the homepage',()=>{
 const html=renderToStaticMarkup(createElement(MemoryRouter,{initialEntries:['/wiki/missing-object']},createElement(CareerShell,{pages:{wiki:'Wiki业务',employment:'E',project:'P',opportunity:'O'}})));
 expect(html).toContain('链接暂不可访问');
 expect(resolveRoute('/')).toEqual({module:'wiki',view:'module'});
});

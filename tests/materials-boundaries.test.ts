import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Request, SourceRef } from '../packages/contracts/materials/schema';
function sources(root: string): string[] { return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sources(path.join(root,e.name)):/\.[cm]?[jt]sx?$/.test(e.name)?[path.join(root,e.name)]:[]); }
it('renderer contract cannot choose arbitrary paths, actor, SQL or another source owner', () => {
  for (const input of [{operation:'select',path:'/etc/passwd'},{operation:'list',actor:'human'},{operation:'execute',sql:'INSERT INTO materials_raw'},{operation:'read',materialId:crypto.randomUUID(),workspaceInstance:crypto.randomUUID()}]) expect(Request.safeParse(input).success).toBe(false);
  expect(SourceRef.safeParse({owner:'wiki',objectId:crypto.randomUUID(),revision:1,scope:'personal',locator:'whole'}).success).toBe(false);
});
it('all formal frontend sources exclude Node/database/backend imports; Materials owns table writes', () => {
  for(const file of sources('packages/frontend').filter(p=>!p.includes('/probe/'))) {
    const text=readFileSync(file,'utf8'); expect(text,file).not.toMatch(/from\s+['"](?:node:|.*backend|better-sqlite3)/);
  }
  for(const file of sources('packages/backend').filter(p=>!p.includes('/probe/')&&!p.includes('/domains/materials/'))) {
    const text=readFileSync(file,'utf8'); expect(text,file).not.toMatch(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+materials_/i);
  }
  for(const file of sources('packages/backend/platform')) {
    expect(readFileSync(file,'utf8'),file).not.toMatch(/from\s+['"][^'"]*(?:domains|contracts\/materials)/);
  }

});

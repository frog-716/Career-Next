import { it,expect } from 'vitest';
import { readdirSync,readFileSync } from 'node:fs';
import path from 'node:path';
it('Shell and primitives use supplied views and never own database or business facts',()=>{
 const scan=(root:string):string[]=>readdirSync(root,{withFileTypes:true}).flatMap(item=>item.isDirectory()?scan(path.join(root,item.name)):[path.join(root,item.name)]);
 for(const file of ['packages/frontend/shell','packages/frontend/design-system'].flatMap(scan)){
  expect(readFileSync(file,'utf8'),file).not.toMatch(/from\s+['"](?:node:|.*backend|.*features\/|better-sqlite3)|localStorage|sessionStorage|indexedDB|INSERT INTO|UPDATE .* SET/);
 }
});

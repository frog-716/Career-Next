import {it,expect} from 'vitest';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
async function sources(root:string):Promise<string[]>{const entries=await readdir(root,{withFileTypes:true});return (await Promise.all(entries.map(entry=>entry.isDirectory()?sources(path.join(root,entry.name)):/\.tsx?$/.test(entry.name)?[path.join(root,entry.name)]:[]))).flat();}
for(const owner of ['research','interview','offer'])it('RV-MODULE '+owner+' imports contracts/platform or its own files, never a sibling private owner or opposite side',async()=>{
 for(const side of ['backend','frontend']){
  const root=path.resolve(side==='backend'?'packages/backend/domains/opportunity/'+owner:'packages/frontend/features/opportunity/'+owner);
  for(const filename of await sources(root)){
   const source=await readFile(filename,'utf8');
   for(const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)){const name=match[1];if(!name.startsWith('.')){if(side==='frontend')expect(name).not.toMatch(/^(node:|better-sqlite3)/);continue;}
    const target=path.resolve(path.dirname(filename),name);
    const allowed=target.startsWith(root+path.sep)||target.startsWith(path.resolve('packages/contracts')+path.sep)||(side==='backend'&&target.startsWith(path.resolve('packages/backend/platform')+path.sep));
    expect(allowed,filename+' imports '+name).toBe(true);
   }
  }
 }
});

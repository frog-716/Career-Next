import { access, readdir } from 'node:fs/promises';

/** Only finds owner-maintained fragments. It does not infer domain rules. */
export async function findFragments(root: URL, filename: string): Promise<{path:string;url:URL}[]> {
  const found: {path:string;url:URL}[]=[];
  async function visit(directory: URL, prefix: string) {
    const candidate=new URL(filename,directory);
    try {await access(candidate);found.push({path:prefix+filename,url:candidate});}
    catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='ENOENT'))throw error;}
    const entries=await readdir(directory,{withFileTypes:true});
    for(const entry of entries.filter(entry=>entry.isDirectory()&&entry.name!=='generated').sort((a,b)=>a.name.localeCompare(b.name))) {
      await visit(new URL(entry.name+'/',directory),prefix+entry.name+'/');
    }
  }
  await visit(root,'');
  return found.sort((a,b)=>a.path.localeCompare(b.path));
}

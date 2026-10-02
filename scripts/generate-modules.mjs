import { readdir,writeFile,mkdir,access } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const entries=await readdir(new URL('packages/contracts/',root),{withFileTypes:true});
const names=[];
for(const item of entries.filter(item=>item.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
 const url=new URL(`packages/contracts/${item.name}/manifest.ts`,root);try{await access(url);}catch(error){if(error.code==='ENOENT')continue;throw error;}
 {const exported=await import(url);const manifest=exported[`${item.name}Manifest`];if(!manifest||manifest.module!==item.name||new Set(manifest.operations).size!==manifest.operations.length)throw Error('invalid_module_manifest');names.push(item.name);}
}

const generated=new URL('packages/contracts/generated/',root);await mkdir(generated,{recursive:true});
const business=names.filter(name=>name!=='materials');
await writeFile(new URL('registry.ts',generated),names.map(name=>`import { ${name}Manifest } from '../${name}/manifest.ts';`).join('\n')+`\nexport const allManifests=[${names.map(name=>name+'Manifest').join(',')}];\nexport const moduleNames=${JSON.stringify(business)} as const;\nexport type BusinessModule=typeof moduleNames[number];\n`);
const backend=new URL('packages/backend/bootstrap/generated/',root);await mkdir(backend,{recursive:true});
await writeFile(new URL('routing.ts',backend),`import type { BusinessModule } from '../../../contracts/generated/registry';\nimport {parseBusinessRequest,parseBusinessResult} from '../../../contracts/registry';\nexport function registerDomains(owners:Record<BusinessModule,{handle(input:unknown):unknown}>){return (module:BusinessModule,input:unknown)=>parseBusinessResult(module,owners[module].handle(parseBusinessRequest(module,input)));}\n`);
const featureRoot=new URL('packages/frontend/features/',root),routes=[];
for(const item of (await readdir(featureRoot,{withFileTypes:true})).filter(item=>item.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
 const url=new URL(`${item.name}/routes.ts`,featureRoot);try{await access(url);}catch(error){if(error.code==='ENOENT')continue;throw error;}
 {const module=await import(url);for(const route of module.routes){if(routes.some(old=>old.path===route.path))throw Error('duplicate_route');routes.push(route);}}
}

const frontend=new URL('packages/frontend/generated/',root);await mkdir(frontend,{recursive:true});await writeFile(new URL('routes.ts',frontend),`export const routeCatalog=${JSON.stringify(routes,null,2)} as const;\n`);

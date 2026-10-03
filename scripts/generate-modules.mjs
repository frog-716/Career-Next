import { writeFile,mkdir } from 'node:fs/promises';
import { findFragments } from './module-fragments.mts';
const root=new URL('../',import.meta.url);
const fragments=[];
for(const fragment of await findFragments(new URL('packages/contracts/',root),'manifest.ts')){
 const name=fragment.path.split('/').at(-2);
 const exported=await import(fragment.url);const manifest=exported[`${name}Manifest`];
 if(!manifest||manifest.module!==name||!manifest.schemas?.request||!manifest.schemas?.result||new Set(manifest.operations).size!==manifest.operations.length||fragments.some(item=>item.name===name))throw Error('invalid_module_manifest');
 fragments.push({name,path:fragment.path});
}
const names=fragments.map(item=>item.name);

const generated=new URL('packages/contracts/generated/',root);await mkdir(generated,{recursive:true});
const business=names.filter(name=>name!=='materials');
await writeFile(new URL('registry.ts',generated),fragments.map(item=>`import { ${item.name}Manifest } from '../${item.path}';`).join('\n')+`\nexport const allManifests=[${names.map(name=>name+'Manifest').join(',')}];\nexport const moduleNames=${JSON.stringify(business)} as const;\nexport type BusinessModule=typeof moduleNames[number];\n`);
const backend=new URL('packages/backend/bootstrap/generated/',root);await mkdir(backend,{recursive:true});
await writeFile(new URL('routing.ts',backend),`import type { BusinessModule } from '../../../contracts/generated/registry';\nimport {parseBusinessRequest,parseBusinessResult} from '../../../contracts/registry';\nexport function registerDomains(owners:Record<BusinessModule,{handle(input:unknown):unknown}>){return async(module:BusinessModule,input:unknown)=>parseBusinessResult(module,await owners[module].handle(parseBusinessRequest(module,input)));}\n`);
const featureRoot=new URL('packages/frontend/features/',root),routes=[];
for(const fragment of await findFragments(featureRoot,'routes.ts')){
 const module=await import(fragment.url);for(const route of module.routes){if(routes.some(old=>old.path===route.path))throw Error('duplicate_route');routes.push(route);}
}

const frontend=new URL('packages/frontend/generated/',root);await mkdir(frontend,{recursive:true});await writeFile(new URL('routes.ts',frontend),`export const routeCatalog=${JSON.stringify(routes,null,2)} as const;\n`);

export const navigationManifest=[
 {id:'wiki',path:'/wiki',label:'Wiki',icon:'◇'},
 {id:'opportunity',path:'/opportunity',label:'机会',icon:'◉'},
 {id:'project',path:'/project',label:'项目',icon:'▤'},
 {id:'employment',path:'/employment',label:'任职',icon:'▥'},
] as const;
export type NavigationId=typeof navigationManifest[number]['id'];
export type Route={view:'module';module:NavigationId}|{view:'resume';module:'opportunity';opportunityId:string}|{view:'not-found'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function resumePath(opportunityId:string){if(!uuid.test(opportunityId))throw Error('invalid_route');return `/opportunity/${opportunityId}/resume`;}
export function resolveRoute(path:string):Route{
 if(path==='/')return {module:'wiki',view:'module'};
 const module=navigationManifest.find(item=>item.path===path);
 if(module)return {module:module.id,view:'module'};
 const nested=/^\/opportunity\/([^/]+)\/resume$/.exec(path);
 if(nested&&uuid.test(nested[1]))return {module:'opportunity',view:'resume',opportunityId:nested[1]};
 return {view:'not-found'};
}

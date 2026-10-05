export const opportunitySections=['overview','resume','research','communication','interview','offer'] as const;
export type OpportunitySection=typeof opportunitySections[number];
import { matchPath } from 'react-router';
import {routeCatalog} from '../generated/routes';
export const navigationManifest=[
 {id:'wiki',path:'/wiki',label:'Wiki',icon:'◇'},
 {id:'opportunity',path:'/opportunity',label:'机会',icon:'◉'},
 {id:'project',path:'/project',label:'项目',icon:'▤'},
 {id:'employment',path:'/employment',label:'任职',icon:'▥'},
] as const;
export type NavigationId=typeof navigationManifest[number]['id'];
export type Route={view:'module';module:NavigationId}|{view:'resume';module:'opportunity';opportunityId:string}|{view:'opportunity-detail';module:'opportunity';opportunityId:string;section:OpportunitySection}|{view:'not-found'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function resumePath(opportunityId:string){if(!uuid.test(opportunityId))throw Error('invalid_route');return `/opportunity/${opportunityId}/resume`;}
export function opportunityPath(id:string,section:OpportunitySection='overview'){if(!uuid.test(id))throw Error('invalid_route');return `/opportunity/${id}/${section}`;}
export function resolveRoute(path:string):Route{
 if(path==='/')return {module:'wiki',view:'module'};
 for(const entry of routeCatalog){
  const match=matchPath(entry.path,path);if(!match)continue;
  if(entry.view==='opportunity-detail'){const id=match.params.opportunityId,next=match.params.section;if(id&&uuid.test(id)&&opportunitySections.some(section=>section===next))return next==='resume'?{module:'opportunity',view:'resume',opportunityId:id}:{module:'opportunity',view:'opportunity-detail',opportunityId:id,section:next as OpportunitySection};continue;}
  if(entry.view==='resume'){const id=match.params.opportunityId;if(id&&uuid.test(id))return {module:'opportunity',view:'resume',opportunityId:id};}
  else return {module:entry.view,view:'module'};
 }
 return {view:'not-found'};
}

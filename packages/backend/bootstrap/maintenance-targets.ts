import type {composeDomains} from './domain-registry';
import type {Store} from '../domains/materials/store';
import type {HumanSession} from '../platform/runtime/sessions';
export async function maintenanceTargets(d:ReturnType<typeof composeDomains>,materials:Store,session?:HumanSession){
 if(!session)throw Error('invalid_capability');const targets:{owner:string;objectId:string;label:string}[]=[];
 const add=(owner:string,objectId:string,label:string)=>{if(!targets.some(t=>t.owner===owner&&t.objectId===objectId))targets.push({owner,objectId,label:(owner+' · '+label).slice(0,255)});};
 for(const item of materials.pendingImports())add('import',item.id,'进行中的导入 '+item.name);
 for(const item of await materials.list(session))add('materials',item.id,item.name);
 for(const file of d.files.list())add('actual-artifact',file.id,file.name);
 for(const item of d.wiki.maintenanceObjects())add('wiki',item.id,item.title);
 const projects=d.project.handle({operation:'list'});if(projects.kind==='list')for(const p of projects.projects)add('project',p.id,p.name);
 const employments=d.employment.handle({operation:'list'});if(employments.kind==='list')for(const e of employments.employments){add('employment',e.id,e.company);const details=d.employment.handle({operation:'read',id:e.id});if(details.kind==='employment')for(const person of details.people)add('person',person.id,person.name);}
 for(const c of d.opportunity.maintenanceCompanies())add('company',c.id,c.name);
 for(const o of d.opportunity.maintenanceObjects()){add('opportunity',o.id,o.role);
 const sub=d.submission.handle({operation:'submission.read',opportunityId:o.id});if(sub.kind==='submission')add('submission',sub.submission.id,o.role+' 首次投递');
 const comm=d.communication.handle({operation:'communication.list',opportunityId:o.id});if(comm.kind==='list')for(const c of comm.items)add('communication',c.id,o.role+' 沟通');
 const rounds=d.interview.handle({operation:'interview.list',opportunityId:o.id});if(rounds.kind==='sessions')for(const r of rounds.items)add('interview',r.id,r.title);
 const offer=d.offer.handle({operation:'offer.read',opportunityId:o.id});if(offer.kind==='offer')add('offer',offer.offer.id,o.role+' Offer');
 const resume=d.resume.handle({operation:'resume.lookup',opportunityId:o.id});if(resume.status==='document')add('resume',resume.document.id,o.role+' 当前简历及历史');
 for(const item of d.wiki.maintenanceObjects('opportunity',o.id))add('wiki',item.id,item.title);
 for(const owner of [{kind:'opportunity' as const,id:o.id},{kind:'company' as const,id:o.companyId}]){const research=d.research.handle({operation:'read',owner});if(research.kind==='document')for(const item of research.items)add('research',item.item.id,item.item.title);}
 }
 add('profile','current','当前本人身份');return targets;
}
/** Object-owned scopes expand through public interfaces; shared facts stay independent. */
export function ownedRelatedReferences(d:ReturnType<typeof composeDomains>,ref:{owner:string;objectId:string}){
 const refs:{owner:string;objectId:string}[]=[];const add=(owner:string,objectId:string)=>refs.push({owner,objectId});
 if(['project','employment','person','opportunity'].includes(ref.owner)){for(const item of d.wiki.maintenanceObjects(ref.owner as import('../../contracts/wiki/schema').Knowledge['scope'],ref.objectId))add('wiki',item.id);}
 if(ref.owner==='company'||ref.owner==='opportunity'){const result=d.research.handle({operation:'read',owner:{kind:ref.owner,id:ref.objectId}});if(result.kind==='document')for(const item of result.items)add('research',item.item.id);}
 if(ref.owner==='employment'){const details=d.employment.handle({operation:'read',id:ref.objectId});if(details.kind==='employment')for(const person of details.people)add('person',person.id);}
 if(ref.owner==='opportunity'){
 const sub=d.submission.handle({operation:'submission.read',opportunityId:ref.objectId});if(sub.kind==='submission')add('submission',sub.submission.id);
 const comm=d.communication.handle({operation:'communication.list',opportunityId:ref.objectId});if(comm.kind==='list')for(const item of comm.items)add('communication',item.id);
 const rounds=d.interview.handle({operation:'interview.list',opportunityId:ref.objectId});if(rounds.kind==='sessions')for(const round of rounds.items)add('interview',round.id);
 const offer=d.offer.handle({operation:'offer.read',opportunityId:ref.objectId});if(offer.kind==='offer')add('offer',offer.offer.id);
 const resume=d.resume.handle({operation:'resume.lookup',opportunityId:ref.objectId});if(resume.status==='document')add('resume',resume.document.id);
 }
 return refs;
}

export function retainedProfileHistory(d:ReturnType<typeof composeDomains>){const refs:string[]=[];for(const opportunity of d.opportunity.maintenanceObjects()){
 const versions=d.resume.handle({operation:'resume.candidates',opportunityId:opportunity.id});if(versions.status==='versions')for(const version of versions.versions)refs.push('resume/'+version.id+' 保留独立冻结身份与PDF');
 const first=d.submission.handle({operation:'submission.read',opportunityId:opportunity.id});if(first.kind==='submission'&&first.submission.resume.kind==='retained'&&first.submission.resume.snapshot)refs.push('submission/'+first.submission.id+' 保留实际发送时的身份');
 const communications=d.communication.handle({operation:'communication.list',opportunityId:opportunity.id});if(communications.kind==='list')for(const value of communications.items)if(value.sentMaterial?.kind==='retained'&&value.sentMaterial.snapshot)refs.push('communication/'+value.id+' 保留实际发送时的身份');
}return refs;}

import type {SourceRef} from '../../contracts/common/source-ref';
import {Result as MaterialsResult} from '../../contracts/materials/schema';
import {Result as OpportunityResult} from '../../contracts/opportunity/schema';
import {Result as InterviewResult} from '../../contracts/opportunity/interview/schema';
import {Result as CommunicationResult} from '../../contracts/opportunity/communication/schema';
export async function sourceCatalogue(opportunityId?:string){
 const raw=MaterialsResult.parse(await window.careerMaterials.request({operation:'list'}));
 const choices=raw.kind==='list'?raw.items.map(item=>({id:item.id,name:item.name,source:item.source as SourceRef})):[];
 const list=OpportunityResult.parse(await window.career.request('opportunity',{operation:'list'}));
 if(list.kind!=='opportunities')throw Error('source_list_unavailable');
 for(const opportunity of list.items.filter(item=>!opportunityId||item.id===opportunityId)){
  const rounds=InterviewResult.parse(await window.career.request('interview',{operation:'interview.list',opportunityId:opportunity.id}));
  if(rounds.kind!=='sessions')throw Error('source_list_unavailable');
  for(const round of rounds.items)if(round.transcript)choices.push({id:round.id,name:opportunity.role+' · '+round.title+'文字稿',source:{owner:'interview',objectId:round.id,revision:round.transcript.version,locator:'transcript',scope:'opportunity',opportunityId:opportunity.id}});
  const communication=CommunicationResult.parse(await window.career.request('communication',{operation:'communication.list',opportunityId:opportunity.id}));
  if(communication.kind!=='list')throw Error('source_list_unavailable');
  for(const item of communication.items)choices.push({id:item.id,name:opportunity.role+' · 沟通文字 v'+item.source.revision,source:item.source});
 }
 return choices;
}
export async function readSourceVersion(ref:SourceRef){
 if(ref.owner==='materials'){const result=MaterialsResult.parse(await window.careerMaterials.request({operation:'read',materialId:ref.objectId}));return result.kind==='raw'&&JSON.stringify(result.raw.source)===JSON.stringify(ref)?result.raw.text:undefined;}
 if(ref.owner==='interview'){const result=InterviewResult.parse(await window.career.request('interview',{operation:'interview.read',id:ref.objectId}));return result.kind==='session'&&result.session.opportunityId===ref.opportunityId&&result.session.transcript?.version===ref.revision?result.session.transcript.text:undefined;}
 const result=CommunicationResult.parse(await window.career.request('communication',{operation:'communication.read',id:ref.objectId}));return result.kind==='communication'&&JSON.stringify(result.communication.source)===JSON.stringify(ref)?result.communication.text:undefined;
}

export async function scopeCatalogue(){const {Result}=await import('../../contracts/application/schema');const result=Result.parse(await window.career.request('application',{operation:'data.targets'}));if(result.kind!=='data_targets')throw Error('scope_list_unavailable');return result.targets.filter(item=>['project','employment','person','opportunity'].includes(item.owner)).map(item=>({scope:item.owner as 'project'|'employment'|'person'|'opportunity',scopeId:item.objectId,label:item.label}));}

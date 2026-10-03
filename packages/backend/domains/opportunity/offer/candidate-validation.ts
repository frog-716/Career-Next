import type Database from 'better-sqlite3';
import {Offer,Event,AcceptanceBasis} from '../../../../contracts/opportunity/offer/schema';
import type {SourceRef} from '../../../../contracts/common/source-ref';
export function validateCandidate(db:Database.Database):void {
 const offers=new Map<string,Offer>();const conditions=new Map<string,Set<string>>();const bases=new Map<string,AcceptanceBasis>();const events:Event[]=[];
 for(const row of db.prepare('SELECT id,opportunity_id,revision,body_json FROM opportunity_offer').all() as {id:string;opportunity_id:string;revision:number;body_json:string}[]){const value=Offer.parse(JSON.parse(row.body_json));if(value.id!==row.id||value.opportunityId!==row.opportunity_id||value.revision!==row.revision)throw Error('invalid_candidate');offers.set(value.id,value);conditions.set(value.id,new Set([value.conditionsId]));}
 for(const row of db.prepare('SELECT id,offer_id,event_json FROM opportunity_offer_history').all() as {id:string;offer_id:string;event_json:string}[]){const value=Event.parse(JSON.parse(row.event_json));const current=offers.get(value.offerId);if(value.id!==row.id||value.offerId!==row.offer_id||!current||value.opportunityId!==current.opportunityId)throw Error('invalid_candidate');if(['received','conditions_replaced','conditions_corrected'].includes(value.type)){if(!value.conditions||!value.original)throw Error('invalid_candidate');conditions.get(value.offerId)!.add(value.conditionsId);}events.push(value);}
 for(const row of db.prepare('SELECT id,offer_id,basis_json FROM opportunity_offer_acceptance').all() as {id:string;offer_id:string;basis_json:string}[]){const value=AcceptanceBasis.parse(JSON.parse(row.basis_json));const current=offers.get(value.offerId);if(value.id!==row.id||value.offerId!==row.offer_id||!current||value.opportunityId!==current.opportunityId||!conditions.get(value.offerId)?.has(value.conditionsId))throw Error('invalid_candidate');bases.set(value.id,value);}
 for(const event of events)if(!conditions.get(event.offerId)?.has(event.conditionsId))throw Error('invalid_candidate');
 for(const event of events)if(event.basisId&&bases.get(event.basisId)?.offerId!==event.offerId)throw Error('invalid_candidate');
}
export function candidateRelations(db:Database.Database):{owner:string;objectId:string;kind:'object'|'source';source?:SourceRef}[]{
 const relations:{owner:string;objectId:string;kind:'object'|'source';source?:SourceRef}[]=[];
 const append=(value:{opportunityId:string;original?:Offer['original']})=>{relations.push({owner:'opportunity',objectId:value.opportunityId,kind:'object'});if(value.original?.kind==='retained')relations.push({owner:value.original.source.owner,objectId:value.original.source.objectId,kind:'source',source:value.original.source});};
 for(const row of db.prepare('SELECT body_json FROM opportunity_offer').all() as {body_json:string}[])append(Offer.parse(JSON.parse(row.body_json)));
 for(const row of db.prepare('SELECT event_json FROM opportunity_offer_history').all() as {event_json:string}[])append(Event.parse(JSON.parse(row.event_json)));
 for(const row of db.prepare('SELECT basis_json FROM opportunity_offer_acceptance').all() as {basis_json:string}[])append(AcceptanceBasis.parse(JSON.parse(row.basis_json)));
 return relations;
}

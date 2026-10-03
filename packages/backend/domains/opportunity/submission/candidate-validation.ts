import type Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {Submission} from '../../../../contracts/opportunity/submission/schema';
export function validateCandidate(db:Database.Database):void {
 const items=new Map<string,Submission>();const opportunities=new Set<string>();
 for(const row of db.prepare('SELECT id,opportunity_id,body_json FROM opportunity_submission').all() as {id:string;opportunity_id:string;body_json:string}[]){const value=Submission.parse(JSON.parse(row.body_json));if(value.id!==row.id||value.opportunityId!==row.opportunity_id||items.has(value.id)||opportunities.has(value.opportunityId))throw Error('invalid_candidate');if(value.resume.kind==='retained'){const material=value.resume,snapshot=material.snapshot;if(material.candidate.kind==='resume'){if(!snapshot||snapshot.id!==material.candidate.id||snapshot.profileRevision!==snapshot.profile.revision||createHash('sha256').update(JSON.stringify({content:snapshot.content,profile:snapshot.profile,...snapshot.blockProvenance?{blockProvenance:snapshot.blockProvenance}:{}})).digest('hex')!==snapshot.contentHash)throw Error('invalid_candidate');}else if(snapshot)throw Error('invalid_candidate');}items.set(value.id,value);opportunities.add(value.opportunityId);}
 const tombstones=new Set<string>();
 for(const row of db.prepare('SELECT id,opportunity_id FROM opportunity_submission_purged').all() as {id:string;opportunity_id:string}[]){z.uuid().parse(row.id);z.uuid().parse(row.opportunity_id);if(items.has(row.id)||opportunities.has(row.opportunity_id)||tombstones.has(row.id))throw Error('invalid_candidate');tombstones.add(row.id);opportunities.add(row.opportunity_id);}
 for(const row of db.prepare('SELECT command_id,submission_id FROM opportunity_submission_commands').all() as {command_id:string;submission_id:string}[]){z.uuid().parse(row.command_id);z.uuid().parse(row.submission_id);if(!items.has(row.submission_id))throw Error('invalid_candidate');}
}
export function candidateRelations(db:Database.Database):{owner:string;objectId:string;kind:'object'|'source'}[]{
 const relations:{owner:string;objectId:string;kind:'object'|'source';provenance?:import('../../../../contracts/common/provenance').Provenance}[]=[];
 for(const row of db.prepare('SELECT body_json FROM opportunity_submission').all() as {body_json:string}[]){const value=Submission.parse(JSON.parse(row.body_json));relations.push({owner:'opportunity',objectId:value.opportunityId,kind:'object'});if(value.resume.kind==='retained'&&value.resume.snapshot){relations.push({owner:'resume',objectId:value.resume.snapshot.resumeId,kind:'object'},{owner:'opportunity',objectId:value.resume.snapshot.opportunityId,kind:'object'});for(const block of value.resume.snapshot.blockProvenance??[])for(const provenance of block.provenance)relations.push({owner:provenance.owner,objectId:provenance.objectId,kind:'object',provenance});}}
 for(const row of db.prepare('SELECT opportunity_id FROM opportunity_submission_purged').all() as {opportunity_id:string}[])relations.push({owner:'opportunity',objectId:row.opportunity_id,kind:'object'});
 return relations;
}

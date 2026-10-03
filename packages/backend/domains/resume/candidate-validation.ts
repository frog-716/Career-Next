import type Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
import {Document,Snapshot,Version,NameVersion,Export} from '../../../contracts/resume/schema';
function validateSnapshot(value:Snapshot){if(value.profileRevision!==value.profile.revision||createHash('sha256').update(JSON.stringify({content:value.content,profile:value.profile})).digest('hex')!==value.contentHash)throw Error('invalid_candidate');}
export function validateCandidate(db:Database.Database):void {
 const documents=new Map<string,zDocument>();
 for(const row of db.prepare('SELECT id,opportunity_id,revision,content,recorded_at FROM resume_documents').all() as {id:string;opportunity_id:string;revision:number;content:string;recorded_at:string}[]){const value=Document.parse({id:row.id,opportunityId:row.opportunity_id,revision:row.revision,content:JSON.parse(row.content),recordedAt:row.recorded_at});documents.set(value.id,value);}
 for(const row of db.prepare('SELECT command_id,payload_json,snapshot_json,name FROM resume_render_jobs').all() as {command_id:string;payload_json:string;snapshot_json:string;name:string}[]){const request=NameVersion.or(Export).parse(JSON.parse(row.payload_json));const snapshot=Snapshot.parse(JSON.parse(row.snapshot_json));validateSnapshot(snapshot);const document=documents.get(snapshot.resumeId);if(request.commandId!==row.command_id||snapshot.id!==row.command_id||request.resumeId!==snapshot.resumeId||request.expectedRevision!==snapshot.resumeRevision||request.expectedProfileRevision!==snapshot.profileRevision||row.name!==('name'in request?request.name:'')||!document||snapshot.opportunityId!==document.opportunityId||snapshot.resumeRevision>document.revision)throw Error('invalid_candidate');}
 for(const row of db.prepare('SELECT id,resume_id,body FROM resume_versions').all() as {id:string;resume_id:string;body:string}[]){const value=Version.parse(JSON.parse(row.body));validateSnapshot(value.snapshot);const document=documents.get(row.resume_id);if(value.id!==row.id||value.resumeId!==row.resume_id||value.snapshot.id!==value.id||value.snapshot.resumeId!==value.resumeId||!document||value.snapshot.opportunityId!==document.opportunityId||value.snapshot.resumeRevision>document.revision||value.kind==='export'&&value.name!==''||value.kind!=='export'&&!value.name.trim())throw Error('invalid_candidate');}
}
type zDocument=ReturnType<typeof Document.parse>;
/** References only; frozen Profile content is a snapshot, not a live Profile dependency. */
export function candidateRelations(db:Database.Database):{owner:string;objectId:string;kind:'object'|'source'}[]{
 const relations:{owner:string;objectId:string;kind:'object'|'source'}[]=[];
 for(const row of db.prepare('SELECT opportunity_id FROM resume_documents').all() as {opportunity_id:string}[])relations.push({owner:'opportunity',objectId:row.opportunity_id,kind:'object'});
 for(const row of db.prepare('SELECT snapshot_json FROM resume_render_jobs').all() as {snapshot_json:string}[]){const snapshot=Snapshot.parse(JSON.parse(row.snapshot_json));relations.push({owner:'opportunity',objectId:snapshot.opportunityId,kind:'object'});}
 for(const row of db.prepare('SELECT body FROM resume_versions').all() as {body:string}[]){const value=Version.parse(JSON.parse(row.body));relations.push({owner:'opportunity',objectId:value.snapshot.opportunityId,kind:'object'});}
 return relations;
}

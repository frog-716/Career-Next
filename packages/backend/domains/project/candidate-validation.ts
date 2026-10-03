import type Database from 'better-sqlite3';
import {Project,Participation,History} from '../../../contracts/project/schema';
export function validateCandidate(db:Database.Database):void {
 const projects=new Map<string,Project>();
 for(const row of db.prepare('SELECT id,revision,value_json FROM project_current').all() as {id:string;revision:number;value_json:string}[]){const value=Project.parse(JSON.parse(row.value_json));if(value.id!==row.id||value.revision!==row.revision)throw Error('invalid_candidate');projects.set(value.id,value);}
 for(const row of db.prepare('SELECT id,project_id,context_id,person_id,value_json FROM project_participation').all() as {id:string;project_id:string;context_id:string;person_id:string;value_json:string}[]){const value=Participation.parse(JSON.parse(row.value_json));const project=projects.get(value.projectId);if(value.id!==row.id||value.projectId!==row.project_id||value.contextId!==row.context_id||value.personId!==row.person_id||!project||value.active&&(value.contextId!==project.contextId||value.employmentId!==project.employmentId))throw Error('invalid_candidate');}
 for(const row of db.prepare('SELECT project_id,revision,value_json FROM project_history').all() as {project_id:string;revision:number;value_json:string}[]){const value=History.parse(JSON.parse(row.value_json));const current=projects.get(row.project_id);if(!current||value.project.id!==row.project_id||value.revision!==row.revision||value.project.revision!==row.revision||row.revision>current.revision||value.participants.some(item=>item.projectId!==row.project_id))throw Error('invalid_candidate');}
}
export function candidateRelations(db:Database.Database):{owner:string;objectId:string;kind:'object'|'source';optional?:boolean}[]{
 const relations:{owner:string;objectId:string;kind:'object'|'source';optional?:boolean}[]=[];
 for(const row of db.prepare('SELECT value_json FROM project_current').all() as {value_json:string}[]){const project=Project.parse(JSON.parse(row.value_json));if(project.employmentId)relations.push({owner:'employment',objectId:project.employmentId,kind:'object'});}
 for(const row of db.prepare('SELECT value_json FROM project_participation').all() as {value_json:string}[]){const participant=Participation.parse(JSON.parse(row.value_json));for(const [owner,objectId] of [['employment',participant.employmentId],['person',participant.personId]])relations.push({owner,objectId,kind:'object',...(!participant.active?{optional:true}:{})});}
 // Past contexts are readable after their Employment/Person has been cleared.
 for(const row of db.prepare('SELECT value_json FROM project_history').all() as {value_json:string}[]){const history=History.parse(JSON.parse(row.value_json));if(history.project.employmentId)relations.push({owner:'employment',objectId:history.project.employmentId,kind:'object',optional:true});for(const participant of history.participants)for(const [owner,objectId] of [['employment',participant.employmentId],['person',participant.personId]])relations.push({owner,objectId,kind:'object',optional:true});}
 return relations;
}

import type Database from 'better-sqlite3';
import {LegacyProposalHistory,LegacyHistoryRequest,LegacyHistoryResult,type HistoryReference} from '../../../contracts/ai/legacy-history/schema';
export {legacyHistoryMigration} from './migration';
export function historyReferences(item:Pick<LegacyProposalHistory,'target'|'content'>):HistoryReference[]{
 return [...item.target.ownerReference?[item.target.ownerReference]:[],...item.content.availability==='available'?item.content.basis.sources.flatMap(s=>s.ownerReference?[s.ownerReference]:[]):[]];
}
function exists(db:Database.Database){return !!db.prepare("SELECT 1 FROM sqlite_schema WHERE name='ai_legacy_history'").get();}
function rows(db:Database.Database){if(!exists(db))return [];return (db.prepare('SELECT body_json FROM ai_legacy_history ORDER BY id').all() as {body_json:string}[]).map(r=>LegacyProposalHistory.parse(JSON.parse(r.body_json)));}
export function createLegacyHistory(db:Database.Database,resolve:(ref:HistoryReference)=>boolean){
 function project(item:LegacyProposalHistory):LegacyProposalHistory {const ref=item.target.ownerReference;return ref?{...item,target:{...item.target,resolution:resolve(ref)?'resolved':'unresolved'}}:item;}
 function purge(id:string){const row=db.prepare('SELECT body_json FROM ai_legacy_history WHERE id=?').get(id) as {body_json:string}|undefined;if(!row)return;const item=LegacyProposalHistory.parse(JSON.parse(row.body_json));db.prepare('UPDATE ai_legacy_history SET body_json=? WHERE id=?').run(JSON.stringify({...item,content:{availability:'purged'}}),id);}
 return {
  handle(input:unknown){const parsed=LegacyHistoryRequest.safeParse(input);if(!parsed.success)return {kind:'failure' as const,code:'invalid_request'};const request=parsed.data;
   if(request.operation==='legacy-history.read'){const row=db.prepare('SELECT body_json FROM ai_legacy_history WHERE id=?').get(request.id) as {body_json:string}|undefined;return row?LegacyHistoryResult.parse({kind:'legacy_history',item:project(LegacyProposalHistory.parse(JSON.parse(row.body_json)))}):{kind:'failure' as const,code:'not_found'};}
   const selected=(db.prepare('SELECT body_json FROM ai_legacy_history WHERE id>? ORDER BY id LIMIT 101').all(request.afterId??'') as {body_json:string}[]).map(r=>LegacyProposalHistory.parse(JSON.parse(r.body_json)));
   return LegacyHistoryResult.parse({kind:'legacy_history_list',items:selected.slice(0,100).map(project),...selected.length>100?{nextAfterId:selected[99]!.id}:{}});
  },
  maintenanceObjects:()=>rows(db).filter(i=>i.content.availability==='available').map(i=>({id:i.id,title:i.content.availability==='available'?i.content.proposal.title:'',kind:i.kind})),
  purgeImpact(id:string){const item=rows(db).find(i=>i.id===id&&i.content.availability==='available');return item?{id,name:item.content.availability==='available'?item.content.proposal.title:'',blobIds:[]}:undefined;},
  purge,
  purgeReferenced(refs:readonly {owner:string;objectId:string}[]){for(const item of rows(db))if(historyReferences(item).some(a=>refs.some(b=>a.owner===b.owner&&a.objectId===b.objectId)))purge(item.id);},
 };
}
export function validateLegacyHistoryCandidate(db:Database.Database){
 if(!exists(db))return;
 try{for(const row of db.prepare('SELECT * FROM ai_legacy_history').all() as {id:string;source_system:string;snapshot_digest:string;source_record_identity:string;source_kind:string;body_json:string}[]){const i=LegacyProposalHistory.parse(JSON.parse(row.body_json));if(i.id!==row.id||i.sourceSystem!==row.source_system||i.snapshotDigest!==row.snapshot_digest||i.sourceRecordIdentity!==row.source_record_identity||i.kind!==row.source_kind)throw Error();
  for(const ref of [{owner:'ai-legacy-history',objectId:i.id},...historyReferences(i)])if(i.content.availability==='available'&&(db.prepare('SELECT purged FROM platform_purge_fences WHERE owner=? AND object_id=?').get(ref.owner,ref.objectId) as {purged:number}|undefined)?.purged)throw Error();
 }}catch{throw Error('backup_legacy_history_invalid');}
}
export function legacyHistoryCandidateRelations(db:Database.Database){validateLegacyHistoryCandidate(db);return rows(db).filter(i=>i.content.availability==='available').flatMap(i=>historyReferences(i).map(ref=>({...ref,kind:'object' as const,optional:ref===i.target.ownerReference&&i.target.resolution==='unresolved'})));}

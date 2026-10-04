import {assertStagingReferencesNotPurged} from '../../platform/persistence/purge-history';
import {createManagedCopies} from '../../platform/backup/managed-copies';
import type Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {readFileSync,realpathSync,lstatSync,existsSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {LegacyHistoryImport,LegacyProposalHistory} from '../../../contracts/ai/legacy-history/schema';
import {historyReferences} from './public';
const Marker=z.strictObject({kind:z.literal('legacy-history-staging'),workspaceInstance:z.uuid()});
/** Backend-only capability. Not registered in the writer RPC or the renderer contract. */
export function createLegacyHistoryStagingWriter(db:Database.Database,binding:{dataRoot:string;root:string;workspaceInstance:string}){
 function assertStaging(){
  const expected=path.join(realpathSync(binding.dataRoot),'migration-staging',path.basename(binding.root));
  if(!z.uuid().safeParse(path.basename(binding.root)).success||realpathSync(binding.root)!==expected||realpathSync(db.name)!==path.join(expected,'career.sqlite')||lstatSync(db.name).isSymbolicLink()||db.readonly)throw Error('staging_required');
  const pointer=path.join(binding.dataRoot,'active-workspace-pointer.json');
  if(existsSync(pointer)){const active=z.object({relativePath:z.string()}).parse(JSON.parse(readFileSync(pointer,'utf8')));if(realpathSync(path.resolve(binding.dataRoot,active.relativePath))===expected)throw Error('staging_required');}
  const copy=createManagedCopies(realpathSync(binding.dataRoot)).list().find(c=>c.relativePath===path.relative(realpathSync(binding.dataRoot),expected));
  if(!copy||copy.kind!=='staging'||copy.state!=='ready')throw Error('staging_copy_unregistered');
  const markerPath=path.join(expected,'legacy-history-staging.json');if(!lstatSync(markerPath).isFile()||lstatSync(markerPath).isSymbolicLink())throw Error('staging_required');
  const marker=Marker.parse(JSON.parse(readFileSync(markerPath,'utf8'))),workspace=db.prepare('SELECT instance FROM platform_workspace').get() as {instance:string};if(marker.workspaceInstance!==binding.workspaceInstance||workspace.instance!==binding.workspaceInstance)throw Error('staging_identity_mismatch');
 }
 assertStaging();
 return {importRecord(input:unknown):LegacyProposalHistory {assertStaging();const value=LegacyHistoryImport.parse(input);return db.transaction(()=>{
  const existing=db.prepare('SELECT body_json FROM ai_legacy_history WHERE source_system=? AND snapshot_digest=? AND source_record_identity=? AND source_kind=?').get(value.sourceSystem,value.snapshotDigest,value.sourceRecordIdentity,value.kind) as {body_json:string}|undefined;
  const previous=existing?LegacyProposalHistory.parse(JSON.parse(existing.body_json)):undefined;
  if(previous?.content.availability==='purged')return previous;
  assertStagingReferencesNotPurged(realpathSync(binding.dataRoot),historyReferences(value));
  for(const ref of historyReferences(value))if((db.prepare('SELECT purged FROM platform_purge_fences WHERE owner=? AND object_id=?').get(ref.owner,ref.objectId) as {purged:number}|undefined)?.purged)throw Error('content_purged');
  if(previous){const {id:unusedId,archivedAt:unusedTime,...before}=previous;if(JSON.stringify(before)!==JSON.stringify(value))throw Error('archive_source_conflict');return previous;}
  const item=LegacyProposalHistory.parse({...value,id:randomUUID(),archivedAt:new Date().toISOString()});
  db.prepare('INSERT INTO ai_legacy_history VALUES (?,?,?,?,?,?)').run(item.id,item.sourceSystem,item.snapshotDigest,item.sourceRecordIdentity,item.kind,JSON.stringify(item));return item;
 })();}};
}

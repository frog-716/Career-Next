import type Database from 'better-sqlite3';
import {existsSync,readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {createManagedCopies,safeManagedPath} from '../backup/managed-copies';
import {assertStagingReferencesNotPurged} from './purge-history';
import type {PersistenceReference} from './fence';
export type StagingPermit=Readonly<{workspaceInstance:string}>;
const bindings=new WeakMap<StagingPermit,{dataRoot:string;root:string}>();
export function stagingPermit(db:Database.Database,binding:{dataRoot:string;root:string;workspaceInstance:string}):StagingPermit{
 const permit=Object.freeze({workspaceInstance:binding.workspaceInstance});bindings.set(permit,binding);assertMigrationStaging(permit,db);return permit;
}
/** Private backend capability, bound to one managed staging DB; rechecked on every owner write. */
export function assertMigrationStaging(permit:StagingPermit,db:Database.Database,references:readonly PersistenceReference[]=[]){
 const binding=bindings.get(permit);if(!binding)throw Error('staging_required');
 const dataRoot=realpathSync(binding.dataRoot),root=safeManagedPath(dataRoot,'migration-staging/'+path.basename(binding.root));
 if(!z.uuid().safeParse(path.basename(root)).success||realpathSync(binding.root)!==root||realpathSync(db.name)!==path.join(root,'career.sqlite')||db.readonly)throw Error('staging_required');
 const marker=z.strictObject({kind:z.literal('m1b-staging'),workspaceInstance:z.uuid()}).parse(JSON.parse(readFileSync(safeManagedPath(dataRoot,path.relative(dataRoot,root)+'/m1b-staging.json'),'utf8')));
 const workspace=db.prepare('SELECT instance FROM platform_workspace').get() as {instance:string};
 if(marker.workspaceInstance!==permit.workspaceInstance||workspace.instance!==permit.workspaceInstance)throw Error('staging_identity_mismatch');
 const copy=createManagedCopies(dataRoot).list().find(c=>c.relativePath===path.relative(dataRoot,root));if(copy?.kind!=='staging'||copy.state!=='ready')throw Error('staging_copy_unavailable');
 const pointer=path.join(dataRoot,'active-workspace-pointer.json');if(existsSync(pointer)){const active=z.object({relativePath:z.string()}).parse(JSON.parse(readFileSync(pointer,'utf8')));if(safeManagedPath(dataRoot,active.relativePath)===root)throw Error('staging_is_active');}
 assertStagingReferencesNotPurged(dataRoot,references);
 for(const ref of references)if((db.prepare('SELECT purged FROM platform_purge_fences WHERE owner=? AND object_id=?').get(ref.owner,ref.objectId) as {purged:number}|undefined)?.purged)throw Error('content_purged');
}

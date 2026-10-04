import {existsSync,readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {Plan} from '../../../contracts/application/schema';
import {safeManagedPath} from '../backup/managed-copies';
import type {PersistenceReference} from './fence';
const Control=z.object({state:z.enum(['plan','intent','marked','incomplete','complete']),plan:Plan});
/** Device-local purge decisions outlive any individual staging snapshot/fence. */
export function assertStagingReferencesNotPurged(dataRoot:string,references:readonly PersistenceReference[]){
 const folder=safeManagedPath(dataRoot,'purge-control');if(!existsSync(folder))return;
 for(const name of readdirSync(folder)){if(!/^[a-f0-9-]{36}\.json$/.test(name))throw Error('purge_control_invalid');const control=Control.parse(JSON.parse(readFileSync(safeManagedPath(dataRoot,'purge-control/'+name),'utf8')));if(control.state!=='plan'&&control.plan.impact.references.some(a=>references.some(b=>a.owner===b.owner&&a.objectId===b.objectId)))throw Error('content_purged');}
}

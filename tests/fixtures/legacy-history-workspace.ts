import {createManagedCopies} from '../../packages/backend/platform/backup/managed-copies';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {openWorkspace} from '../../packages/backend/platform/database/database';
import {releases} from '../../packages/backend/bootstrap/releases';
import {materialsMigration} from '../../packages/backend/domains/materials/migration';
import {createLegacyHistoryStagingWriter} from '../../packages/backend/ai-runtime/legacy-history/staging';
import {syntheticLegacyHistory} from './legacy-history';
/** Synthetic desktop fixture only; no legacy source discovery or executable migration adapter. */
export async function seedLegacyHistoryTestProfile(dataRoot:string){
 const root=path.join(dataRoot,'migration-staging',randomUUID());await mkdir(root,{recursive:true});const workspace=await openWorkspace(root,materialsMigration,releases);
 const registry=createManagedCopies(dataRoot),copy=registry.register({relativePath:path.relative(dataRoot,root),kind:'staging',state:'ready'});
 let items;try{await writeFile(path.join(root,'legacy-history-staging.json'),JSON.stringify({kind:'legacy-history-staging',workspaceInstance:workspace.workspaceInstance}));const writer=createLegacyHistoryStagingWriter(workspace.database,{dataRoot,root,workspaceInstance:workspace.workspaceInstance});items=syntheticLegacyHistory().map(input=>writer.importRecord(input));}finally{workspace.close();}
 await rm(path.join(root,'legacy-history-staging.json'));await mkdir(path.join(dataRoot,'workspaces'),{recursive:true});await rename(root,path.join(dataRoot,'workspaces/local'));
 registry.update(copy.id,{state:'purged'});const active=registry.register({relativePath:'workspaces/local',kind:'current_workspace',state:'ready'});
 await writeFile(path.join(dataRoot,'active-workspace-pointer.json'),JSON.stringify({copyId:active.id,relativePath:'workspaces/local',workspaceInstance:workspace.workspaceInstance}));
 return items;
}

import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { startWriter } from '../platform/database/client';
import { createMaterialsBackend } from '../domains/materials/public';
import type { Store,HumanSession } from '../domains/materials/store';
import type { BusinessModule } from '../../contracts/common/bridge';
type RuntimeStore=Store&{business(session:HumanSession,module:BusinessModule,input:unknown):unknown};
export async function createRuntimeBackend(root:string,writerArtifact?:string){
 await mkdir(root,{recursive:true,mode:0o700});
 const writer=await startWriter<RuntimeStore>(root,randomUUID(),writerArtifact);
 const materials=await createMaterialsBackend(root,undefined,undefined,writer);
 return {materials,business:(session:HumanSession,module:BusinessModule,input:unknown)=>writer.call('business',session,module,input),close:()=>materials.close()};
}

import Database from 'better-sqlite3';
import {createLedger} from '../database/ledger';
import {createBlobBroker} from './blobs';
import { randomUUID } from 'node:crypto';
import { open,readFile,rename,mkdir,stat,cp } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { syncDirectory } from './staging';
const Copy=z.strictObject({id:z.uuid(),relativePath:z.string().regex(/^recovery\/upgrade-[0-9]+-[0-9a-f-]+$/),purpose:z.literal('schema-upgrade'),state:z.enum(['candidate','ready','failed']),fromVersion:z.number().int(),toVersion:z.number().int(),recordedAt:z.string()});
const Registry=z.strictObject({copies:z.array(Copy).max(1000)});
export async function createUpgradeRecovery(database:Database.Database,root:string,fromVersion:number,toVersion:number){
 const filename=path.join(root,'managed-copies.json');
 let copies:z.infer<typeof Copy>[]=[];
 try{const bytes=await readFile(filename);if(bytes.length>1024*1024)throw Error('invalid_copy_registry');copies=Registry.parse(JSON.parse(bytes.toString('utf8'))).copies;}
 catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='ENOENT'))throw error;}
 const id=randomUUID(),relativePath=`recovery/upgrade-${fromVersion}-${id}`;
 const record=Copy.parse({id,relativePath,purpose:'schema-upgrade',state:'candidate',fromVersion,toVersion,recordedAt:new Date().toISOString()});
 copies.push(record);
 async function persist(){
  const temporary=filename+'.'+randomUUID()+'.pending';const handle=await open(temporary,'wx',0o600);
  try{await handle.writeFile(JSON.stringify(Registry.parse({copies})));await handle.sync();}finally{await handle.close();}
  await rename(temporary,filename);await syncDirectory(root);
 }
 // Register before copying any SQLite bytes or blob data; partial failures remain discoverable.
 await persist();
 const destination=path.join(root,relativePath);
 try{
  await mkdir(destination,{recursive:true,mode:0o700});
  await database.backup(path.join(destination,'career.sqlite'));
  const blobs=path.join(root,'blobs');let exists=false;
  try{await stat(blobs);exists=true;}catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='ENOENT'))throw error;}
  if(exists)await cp(blobs,path.join(destination,'blobs'),{recursive:true,errorOnExist:true,force:false});
  const copy=new Database(path.join(destination,'career.sqlite'),{readonly:true});
  try{
   const integrity=copy.pragma('quick_check') as {quick_check:string}[];
   if(integrity.length!==1||integrity[0].quick_check!=='ok'||(copy.pragma('foreign_key_check') as unknown[]).length)throw Error('invalid_recovery_copy');
   const broker=createBlobBroker(destination,16*1024*1024);
   for(const artifact of createLedger(copy).retainedArtifacts()){
    const bytes=await broker.readBytes(artifact.id,artifact.digest);if(bytes.length!==artifact.size)throw Error('invalid_recovery_copy');
    const handle=await open(path.join(destination,'blobs',artifact.id),'r');try{await handle.sync();}finally{await handle.close();}
   }
  }finally{copy.close();}
  const databaseFile=await open(path.join(destination,'career.sqlite'),'r');try{await databaseFile.sync();}finally{await databaseFile.close();}
  const metadata=await open(path.join(destination,'upgrade.json'),'wx',0o600);try{await metadata.writeFile(JSON.stringify({fromVersion,toVersion}));await metadata.sync();}finally{await metadata.close();}
  if(exists)await syncDirectory(path.join(destination,'blobs'));
  await syncDirectory(destination);await syncDirectory(path.dirname(destination));await syncDirectory(root);record.state='ready';await persist();
 }catch(error){record.state='failed';await persist();throw error;}
 return destination;
}

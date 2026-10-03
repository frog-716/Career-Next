import {it,expect} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import {openWorkspace} from '../../packages/backend/platform/database/database';
import {materialsMigration} from '../../packages/backend/domains/materials/migration';
import {releases} from '../../packages/backend/bootstrap/releases';

it('G3 real release failure rolls every new owner back while keeping the released G2 manifest and retryable upgrade',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'career-g3-migration-'));
 try{
  const old=await openWorkspace(root,materialsMigration,releases.slice(0,1));const identity=old.workspaceInstance;const manifest=old.database.prepare('SELECT * FROM platform_migration_fragments').all();old.close();
  const failed=[releases[0],{...releases[1],fragments:[...releases[1].fragments,{id:'test.g3-failure',dependencies:['offer.initial.v1'],sql:'INVALID SQL'}]}];
  await expect(openWorkspace(root,materialsMigration,failed)).rejects.toThrow('migration_failed');
  const inspect=new Database(path.join(root,'career.sqlite'),{readonly:true});try{expect(inspect.pragma('user_version',{simple:true})).toBe(2);expect(inspect.prepare('SELECT * FROM platform_migration_fragments').all()).toEqual(manifest);expect(inspect.prepare("SELECT name FROM sqlite_master WHERE name='research_items' OR name='interview_sessions' OR name='opportunity_offer'").all()).toEqual([]);}finally{inspect.close();}
  const latest=await openWorkspace(root,materialsMigration,releases.slice(0,2));expect(latest.workspaceInstance).toBe(identity);expect(latest.database.pragma('user_version',{simple:true})).toBe(3);expect(latest.database.pragma('foreign_key_check')).toEqual([]);latest.close();
  const altered=[releases[0],{...releases[1],fragments:releases[1].fragments.map((fragment,index)=>index===0?{...fragment,sql:fragment.sql+'\n-- changed release'}:fragment)}];
  await expect(openWorkspace(root,materialsMigration,altered)).rejects.toThrow('migration_mismatch');
  await expect(openWorkspace(root,materialsMigration,releases.slice(0,1))).rejects.toThrow('db_failed');
 }finally{await rm(root,{recursive:true,force:true});}
});

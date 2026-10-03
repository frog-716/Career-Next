import type Database from 'better-sqlite3';
import {Request,Result,Profile} from '../../../contracts/profile/schema';
import {executeCommand,commandReceipt,redactedCommandResults} from '../../platform/commands/receipts';
export const profileMigration=`CREATE TABLE profile_current(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,body TEXT NOT NULL);
INSERT INTO profile_current VALUES(1,0,'{"name":"","contact":"","links":[]}');`;
export function createProfileDomain(db:Database.Database){
 function read(){const row=db.prepare('SELECT revision,body FROM profile_current WHERE id=1').get() as {revision:number;body:string};return Profile.parse({...JSON.parse(row.body),revision:row.revision});}
 function handle(input:unknown):Result {
  const parsed=Request.safeParse(input);if(!parsed.success)return {status:'failure',code:'invalid-request'};const request=parsed.data;
  try{
   if(request.operation==='profile.read')return {status:'profile',profile:read()};
   if(request.operation==='profile.receipt'){const receipt=commandReceipt(db,'profile',request.commandId);return receipt?Result.parse(receipt):{status:'not-found'};}
   return Result.parse(executeCommand(db,'profile',request.commandId,request,()=>{
    const current=read();if(current.revision!==request.expectedRevision)return {status:'conflict',profile:current};
    const next=Profile.parse({revision:current.revision+1,name:request.name,contact:request.contact,links:request.links});
    db.prepare('UPDATE profile_current SET revision=?,body=? WHERE id=1').run(next.revision,JSON.stringify({name:next.name,contact:next.contact,links:next.links}));
    return {status:'profile',profile:next};
   }));
  }catch(error){return error instanceof Error&&error.message==='conflict'?{status:'conflict',profile:read()}:{status:'failure',code:'storage-failed'};}
 }
 return {read,handle,purgeImpact(id:string){return id==='current'?{id,revision:read().revision,name:'当前本人资料',blobIds:[],retentions:[]}:undefined;},purge(id:string){if(id!=='current')return;db.transaction(()=>{db.prepare('UPDATE profile_current SET revision=revision+1,body=? WHERE id=1').run(JSON.stringify({name:'',contact:'',links:[]}));redactedCommandResults(db,'profile',()=>true,{status:'not-found'});})();}};
}

export {validateCandidate,candidateRelations} from './candidate-validation';

import type {CareerDocument,Request,Result} from '../../../contracts/resume/schema';
type Save=Extract<Request,{operation:'resume.save'}>;
export type SaveState={content:CareerDocument;revision:number;profileRevision:number;status:'saved'|'dirty'|'saving'|'composition'|'conflict'|'unknown'|'failed';comparison?:Extract<Result,{status:'conflict'}>};
/** One continuous editor session: save acknowledgements never replace live editor content. */
export function createResumeSaveSession(initial:{resumeId:string;revision:number;profileRevision:number;content:CareerDocument},request:(input:Request)=>Promise<Result>,changed:()=>void=()=>{}){
 let value:SaveState={content:initial.content,revision:initial.revision,profileRevision:initial.profileRevision,status:'saved'};
 let composing=false,disposed=false,generation=0,savedGeneration=0;
 let inFlight:Promise<boolean>|undefined,pending:Save|undefined,pendingGeneration=0;
 function notify(){if(!disposed)changed();}
 function apply(result:Result,submittedGeneration:number){
  if(result.status==='document'){value.revision=result.document.revision;value.profileRevision=result.profile.revision;savedGeneration=submittedGeneration;value.status=generation===savedGeneration?'saved':'dirty';pending=undefined;}
  else if(result.status==='conflict'){value.status='conflict';value.comparison=result;pending=undefined;}
  else {value.status='failed';pending=undefined;}
  if(composing&&['dirty','saved'].includes(value.status))value.status='composition';notify();return value.status==='saved';
 }
 async function flush():Promise<boolean>{
  if(disposed||composing||value.status==='conflict'||value.status==='unknown'||value.status==='failed')return false;
  if(inFlight){await inFlight;return generation===savedGeneration&&!composing;}
  if(generation===savedGeneration)return true;
  const command:Save={operation:'resume.save',commandId:crypto.randomUUID(),resumeId:initial.resumeId,expectedRevision:value.revision,expectedProfileRevision:value.profileRevision,content:structuredClone(value.content)};
  pending=command;pendingGeneration=generation;value.status='saving';notify();
  const submittedGeneration=generation;
  inFlight=(async()=>{try{return apply(await request(command),submittedGeneration);}catch{value.status='unknown';notify();return false;}finally{inFlight=undefined;}})();
  return inFlight;
 }
 return {
  state:()=>({...value}),
  change(content:CareerDocument){value.content=content;generation++;if(!['unknown','conflict','failed'].includes(value.status))value.status=composing?'composition':inFlight?'saving':'dirty';notify();},
  composition(active:boolean){composing=active;if(active&&!['unknown','conflict','failed'].includes(value.status))value.status='composition';else if(!active&&value.status==='composition')value.status=generation===savedGeneration?'saved':'dirty';notify();},
  flush,
  async verify(){if(!pending||value.status!=='unknown')return false;try{const result=await request({operation:'resume.receipt',commandId:pending.commandId});if(result.status==='not-found'){value.status='unknown';notify();return false;}return apply(result,pendingGeneration);}catch{return false;}},
  async continueOriginal(){if(!pending||value.status!=='unknown')return false;try{return apply(await request(pending),pendingGeneration);}catch{notify();return false;}},
  compare(current:Extract<Result,{status:'conflict'}>){value.comparison=current;value.status='conflict';notify();},
  useComparisonRevision(){if(value.comparison?.document){value.revision=value.comparison.document.revision;value.profileRevision=value.comparison.profile.revision;value.comparison=undefined;value.status='dirty';notify();}},
  profileRevision(revision:number){value.profileRevision=revision;notify();},
  adopted(content:CareerDocument,revision:number,profileRevision:number){value.content=content;value.revision=revision;value.profileRevision=profileRevision;generation++;savedGeneration=generation;value.status='saved';notify();},
  dispose(){disposed=true;}
 };
}

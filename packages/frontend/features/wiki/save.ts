import { Result,type Request,type Knowledge } from '../../../contracts/wiki/schema';
export type WikiSaveState={state:'saved';knowledge:Knowledge}|{state:'unknown'}|{state:'not_recorded'}|{state:'conflict'}|{state:'failed';code:string};
function interpret(value:unknown):WikiSaveState{
 const result=Result.parse(value);
 if(result.kind==='knowledge')return {state:'saved',knowledge:result.knowledge};
 if(result.kind==='receipt_missing')return {state:'not_recorded'};
 if(result.kind==='failure')return result.code==='conflict'?{state:'conflict'}:{state:'failed',code:result.code};
 return {state:'unknown'};
}
export async function submitWikiIntent(request:(input:Request)=>Promise<Result>,intent:Request):Promise<WikiSaveState>{try{return interpret(await request(intent));}catch{return {state:'unknown'};}}
export async function checkWikiIntent(request:(input:Request)=>Promise<Result>,commandId:string):Promise<WikiSaveState>{return submitWikiIntent(request,{operation:'receipt',commandId});}

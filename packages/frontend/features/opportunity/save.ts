import {Result,type Request} from '../../../contracts/opportunity/schema';
export async function sendOpportunityIntent(request:(input:Request)=>Promise<Result>,intent:Request):Promise<Result|{kind:'unknown'}>{try{return Result.parse(await request(intent));}catch{return {kind:'unknown'};}}

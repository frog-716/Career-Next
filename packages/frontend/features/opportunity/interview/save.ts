import {Result,type Request} from '../../../../contracts/opportunity/interview/schema';
export async function sendInterviewIntent(request:(input:Request)=>Promise<Result>,intent:Request):Promise<Result|{kind:'unknown'}>{
 try{return Result.parse(await request(intent));}catch{
  if(!('commandId' in intent))return {kind:'unknown'};
  try{return Result.parse(await request({operation:'interview.receipt',commandId:intent.commandId}));}catch{return {kind:'unknown'};}
 }
}

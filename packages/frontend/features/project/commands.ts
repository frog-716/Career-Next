import {Request,Result} from '../../../contracts/project/schema';
export type ProjectRequest=(input:Request)=>Promise<Result>;
export type ProjectCommandState=
 | {status:'unknown';command:Request}
 | {status:'not_recorded';command:Request}
 | {status:'known';command:Request;result:Result};
export async function submitProjectCommand(request:ProjectRequest,input:Request):Promise<ProjectCommandState>{
 const parsed=Request.safeParse(input);
 if(!parsed.success)return {status:'known',command:input,result:{kind:'failure',code:'invalid_input'}};
 const command=parsed.data;
 try{return {status:'known',command,result:Result.parse(await request(command))};}
 catch{return {status:'unknown',command};}
}
export async function checkProjectCommand(request:ProjectRequest,command:Request):Promise<ProjectCommandState>{
 if(!('commandId' in command))throw new Error('Command required');
 try{
  const result=Result.parse(await request({operation:'receipt',commandId:command.commandId}));
  return result.kind==='not_recorded'?{status:'not_recorded',command}:{status:'known',command,result};
 }catch{return {status:'unknown',command};}
}

import { expect,it } from 'vitest';
import { submitEmploymentCommand,checkEmploymentCommand } from '../packages/frontend/features/employment/commands';
import type { Request,Result } from '../packages/contracts/employment/schema';
const command:Request={operation:'create',commandId:crypto.randomUUID(),company:'组织',role:'工程师',goal:'',started:true,start:{kind:'unknown'},plannedEnd:{kind:'unknown'}};
it('lost response retains original command and explicit receipt verification never resends it',async()=>{
 const input:Request[]=[];
const request=async(value:Request):Promise<Result>=>{input.push(value);
if(value.operation==='receipt')return {kind:'not_recorded'};
throw new Error('disconnected');
};
 expect(await submitEmploymentCommand(request,command)).toEqual({status:'unknown',command});
 expect(await checkEmploymentCommand(request,command)).toEqual({status:'not_recorded',command});
 expect(input.map(value=>value.operation)).toEqual(['create','receipt']);
});
it('invalid calendar input stays visible as a known validation error without dispatch',async()=>{
 let dispatched=false;
 const result=await submitEmploymentCommand(async()=>{dispatched=true;
return {kind:'not_recorded'};
},{...command,operation:'create',commandId:crypto.randomUUID(),company:'机构',role:'职务',goal:'',started:true,start:{kind:'date',date:'2024-02-30'},plannedEnd:{kind:'unknown'}});
 expect(result).toMatchObject({status:'known',result:{kind:'failure',code:'invalid_input'}});
expect(dispatched).toBe(false);
});

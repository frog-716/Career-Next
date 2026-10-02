import {it,expect} from 'vitest';
import type {Request,Result} from '../packages/contracts/project/schema';
import {submitProjectCommand,checkProjectCommand} from '../packages/frontend/features/project/commands';
const command:Request={operation:'create',commandId:crypto.randomUUID(),name:'项目',description:'',tags:[],employmentId:null,occurredAt:{kind:'unknown'}};
it('lost save response retains one command for receipt verification and never blindly retries',async()=>{
 const inputs:Request[]=[];
 const request=async(input:Request):Promise<Result>=>{inputs.push(input);if(input.operation==='receipt')return {kind:'not_recorded'};throw new Error('disconnected');};
 expect(await submitProjectCommand(request,command)).toEqual({status:'unknown',command});
 expect(await checkProjectCommand(request,command)).toEqual({status:'not_recorded',command});
 expect(inputs.map(input=>input.operation)).toEqual(['create','receipt']);
});
it('invalid business date is a visible validation failure without dispatching a command',async()=>{
 let dispatched=false;
 expect(await submitProjectCommand(async()=>{dispatched=true;return {kind:'not_recorded'};},{...command,operation:'create',commandId:crypto.randomUUID(),name:'项目',description:'',tags:[],employmentId:null,occurredAt:{kind:'date',date:'2024-02-30'}})).toMatchObject({status:'known',result:{kind:'failure',code:'invalid_input'}});
 expect(dispatched).toBe(false);
});

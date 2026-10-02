import { expect,it } from 'vitest';
import { sendOpportunityIntent } from '../packages/frontend/features/opportunity/save';
it('UX-04 unknown transmission cannot turn into saved success or implicit replay',async()=>{
 const intent={operation:'create' as const,commandId:crypto.randomUUID(),companyId:crypto.randomUUID(),role:'岗位'};
 expect(await sendOpportunityIntent(async()=>{throw Error('disconnected');},intent)).toEqual({kind:'unknown'});
 expect(await sendOpportunityIntent(async()=>({kind:'receipt_missing'}),{operation:'receipt',commandId:intent.commandId})).toEqual({kind:'receipt_missing'});
});

import { expect,it } from 'vitest';
import { submitWikiIntent,checkWikiIntent } from '../packages/frontend/features/wiki/save';
import type { Request } from '../packages/contracts/wiki/schema';
const intent:Request={operation:'create',commandId:crypto.randomUUID(),title:'manual',body:'draft',scope:'personal',nature:'observation',sources:[]};
it('UX-04 an interrupted write stays unknown and receipt checking does not replay it',async()=>{
 expect(await submitWikiIntent(async()=>{throw Error('transport lost');},intent)).toEqual({state:'unknown'});
 expect(await checkWikiIntent(async input=>{expect(input).toEqual({operation:'receipt',commandId:'original-id'});return {kind:'receipt_missing'};},'original-id')).toEqual({state:'not_recorded'});
});

import { it, expect } from 'vitest';
import { saveRaw, verifyReceipt } from '../packages/frontend/features/materials/save';
import type { MaterialsBridge, Result } from '../packages/contracts/materials/schema';

it('lost response keeps the original command unknown, then receipt converges without resaving', async () => {
  const commandId=crypto.randomUUID(), importId=crypto.randomUUID(), materialId=crypto.randomUUID();
  const source={owner:'materials' as const,objectId:materialId,revision:1 as const,locator:'whole' as const,scope:'personal' as const};
  const input={commandId,importId,expectedRevision:1 as const,digest:'a'.repeat(64)};
  let confirmCalls=0;
  const bridge: Pick<MaterialsBridge,'request'>={request: async request => {
    if(request.operation==='confirm') { confirmCalls++; throw new Error('response dropped'); }
    if(request.operation==='receipt') { expect(request.commandId).toBe(commandId); return {kind:'receipt',receipt:{status:'committed',commandId,materialId,source}}; }
    if(request.operation==='read') throw new Error('read failed after commit');
    throw new Error('unexpected call');
  }};
  const unknown=await saveRaw(bridge,input);
  expect(unknown.phase).toBe('outcome_unknown'); expect(unknown.command).toEqual(input);
  const recovered=await verifyReceipt(bridge,input);
  expect(recovered.phase).toBe('saved_unread');
  expect(recovered.command).toEqual(input);
  expect(confirmCalls).toBe(1);
});

it('a readable committed receipt gives the actual saved Raw; explicit conflict preserves the command', async () => {
  const commandId=crypto.randomUUID(), importId=crypto.randomUUID(), materialId=crypto.randomUUID();
  const input={commandId,importId,expectedRevision:1 as const,digest:'b'.repeat(64)};
  const source={owner:'materials' as const,objectId:materialId,revision:1 as const,locator:'whole' as const,scope:'personal' as const};
  const raw={id:materialId,name:'原件.txt',size:6,scope:'personal' as const,lifecycle:'evidence-original' as const,revision:1 as const,source,recordedAt:'2026-10-02T00:00:00.000Z',text:'中文',digest:input.digest};
  const bridge: Pick<MaterialsBridge,'request'>={request:async request=>request.operation==='confirm'?{kind:'receipt',receipt:{status:'committed',commandId,materialId,source}}:{kind:'raw',raw}};
  expect(await saveRaw(bridge,input)).toEqual({phase:'saved',command:input,receipt:{status:'committed',commandId,materialId,source},raw});
  const conflict: Pick<MaterialsBridge,'request'>={request:async()=>({kind:'failure',code:'conflict'})};
  expect(await saveRaw(conflict,input)).toEqual({phase:'conflict',command:input,code:'conflict'});
});

it('a lost undispatched request can be continued explicitly with the original immutable command', async () => {
  const input={commandId:crypto.randomUUID(),importId:crypto.randomUUID(),expectedRevision:1 as const,digest:'c'.repeat(64)};
  let confirms=0;
  const bridge: Pick<MaterialsBridge,'request'>={request:async request=>{
    if(request.operation==='confirm'){confirms++;expect(request.input).toEqual(input);throw new Error('request did not arrive');}
    if(request.operation==='receipt')return {kind:'receipt',receipt:{status:'not_found',commandId:input.commandId}};
    throw new Error('unexpected operation');
  }};
  expect((await saveRaw(bridge,input)).phase).toBe('outcome_unknown');
  const absent=await verifyReceipt(bridge,input);
  expect(absent.phase).toBe('not_recorded');expect(absent.command).toEqual(input);expect(confirms).toBe(1);
  // This call represents a second, explicit human click, never a query-triggered automatic replay.
  await saveRaw(bridge,absent.command);expect(confirms).toBe(2);
});

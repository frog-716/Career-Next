import { Result } from '../../../contracts/materials/schema';
import type { Confirm, MaterialsBridge, Raw, Receipt } from '../../../contracts/materials/schema';
export type SaveState = { phase: 'saved'|'saved_unread'|'outcome_unknown'|'not_recorded'|'failed'|'conflict'; command: Confirm; raw?: Raw; receipt?: Receipt; code?: string };
async function fromReceipt(bridge: Pick<MaterialsBridge,'request'>, command: Confirm, receipt: Receipt): Promise<SaveState> {
  if(receipt.status==='committed') {
    try {
      const result=Result.parse(await bridge.request({operation:'read',materialId:receipt.materialId}));
      if(result.kind==='raw') return {phase:'saved',command,receipt,raw:result.raw};
    } catch { /* Commit remains known even when readback fails. */ }
    return {phase:'saved_unread',command,receipt};
  }
  if(receipt.status==='failed') return {phase:receipt.code==='conflict'?'conflict':'failed',command,receipt,code:receipt.code};
  return {phase:receipt.status==='not_found'?'not_recorded':'outcome_unknown',command,receipt};
}
export async function saveRaw(bridge: Pick<MaterialsBridge,'request'>, command: Confirm): Promise<SaveState> {
  try {
    const result=Result.parse(await bridge.request({operation:'confirm',input:command}));
    if(result.kind==='receipt') return fromReceipt(bridge,command,result.receipt);
    if(result.kind==='failure') return {phase:result.code==='conflict'?'conflict':'failed',command,code:result.code};
    return {phase:'outcome_unknown',command};
  } catch { return {phase:'outcome_unknown',command}; }
}
export async function verifyReceipt(bridge: Pick<MaterialsBridge,'request'>, command: Confirm): Promise<SaveState> {
  try {
    const result=Result.parse(await bridge.request({operation:'receipt',commandId:command.commandId}));
    if(result.kind==='receipt') return fromReceipt(bridge,command,result.receipt);
  } catch { /* Preserve unknown; never infer failed from a broken connection. */ }
  return {phase:'outcome_unknown',command};
}

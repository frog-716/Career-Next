import {createHash} from 'node:crypto';
import {Recipient,ProviderOutput} from '../../../contracts/ai/schema';
import type {ProviderAdapter} from '../../../contracts/ai/provider';
/** Local, bounded, repeatable protocol fixture. No SDK, key, HTTP, telemetry, or retries. */
export function createDeterministicFakeProvider():ProviderAdapter {
 return {recipient:Recipient.parse({service:'deterministic-fake',endpoint:'local://career-wiki-fake',account:'local-no-credential',generation:'fake-v1',model:'wiki-organizer-v1'}),network:'none',async send({manifest,manifestDigest},signal){
  if(signal.aborted)throw Error('not_sent');if(createHash('sha256').update(JSON.stringify(manifest)).digest('hex')!==manifestDigest)throw Error('manifest_mismatch');
  const body=manifest.materials.map(item=>item.body).join('\n\n').slice(0,64000);
  if(manifest.knowledge.some(item=>item.body===body))return {proposals:[]};
  return ProviderOutput.parse({proposals:[{kind:'create',content:{title:'所选材料整理',body,nature:'observation'},reason:'本地 deterministic fake 仅展示明确选中材料的待审整理，不声称模型分析质量。',citations:manifest.materials.map(item=>item.ref.objectId),unknowns:['未经独立核验','真实 Provider 尚未测试']}]});
 }};
}

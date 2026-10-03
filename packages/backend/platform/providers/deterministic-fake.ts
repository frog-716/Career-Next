import {ProductProviderOutput} from '../../../contracts/ai/product';
import {createHash} from 'node:crypto';
import {Recipient,ProviderOutput} from '../../../contracts/ai/schema';
import type {ProviderAdapter} from '../../../contracts/ai/provider';
/** Local, bounded, repeatable protocol fixture. No SDK, key, HTTP, telemetry, or retries. */
export function createDeterministicFakeProvider(generation='fake-v1'):ProviderAdapter {
 return {recipient:Recipient.parse({service:'deterministic-fake',endpoint:'local://career-wiki-fake',account:'local-no-credential',generation,model:'wiki-organizer-v1'}),network:'none',async send({manifest,manifestDigest},signal){
  if(signal.aborted)throw Error('not_sent');if(createHash('sha256').update(JSON.stringify(manifest)).digest('hex')!==manifestDigest)throw Error('manifest_mismatch');
  if(manifest.product){
   const context=manifest.product;
   if(context.target.kind!=='resume-optimize'){
    const citations=manifest.provenance.map(p=>p.objectId).filter((id,index,all)=>all.indexOf(id)===index&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)).slice(0,20);
    const count=context.target.kind==='research-organize'?2:1;
    return ProductProviderOutput.parse({proposals:Array.from({length:count},(_,index)=>({kind:'create',content:{title:context.promotion?.title??('受控 '+context.target.kind+' '+(index+1)),body:context.promotion?.body??(context.body+'\n'+manifest.materials.map(m=>m.body).join('\n')).slice(0,64000),nature:'hypothesis'},reason:'本地 deterministic fake 验证产品流程，未经独立核验。',citations,unknowns:['真实 Provider 尚未测试',...context.missing.slice(0,10)]}))});
   }
   return ProductProviderOutput.parse({proposals:context.resumeBlocks!.flatMap(item=>{
    const after=structuredClone(item.block),spans=after.type==='paragraph'?after.spans:after.items.at(-1)?.spans;if(!spans)return [];
    spans.push({text:'（受控优化建议：请核对原意后采纳）',marks:[]});
    const common={reason:'本地受控提案，仅验证选择、预览与采纳流程。',citations:[item.blockId],unknowns:['未经独立核验','真实 Provider 尚未测试']};const added=structuredClone(item.block);const uuid=(suffix:string)=>{const hash=createHash('sha256').update(manifestDigest+'/'+item.blockId+'/'+suffix).digest('hex');return hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-8'+hash.slice(17,20)+'-'+hash.slice(20,32);};added.id=uuid('add');if(added.type==='bullet-list')added.items.forEach((child,index)=>{child.id=uuid('item-'+index);child.paragraphId=uuid('paragraph-'+index);});return context.target.kind==='resume-optimize'?context.target.changeKinds.filter(kind=>kind!=='delete'||item.canDelete).map(kind=>kind==='rewrite'?{kind:'resume-block',blockId:item.blockId,after,...common}:kind==='add'?{kind:'resume-add',afterBlockId:item.blockId,after:added,...common}:{kind:'resume-delete',blockId:item.blockId,...common}):[];
   }).slice(0,20)});
  }
  const body=manifest.materials.map(item=>item.body).join('\n\n').slice(0,64000);
  if(manifest.knowledge.some(item=>item.body===body))return {proposals:[]};
  return ProviderOutput.parse({proposals:[{kind:'create',content:{title:'所选材料整理',body,nature:'observation'},reason:'本地 deterministic fake 仅展示明确选中材料的待审整理，不声称模型分析质量。',citations:manifest.materials.map(item=>item.ref.objectId),unknowns:['未经独立核验','真实 Provider 尚未测试']}]});
 }};
}

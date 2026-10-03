import type {ProductPolicy} from '../../../../contracts/ai/task-policy';
import type {ProductTarget} from '../../../../contracts/ai/product-context';
import type {TaskEvidence as RelatedContext} from '../../../../contracts/ai/task-policy';
import type {createOfferDomain} from './public';
import {Content} from '../../../../contracts/ai/protocol';
export function createOfferAiPolicy(owner:ReturnType<typeof createOfferDomain>,related:(opportunityId:string)=>RelatedContext,originalText:(opportunityId:string)=>RelatedContext):ProductPolicy{
 const target=(input:ProductTarget)=>{if(input.kind!=='offer-assist')throw Error('invalid_policy');return input;};
 return {
  targets(input){const offer=owner.read(target(input).opportunityId);if(!offer)throw Error('target_unavailable');return [{owner:'offer',objectId:offer.id}];},
  prepare(input){const selected=target(input),offer=owner.read(selected.opportunityId);if(!offer)throw Error('target_unavailable');const context=related(selected.opportunityId),original=originalText(selected.opportunityId);return {context:{target:input,body:context.body+'\n实际 Offer 条件（未知项不猜）：\n'+JSON.stringify(offer.conditions)+'\n原件：'+original.body+'\n此任务只产出分析或谈薪草稿，不接受 Offer、不改变条件、不创建任职。',missing:context.missing,identityFields:[],dependencies:[...context.dependencies,...original.dependencies,{owner:'offer',objectId:offer.id,revision:offer.revision,role:'evidence',locator:selected.opportunityId}]},provenance:[...context.provenance,...original.provenance,{owner:'offer',objectId:offer.id,revision:offer.revision,scope:'opportunity',scopeId:selected.opportunityId,kind:'actual_offer_conditions',restrictions:{read:true,egress:true}}],sources:original.sourceRefs??[]};},
  validate(change){if(change.kind!=='create')throw Error('invalid_output');},dependencies:(_change,context)=>context.dependencies,
  apply({proposal,edited}){if(proposal.change.kind!=='create')throw Error('invalid_output');return {owner:'ai',objectId:proposal.id,adoptedContent:Content.parse(edited??proposal.change.content)};},
 };
}

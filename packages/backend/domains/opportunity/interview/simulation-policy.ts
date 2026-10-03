import type {ProductPolicy} from '../../../../contracts/ai/task-policy';
import type {ProductTarget} from '../../../../contracts/ai/product-context';
import type {WikiPolicyPort} from '../../../../contracts/ai/task-policy';
import type {createInterviewDomain} from './public';
export function createSimulationReturnPolicy(owner:ReturnType<typeof createInterviewDomain>,wiki:WikiPolicyPort):ProductPolicy{
 const target=(input:ProductTarget)=>{if(input.kind!=='simulation-return')throw Error('invalid_policy');return input;};
 return {
  targets(input){const selected=target(input);return selected.wikiTarget.scopeId?[{owner:selected.wikiTarget.scope,objectId:selected.wikiTarget.scopeId}]:[];},
  prepare(input){const selected=target(input),session=owner.read(selected.simulationId);if(!session?.transcript||session.kind!=='simulation'||session.transcript.version!==selected.transcriptVersion||selected.selectionEnd<=selected.selectionStart||selected.selectionEnd>session.transcript.text.length||!wiki.validateTarget(selected.wikiTarget))throw Error('invalid_selection');const text=session.transcript.text.slice(selected.selectionStart,selected.selectionEnd);if(!text.trim())throw Error('invalid_selection');return {context:{target:input,body:'用户主动选中的模拟片段：\n'+text+'\n用户确认其真实含义：'+selected.meaning+'\n仅此选中片段可回流，不能把模拟面试官的虚构条件当成真实公司事实。',missing:[],identityFields:[],dependencies:[{owner:'interview',objectId:session.id,revision:session.transcript.version,role:'evidence',locator:'transcript'}]},provenance:[{owner:'interview',objectId:session.id,revision:session.transcript.version,scope:'opportunity',scopeId:session.opportunityId,kind:'simulation',restrictions:{read:true,egress:true}}],sources:[]};},
  validate(change){if(change.kind!=='create')throw Error('invalid_output');},dependencies:(_change,context)=>context.dependencies,
  apply({commandId,proposal,edited}){const selected=target(proposal.target);if(proposal.change.kind!=='create')throw Error('invalid_output');wiki.apply({commandId,proposalId:proposal.id,target:selected.wikiTarget,change:proposal.change,sources:[],provenance:proposal.provenance,simulationConfirmation:{simulationId:selected.simulationId,transcriptVersion:selected.transcriptVersion,selectionStart:selected.selectionStart,selectionEnd:selected.selectionEnd,meaning:selected.meaning,confirmedByHuman:true},edited:edited&&'body'in edited?edited:undefined});return {owner:'wiki',objectId:selected.wikiTarget.scopeId??selected.wikiTarget.scope};},
 };
}

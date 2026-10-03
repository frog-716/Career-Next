import {ProviderOutput, type Change, type Manifest} from '../../../contracts/ai/schema';
/** Wiki owns output policy; source authority is calculated by Runtime, never citations. */
export function validateWikiOutput(input:unknown,manifest:Manifest):Change[]{
 const output=ProviderOutput.parse(input);
 const ids=new Set(manifest.materials.map(item=>item.ref.objectId));
 for(const proposal of output.proposals){
  if(proposal.citations.some(id=>!ids.has(id)))throw Error('invalid_citation');
  if(proposal.kind!=='create'&&!manifest.knowledge.some(item=>item.id===proposal.itemId))throw Error('target_out_of_scope');
  if(manifest.provenance.some(item=>item.kind==='simulation')&&!['personal','cognition','project'].includes(manifest.target.scope))throw Error('simulation_target_forbidden');
 }
 return output.proposals;
}

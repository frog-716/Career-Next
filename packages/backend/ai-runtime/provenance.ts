import type {Provenance} from '../../contracts/ai/schema';
/** Deterministic inheritance also applies when reading a local summary/cache. */
export function inheritProvenance(inputs:readonly (readonly Provenance[])[]):Provenance[]{
 const found=new Map<string,Provenance>();
 for(const input of inputs)for(const source of input){const key=JSON.stringify([source.owner,source.objectId,source.revision,source.scope,source.kind,source.generation]);const old=found.get(key);found.set(key,{...source,restrictions:{read:source.restrictions.read&&(old?.restrictions.read??true),egress:source.restrictions.egress&&(old?.restrictions.egress??true)}});}
 return [...found.values()];
}

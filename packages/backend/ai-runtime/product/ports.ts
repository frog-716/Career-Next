import type {ProductPolicy} from '../../../contracts/ai/task-policy';
import type {ProductInput,ProductChange,ProductProposal,ProductRequest} from '../../../contracts/ai/product';
import type {ProductContext,Dependency,ProductTarget} from '../../../contracts/ai/product-context';
import type {Provenance} from '../../../contracts/common/provenance';
import type {SourceRef} from '../../../contracts/common/source-ref';
export interface ProductPorts {
 prepare(input:ProductInput):{context:ProductContext;provenance:Provenance[];sources:SourceRef[]};
 checkDependencies(dependencies:readonly Dependency[]):void;
 canRead(provenance:readonly Provenance[]):boolean;
 policy(target:ProductTarget):ProductPolicy;
}


export type {ProductPolicy,TaskEvidence} from '../../../contracts/ai/task-policy';

import type {ProductChange,ProductProposal,ProductRequest} from './product.ts';
import type {ProductContext,Dependency,ProductTarget} from './product-context.ts';
import type {Provenance} from '../common/provenance.ts';
import type {SourceRef} from '../common/source-ref.ts';
import type {Target,Change,Content} from './protocol.ts';
export interface ProductPolicy {
 prepare(target:ProductTarget):{context:ProductContext;provenance:Provenance[];sources:SourceRef[]};
 validate(change:ProductChange,context:ProductContext):void;
 dependencies(change:ProductChange,context:ProductContext):Dependency[];
 apply(input:{commandId:string;proposal:ProductProposal;edited:Extract<ProductRequest,{operation:'product.decide'}>['edited']}):{owner:string;objectId:string;resumeApplication?:import('./product.ts').ResumeApplication;adoptedContent?:Content};
 targets(target:ProductTarget):{owner:string;objectId:string}[];
}
export interface TaskEvidence {sentFiles?:ProductContext['sentFiles'];sourceRefs?:SourceRef[];body:string;missing:string[];dependencies:Dependency[];provenance:Provenance[];}

export interface WikiPolicyPort {validateTarget(target:Target):boolean;apply(input:{commandId:string;proposalId:string;target:Target;change:Change;sources:SourceRef[];provenance:Provenance[];edited?:Content;simulationConfirmation?:Omit<import('../wiki/schema.ts').Knowledge['simulationConfirmation'] & {},'contentDigest'>}):void;}

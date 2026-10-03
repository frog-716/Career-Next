import type {Budget,Change,Content,Manifest,Provenance,Target} from '../../contracts/ai/schema';
import type {SourceRef} from '../../contracts/common/source-ref';
export interface WikiSnapshot extends Content {id:string;revision:number;status:'active'|'retired';scope:Target['scope'];scopeId?:string;provenance?:Provenance[];simulationReturnEligible?:boolean}
export interface SourceSnapshot {ref:SourceRef;body:string;nature:string;restrictions:{read:boolean;egress:boolean};provenance:Provenance[]}
export interface FenceToken {id:string;producerId:string;workspaceInstance:string;backendGeneration:string;inputs:{owner:string;objectId:string;revision?:number;generation:number}[];targets:{owner:string;objectId:string;revision?:number;generation:number}[]}
export interface AiPorts {
 /** Trusted configuration only; omission preserves the local fake baseline. */
 recipient?:()=>Manifest['recipient'];
 product?:import('./product/ports').ProductPorts;
 identity:{workspaceInstance:string;backendGeneration:string};
 sources:{read(ref:SourceRef):SourceSnapshot|undefined;current(ref:SourceRef):SourceSnapshot|undefined;provenanceCurrent(input:Provenance):{revision:number;read:boolean;egress:boolean}|undefined};
 wiki:{validateTarget(target:Target):boolean;list(target:Target):WikiSnapshot[];read(id:string):WikiSnapshot|undefined;apply(input:{commandId:string;proposalId:string;target:Target;change:Change;before?:WikiSnapshot;sources:SourceRef[];provenance:Provenance[];edited?:Content;simulationConfirmation?:Omit<import('../../contracts/wiki/schema').Knowledge['simulationConfirmation'] & {},'contentDigest'>}):void};
 fence:{capture(input:{producerId:string;inputs:{owner:string;objectId:string;revision?:number}[];targets:{owner:string;objectId:string}[]}):FenceToken;assert(token:FenceToken):void;revoke(producerId:string):void};
 humanAllowed():boolean;
}
export interface DispatchIntent {operationId:string;taskId:string;manifest:Manifest;manifestDigest:string;reservation:Budget}
export type TrustedActor='human'|'ai'|'external';

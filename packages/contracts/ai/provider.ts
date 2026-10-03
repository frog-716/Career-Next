import type {Manifest,ProviderOutput} from './schema';
export interface ProviderAdapter {
 readonly recipient:Manifest['recipient'];
 readonly network:'none'|'external';
 /** Exactly one handoff. Adapters must not retry, select sources, or write business state. */
 send(input:{operationId:string;manifest:Manifest;manifestDigest:string},signal:AbortSignal):Promise<unknown>;
}

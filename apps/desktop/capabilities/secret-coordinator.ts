import {SecretInput,type SecretBridge} from '../../../packages/contracts/ai/secret-input';
import type {ProviderBinding} from '../../../packages/backend/platform/providers/binding';
/** Main-only coordination between credential persistence and the private dispatch gate. */
export function createSecretCoordinator(vault:SecretBridge,configure:(binding:ProviderBinding)=>Promise<void>):SecretBridge{
 let epoch=0,mutations=Promise.resolve();
 return {async request(input){
  const parsed=SecretInput.safeParse(input);if(!parsed.success)return {kind:'failure',code:'invalid_request'};
  if((parsed.data.operation==='status'||parsed.data.operation==='check'||parsed.data.operation==='cancel'))return vault.request(parsed.data);
  // Mint at intent arrival, before either the control acknowledgement or vault wait.
  const intent=++epoch;
  const closed=configure({enabled:false,generation:'fake-v1'});
  // Observe failure immediately even while an earlier vault mutation is still pending.
  void closed.catch(()=>{});
  const job=mutations.then(async()=>{
   await closed;
   const result=await vault.request(parsed.data);
   if(intent===epoch&&result.kind==='status'&&result.status.enabled&&result.status.generation)await configure({enabled:true,generation:result.status.generation,...result.status.provider?{provider:result.status.provider}:{}});
   return result;
  });
  // Mutations follow arrival order, not asynchronous control acknowledgement order.
  mutations=job.then(()=>{},()=>{});
  return job;
 }};
}

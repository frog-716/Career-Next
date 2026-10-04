import {SecretInput,type SecretBridge} from '../../../packages/contracts/ai/secret-input';
/** Close admission at mutation intent, including new requests arriving while vault work is queued. */
export function createTavilyCredentials(vault:SecretBridge,invalidate:()=>Promise<void>){
 let admitted=true,epoch=0,mutations=Promise.resolve();
 return {async generationForDispatch(){if(!admitted)throw Error('credential_unavailable');const intent=epoch,result=await vault.request({operation:'status'});if(!admitted||intent!==epoch||result.kind!=='status'||!result.status.enabled||!result.status.configured||!result.status.generation)throw Error('credential_unavailable');return result.status.generation;},
 async request(input:Parameters<SecretBridge['request']>[0]):ReturnType<SecretBridge['request']>{const parsed=SecretInput.safeParse(input);if(!parsed.success||parsed.data.operation==='save'&&parsed.data.provider)return {kind:'failure',code:'invalid_request'};if((parsed.data.operation==='status'||parsed.data.operation==='check'||parsed.data.operation==='cancel'))return vault.request(parsed.data);
  admitted=false;const intent=++epoch,closed=invalidate();void closed.catch(()=>{});
  const job=mutations.then(async()=>{await closed;const result=await vault.request(parsed.data);if(intent===epoch&&result.kind==='status')admitted=result.status.enabled&&result.status.configured;return result;});mutations=job.then(()=>{},()=>{});return job;
 }};
}

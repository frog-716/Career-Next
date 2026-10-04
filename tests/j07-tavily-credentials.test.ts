import {it,expect} from 'vitest';import {randomUUID} from 'node:crypto';
import {createTavilyCredentials} from '../apps/desktop/capabilities/tavily-credentials';
import type {SecretBridge} from '../packages/contracts/ai/secret-input';
it('blocks new dispatch credential admission throughout queued mutation and after failed revoke acknowledgement',async()=>{
 const generation=randomUUID();let enabled=true,release!:()=>void,mutations=0,statusReads=0;
 const vault:SecretBridge={async request(input){if(input.operation==='status'){statusReads++;return {kind:'status',status:{configured:true,enabled,generation}};}mutations++;enabled=input.operation==='save';return {kind:'status',status:{configured:true,enabled,generation}};}};
 const credentials=createTavilyCredentials(vault,()=>new Promise(resolve=>release=resolve));expect(await credentials.generationForDispatch()).toBe(generation);const pending=credentials.request({operation:'disable'});await expect(credentials.generationForDispatch()).rejects.toThrow('credential_unavailable');expect(mutations).toBe(0);expect(statusReads).toBe(1);release();await pending;await expect(credentials.generationForDispatch()).rejects.toThrow('credential_unavailable');
 const saved=credentials.request({operation:'save',value:'SYNTHETIC'});await expect(credentials.generationForDispatch()).rejects.toThrow('credential_unavailable');release();await saved;expect(await credentials.generationForDispatch()).toBe(generation);
 const failed=createTavilyCredentials(vault,async()=>{throw Error('control failed');});await expect(failed.request({operation:'disable'})).rejects.toThrow('control failed');await expect(failed.generationForDispatch()).rejects.toThrow('credential_unavailable');expect(enabled).toBe(true);
});

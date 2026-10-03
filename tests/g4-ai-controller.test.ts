import {expect,it} from 'vitest';
import {createAiController,type AiWriterControllerPort} from '../packages/backend/ai-runtime/controller';
import type {DispatchIntent} from '../packages/backend/ai-runtime/ports';
import type {ProviderAdapter} from '../packages/contracts/ai/provider';
import {inheritProvenance} from '../packages/backend/ai-runtime/provenance';
const recipient={service:'deterministic-fake',endpoint:'local://career-wiki-fake',account:'local-no-credential',generation:'fake-v1',model:'wiki-organizer-v1'} as const;
it('stop closes utility handoff immediately even when the writer intent is still blocked',async()=>{
 let release!:(value:DispatchIntent)=>void;const calls:string[]=[];const writer:AiWriterControllerPort={prepareDispatch:()=>new Promise(resolve=>{release=resolve;}),markProcessing:async()=>{calls.push('processing');},settle:async()=>{calls.push('settle');},markUnknown:async()=>{calls.push('unknown');},failOperation:async()=>{},cancelBeforeHandoff:async()=>{calls.push('not_sent');},stop:async()=>{calls.push('stop');}};
 const adapter:ProviderAdapter={recipient,network:'none',send:async()=>{calls.push('send');return {proposals:[]};}};
 const controller=createAiController(writer,adapter),pending=controller.start('task','operation');await controller.stop('task','stop');
 release({operationId:'operation',taskId:'task',manifest:{recipient} as DispatchIntent['manifest'],manifestDigest:'digest',reservation:{requests:1,inputBytes:100,outputBytes:100}});await pending;expect(calls).toEqual(['stop','not_sent']);
});
it('summary -> cached summary inherits sensitive actual A even if a provider only cites public B',()=>{
 const a={owner:'materials',objectId:'A',revision:1,scope:'personal',kind:'simulation',restrictions:{read:true,egress:false}};
 const b={owner:'materials',objectId:'B',revision:1,scope:'public',kind:'user_record',restrictions:{read:true,egress:true}};
 const summary=inheritProvenance([[a],[b]]),cached=inheritProvenance([summary]);expect(cached).toEqual([a,b]);expect(cached[0]?.restrictions.egress).toBe(false);expect(cached[0]?.kind).toBe('simulation');
});

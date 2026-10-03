import {expect,it} from 'vitest';
import {createAiController,type AiWriterControllerPort} from '../packages/backend/ai-runtime/controller';
import type {DispatchIntent} from '../packages/backend/ai-runtime/ports';
import type {ProviderAdapter} from '../packages/contracts/ai/provider';
import type {ProviderOutput} from '../packages/contracts/ai/schema';
import {inheritProvenance} from '../packages/backend/ai-runtime/provenance';
const recipient={service:'deterministic-fake',endpoint:'local://career-wiki-fake',account:'local-no-credential',generation:'fake-v1',model:'wiki-organizer-v1'} as const;
it('stop closes utility handoff immediately even when the writer intent is still blocked',async()=>{
 let release!:(value:DispatchIntent)=>void;const calls:string[]=[];const writer:AiWriterControllerPort={prepareDispatch:()=>new Promise(resolve=>{release=resolve;}),markProcessing:async()=>{calls.push('processing');},settle:async()=>{calls.push('settle');},markUnknown:async()=>{calls.push('unknown');},failOperation:async()=>{},cancelBeforeHandoff:async()=>{calls.push('not_sent');},stop:async()=>{calls.push('stop');}};
 const adapter:ProviderAdapter={recipient,network:'none',send:async()=>{calls.push('send');return {proposals:[]};}};
 const controller=createAiController(writer,adapter),pending=controller.start('task','operation');await controller.stop('task','stop');
 release({operationId:'operation',taskId:'task',manifest:{recipient} as DispatchIntent['manifest'],manifestDigest:'digest',reservation:{requests:1,inputBytes:100,outputBytes:100}});await pending;expect(calls).toEqual(['stop','not_sent']);
});
it('a purge of actual A closes dispatch while its intent is still waiting, without closing unrelated B',async()=>{
 let release!:(value:DispatchIntent)=>void;const calls:string[]=[];
 const writer:AiWriterControllerPort={prepareDispatch:()=>new Promise(resolve=>{release=resolve;}),markProcessing:async()=>{},settle:async()=>{},markUnknown:async()=>{},failOperation:async()=>{},cancelBeforeHandoff:async()=>{calls.push('not_sent');},stop:async()=>{}};
 const adapter:ProviderAdapter={recipient,network:'none',send:async()=>{calls.push('send');return {proposals:[]};}};
 const controller=createAiController(writer,adapter),pending=controller.start('task','operation');controller.revokeReferences([{owner:'materials',objectId:'A'}]);
 release({operationId:'operation',taskId:'task',manifest:{recipient,target:{scope:'personal'},provenance:[{owner:'materials',objectId:'A'}]} as DispatchIntent['manifest'],manifestDigest:'digest',reservation:{requests:1,inputBytes:100,outputBytes:100}});await pending;expect(calls).toEqual(['not_sent']);
 const independent=controller.start('other-task','other-operation');release({operationId:'other-operation',taskId:'other-task',manifest:{recipient,target:{scope:'personal'},provenance:[{owner:'materials',objectId:'B'}]} as DispatchIntent['manifest'],manifestDigest:'digest',reservation:{requests:1,inputBytes:100,outputBytes:100}});await independent;expect(calls).toEqual(['not_sent','send']);
});
it('summary -> cached summary inherits sensitive actual A even if a provider only cites public B',()=>{
 const a={owner:'materials',objectId:'A',revision:1,scope:'personal',kind:'simulation',restrictions:{read:true,egress:false}};
 const b={owner:'materials',objectId:'B',revision:1,scope:'public',kind:'user_record',restrictions:{read:true,egress:true}};
 const summary=inheritProvenance([[a],[b]]),cached=inheritProvenance([summary]);expect(cached).toEqual([a,b]);expect(cached[0]?.restrictions.egress).toBe(false);expect(cached[0]?.kind).toBe('simulation');
});
it('a failed purge pause requires a new operation authorization and cannot reopen a late A through B authorization',async()=>{
 const releases=new Map<string,(value:DispatchIntent)=>void>(),sent:string[]=[],canceled:string[]=[];
 const writer:AiWriterControllerPort={prepareDispatch:id=>new Promise(resolve=>releases.set(id,resolve)),markProcessing:async()=>{},settle:async()=>{},markUnknown:async()=>{},failOperation:async()=>{},cancelBeforeHandoff:async id=>{canceled.push(id);},stop:async()=>{}};
 const controller=createAiController(writer,{recipient,network:'none',send:async request=>{sent.push(request.operationId);return {proposals:[]};}});
 const intent=(id:string,source:string):DispatchIntent=>({operationId:id,taskId:'task',manifest:{recipient,target:{scope:'personal'},provenance:[{owner:'materials',objectId:source}]} as DispatchIntent['manifest'],manifestDigest:'digest',reservation:{requests:1,inputBytes:100,outputBytes:100}});
 const priorConfirmation=controller.captureAuthorization();controller.openAfterAuthorization('task','old-A',priorConfirmation);const old=controller.start('task','old-A');const pause=controller.pauseReferences([{owner:'materials',objectId:'A'}]);
 // Replayed authorization receipts cannot upgrade the already-running old handoff.
 controller.openAfterAuthorization('task','old-A');
 controller.openAfterAuthorization('task','new-B');const independent=controller.start('task','new-B');releases.get('new-B')!(intent('new-B','B'));await independent;releases.get('old-A')!(intent('old-A','A'));await old;expect(sent).toEqual(['new-B']);expect(canceled).toEqual(['old-A']);
 const noConfirmation=controller.start('task','unconfirmed-A');releases.get('unconfirmed-A')!(intent('unconfirmed-A','A'));await noConfirmation;expect(canceled).toContain('unconfirmed-A');
 controller.openAfterAuthorization('task','delayed-confirmation',priorConfirmation);const delayed=controller.start('task','delayed-confirmation');releases.get('delayed-confirmation')!(intent('delayed-confirmation','A'));await delayed;expect(canceled).toContain('delayed-confirmation');
 const whilePaused=controller.captureAuthorization();controller.openAfterAuthorization('task','during-purge',whilePaused);const during=controller.start('task','during-purge');releases.get('during-purge')!(intent('during-purge','A'));await during;expect(canceled).toContain('during-purge');const overlapping=controller.pauseReferences([{owner:'materials',objectId:'A'}]);controller.finishPause(pause);
 controller.openAfterAuthorization('task','overlap',controller.captureAuthorization());const overlap=controller.start('task','overlap');releases.get('overlap')!(intent('overlap','A'));await overlap;expect(canceled).toContain('overlap');controller.finishPause(overlapping);
 controller.openAfterAuthorization('task','premature-confirmation',whilePaused);const premature=controller.start('task','premature-confirmation');releases.get('premature-confirmation')!(intent('premature-confirmation','A'));await premature;expect(canceled).toContain('premature-confirmation');
 controller.openAfterAuthorization('task','new-A',controller.captureAuthorization());const fresh=controller.start('task','new-A');releases.get('new-A')!(intent('new-A','A'));await fresh;expect(sent).toEqual(['new-B','new-A']);
 controller.revokeReferences([{owner:'materials',objectId:'A'}]);controller.openAfterAuthorization('task','after-purge');const purged=controller.start('task','after-purge');releases.get('after-purge')!(intent('after-purge','A'));await purged;expect(sent).toEqual(['new-B','new-A']);expect(canceled).toContain('after-purge');
});
it('a provider ignoring abort cannot persist its late body after synchronous source pause',async()=>{
 let respond!:(value:ProviderOutput)=>void;const calls:string[]=[];
 const intent={operationId:'operation',taskId:'task',manifest:{recipient,target:{scope:'personal'},provenance:[{owner:'materials',objectId:'A'}]} as DispatchIntent['manifest'],manifestDigest:'digest',reservation:{requests:1,inputBytes:100,outputBytes:100}};
 const writer:AiWriterControllerPort={prepareDispatch:async()=>intent,markProcessing:async()=>{},settle:async()=>{calls.push('persist');},markUnknown:async()=>{calls.push('unknown');},failOperation:async()=>{},cancelBeforeHandoff:async()=>{},stop:async()=>{}};
 const controller=createAiController(writer,{recipient,network:'none',send:()=>new Promise(resolve=>{calls.push('send');respond=resolve;})}),pending=controller.start('task','operation');await Promise.resolve();
 controller.pauseReferences([{owner:'materials',objectId:'A'}]);respond({proposals:[{kind:'create',content:{title:'迟到内容',body:'late private body',nature:'hypothesis'},reason:'迟到结果',citations:[],unknowns:[]}]});await pending;expect(calls).toEqual(['send','unknown']);
});

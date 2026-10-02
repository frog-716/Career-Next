import { randomUUID } from 'node:crypto';
import type { Identity } from '../../../contracts/common/runtime';
export type HumanSession = Identity & {actor: {kind: 'human'; token: string}};
export function createSessions(workspaceInstance: string, backendGeneration: string) {
 const sessions = new Map<string,string>();
 return {
  connect(): HumanSession {
   const connectionGeneration=randomUUID(),token=randomUUID();
   sessions.clear(); sessions.set(connectionGeneration,token);
   return {protocolVersion:1,workspaceInstance,backendGeneration,connectionGeneration,actor:{kind:'human',token}};
  },
  check(session: HumanSession) {
   if(session.workspaceInstance!==workspaceInstance||session.backendGeneration!==backendGeneration||session.actor?.kind!=='human'||sessions.get(session.connectionGeneration)!==session.actor.token)throw Error('invalid_capability');
  },
 };
}
export type SessionAuthority = ReturnType<typeof createSessions>;

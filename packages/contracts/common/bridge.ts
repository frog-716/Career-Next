import type { Identity } from '../materials/schema';
export type BusinessModule = 'wiki' | 'employment' | 'project' | 'opportunity' | 'resume' | 'profile';
/** Owner schemas validate each input and result on both sides of this bounded bridge. */
export interface CareerBridge {
  ready(): Promise<Identity>;
  reconnect(): Promise<Identity>;
  request(module: BusinessModule, input: unknown): Promise<unknown>;
}
declare global { interface Window { career: CareerBridge } }

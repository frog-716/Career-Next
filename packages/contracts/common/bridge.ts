import type { Identity } from '../materials/schema.ts';
import type { BusinessModule } from '../generated/registry';
export type { BusinessModule } from '../generated/registry';
/** Owner schemas validate each input and result on both sides of this bounded bridge. */
export interface CareerBridge {
  onPurge?(callback:(notice:import('../application/schema').PurgeNotification)=>void):()=>void;
  ready(): Promise<Identity>;
  reconnect(): Promise<Identity>;
  request(module: BusinessModule, input: unknown): Promise<unknown>;
}
declare global { interface Window { career: CareerBridge } }

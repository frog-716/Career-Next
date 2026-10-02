import { z } from 'zod';
import {allManifests,moduleNames,type BusinessModule} from './generated/registry.ts';
export const BusinessModuleSchema=z.enum(moduleNames);
export const businessManifests=allManifests.filter(manifest=>manifest.module!=='materials');
const manifests=new Map<string,{schemas:{request:z.ZodType;result:z.ZodType}}>(businessManifests.map(item=>[item.module,item]));
export function parseBusinessRequest(module:BusinessModule,input:unknown){const manifest=manifests.get(module);if(!manifest)throw Error('invalid_request');return manifest.schemas.request.parse(input);}
export function parseBusinessResult(module:BusinessModule,input:unknown){const manifest=manifests.get(module);if(!manifest)throw Error('invalid_request');return manifest.schemas.result.parse(input);}

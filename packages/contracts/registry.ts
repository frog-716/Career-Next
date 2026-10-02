import { z } from 'zod';
import { employmentManifest } from './employment/manifest.ts';
import { wikiManifest } from './wiki/manifest.ts';
import type { BusinessModule } from './common/bridge';
export const BusinessModuleSchema=z.enum(['wiki','employment','project','opportunity','resume','profile']);
export const businessManifests=[wikiManifest,employmentManifest];
const manifests=new Map<string,{schemas:{request:z.ZodType;result:z.ZodType}}>(businessManifests.map(item=>[item.module,item]));
export function parseBusinessRequest(module:BusinessModule,input:unknown){const manifest=manifests.get(module);if(!manifest)throw Error('invalid_request');return manifest.schemas.request.parse(input);}
export function parseBusinessResult(module:BusinessModule,input:unknown){const manifest=manifests.get(module);if(!manifest)throw Error('invalid_request');return manifest.schemas.result.parse(input);}

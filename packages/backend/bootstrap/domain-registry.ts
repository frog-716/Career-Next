import type Database from 'better-sqlite3';
import { createEmploymentDomain } from '../domains/employment/public';
import { createWikiDomain } from '../domains/wiki/public';
import type { Store } from '../domains/materials/store';
import type { BusinessModule } from '../../contracts/common/bridge';
import { parseBusinessRequest,parseBusinessResult } from '../../contracts/registry';
export function composeDomains(db:Database.Database,materials:Store){
 const wiki=createWikiDomain(db,{resolveSource:materials.resolveSourceMetadata});
 const employment=createEmploymentDomain(db);
 const modules:Partial<Record<BusinessModule,{handle(input:unknown):unknown}>>={wiki,employment};
 return {handle(module:BusinessModule,input:unknown){const owner=modules[module];if(!owner)throw Error('invalid_request');return parseBusinessResult(module,owner.handle(parseBusinessRequest(module,input)));}};
}

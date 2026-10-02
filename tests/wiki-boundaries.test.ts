import { expect,it } from 'vitest';
import { Request,Result } from '../packages/contracts/wiki/schema';
it('Wiki request boundary cannot claim verified truth, spoof actor, accept paths or unsupported source versions',()=>{
 const valid={operation:'create',commandId:crypto.randomUUID(),title:'记录',body:'用户手工记录',scope:'personal',nature:'fact_statement',sources:[]};
 expect(Request.safeParse(valid).success).toBe(true);
 for(const patch of [{actor:'human'},{verified:true},{path:'/tmp/raw.txt'},{scope:'opportunity'},{nature:'verified_fact'},{sources:[{ref:{owner:'materials',objectId:crypto.randomUUID(),revision:2,locator:'whole',scope:'personal'},purpose:'unsupported'}]}])expect(Request.safeParse({...valid,...patch}).success).toBe(false);
 expect(Result.safeParse({kind:'failure',code:'storage_failed',sql:'secret SQL'}).success).toBe(false);
});

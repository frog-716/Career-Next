import {expect,it} from 'vitest';
import {Request,Result} from '../packages/contracts/opportunity/schema';
it('core contract rejects arbitrary phase/result setters, accepted without Offer basis, actor spoofing and invalid business dates',()=>{
 const id=crypto.randomUUID();const base={operation:'record-stage',commandId:crypto.randomUUID(),id,expectedRevision:1,stage:'interview',reason:'现实发生',businessTime:{kind:'unknown'}};
 expect(Request.safeParse(base).success).toBe(true);for(const patch of [{result:'accepted'},{phase:'offer'},{actor:'human'},{businessTime:{kind:'date',date:'2026-02-30'}},{sql:'SELECT arbitrary'}])expect(Request.safeParse({...base,...patch}).success).toBe(false);
 expect(Request.safeParse({...base,operation:'end',outcome:'accepted'}).success).toBe(false);expect(Result.safeParse({kind:'failure',code:'storage_failed',stack:'backend internals'}).success).toBe(false);
});

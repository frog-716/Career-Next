import {it,expect} from 'vitest';
import {Request,CareerDocument} from '../packages/contracts/resume/schema';
import {randomUUID} from 'node:crypto';
it('renderer cannot claim actor, attach a PDF artifact, or persist identity in current Resume content',()=>{
 const request={operation:'resume.name-version',commandId:randomUUID(),resumeId:randomUUID(),expectedRevision:1,expectedProfileRevision:1,name:'reviewed'};
 expect(Request.safeParse({...request,actor:'human'}).success).toBe(false);
 expect(Request.safeParse({...request,pdf:{blobId:randomUUID(),size:42,digest:'a'.repeat(64)}}).success).toBe(false);
 expect(CareerDocument.safeParse({schemaVersion:2,sections:[],layout:{template:'a4-basic',fontSize:12,identityPosition:'top'}}).success).toBe(false);
 const content={schemaVersion:1,sections:[{id:randomUUID(),kind:'summary',title:'Summary',blocks:[]}],layout:{template:'a4-basic',fontSize:12,identityPosition:'top'}};
 expect(CareerDocument.safeParse({...content,identity:{name:'competing current identity'}}).success).toBe(false);
});

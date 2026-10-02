import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {Request} from '../packages/contracts/employment/schema';
it('employment command boundary rejects actor claims, arbitrary storage input, invalid dates and person reassignment',()=>{
 const input={operation:'create',commandId:crypto.randomUUID(),company:'公司',role:'职务',goal:'',started:true,start:{kind:'unknown'},plannedEnd:{kind:'unknown'}};
 expect(Request.safeParse({...input,actor:'human'}).success).toBe(false);
expect(Request.safeParse({...input,sql:'arbitrary SQL'}).success).toBe(false);
expect(Request.safeParse({...input,start:{kind:'date',date:'2024-02-30'}}).success).toBe(false);
 expect(Request.safeParse({...input,started:false}).success).toBe(false);
 const person={operation:'person.edit',commandId:crypto.randomUUID(),id:crypto.randomUUID(),employmentId:crypto.randomUUID(),expectedRevision:1,name:'名字',role:'职责',mode:'correction',reason:'错字',occurredAt:{kind:'unknown'}};
 expect(Request.safeParse({...person,newEmploymentId:crypto.randomUUID()}).success).toBe(false);
});
it('employment frontend uses contracts and public backend exposes no foreign SQL or repositories',()=>{
 const ui=readFileSync('packages/frontend/features/employment/index.tsx','utf8');
const backend=readFileSync('packages/backend/domains/employment/public.ts','utf8');
 expect(ui).not.toMatch(/from ['"].*(?:backend|node:|better-sqlite3)/);expect(backend).not.toMatch(/(?:FROM|INTO|UPDATE|REFERENCES) (?:project_|opportunity_|wiki_|materials_)/i);
 expect(backend).not.toMatch(/from ['"].*domains\/(?:project|wiki|opportunity|resume)\//);
});

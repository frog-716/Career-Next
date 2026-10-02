import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {Request} from '../packages/contracts/project/schema';
it('project contracts reject supplied owner facts, arbitrary SQL and renderer actor claims',()=>{
 const command={operation:'create',commandId:crypto.randomUUID(),name:'项目',description:'',tags:[],employmentId:null,occurredAt:{kind:'unknown'}};
 for(const extra of [{actor:'human'},{sql:'arbitrary SQL'},{employmentCompany:'私有复制'},{personName:'伪造身份'}])expect(Request.safeParse({...command,...extra}).success).toBe(false);
});
it('project only imports employment public DTOs and owns its SQL',()=>{
 const backend=readFileSync('packages/backend/domains/project/public.ts','utf8');const frontend=readFileSync('packages/frontend/features/project/index.tsx','utf8');
 expect(backend).not.toMatch(/from ['"].*domains\/employment/);
 expect(backend).not.toMatch(/(?:FROM|INTO|UPDATE|REFERENCES) (?:employment_|opportunity_|wiki_|materials_)/i);
 expect(frontend).not.toMatch(/from ['"].*(?:backend|node:|better-sqlite3)/);
});

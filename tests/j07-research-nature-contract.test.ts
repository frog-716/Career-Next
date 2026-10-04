import {expect,it} from 'vitest';
import {Content} from '../packages/contracts/ai/protocol';
import {ResearchProposalContent} from '../packages/contracts/ai/product';
import {Nature} from '../packages/contracts/opportunity/research/schema';

it('Research AI content narrows the generic nature contract without removing observation from other tasks',()=>{
 const content={title:'TEST DATA',body:'Fictional statement.'};
 expect(ResearchProposalContent.safeParse({...content,nature:'fact_statement'}).success).toBe(true);
 expect(ResearchProposalContent.safeParse({...content,nature:'hypothesis'}).success).toBe(true);
 expect(ResearchProposalContent.safeParse({...content,nature:'observation'}).success).toBe(false);
 expect(Content.safeParse({...content,nature:'observation'}).success).toBe(true);
});

it('the missing AI unknown nature is explicit rather than disguised as hypothesis or free-text unknowns',()=>{
 const content={title:'TEST DATA',body:'Unknown requirements.',nature:'unknown'};
 expect(Nature.safeParse('unknown').success).toBe(true);
 expect(Content.safeParse(content).success).toBe(false);
 expect(ResearchProposalContent.safeParse(content).success).toBe(false);
});

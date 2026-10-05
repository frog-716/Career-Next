import type {OpportunityView} from '../../../contracts/opportunity/schema';
import './opportunity.css';
export const sections=[['overview','概览'],['resume','简历'],['research','情报'],['communication','沟通'],['interview','面试'],['offer','Offer']] as const;
export type {OpportunitySection} from '../../shell/routes';
import type {OpportunitySection} from '../../shell/routes';
export const phaseLabel={preparation:'投递准备',submitted:'已投递',interview:'面试',offer:'Offer'};
export const resultLabel={active:'进行中',accepted:'接受 Offer',withdrawn:'用户退出',recruiter_ended:'招聘方终止'};
export function OpportunityHeader({opportunity,section,onSection,onList}:{opportunity:OpportunityView;section:OpportunitySection;onSection(section:OpportunitySection):void;onList():void}){
 return <header className="opportunity-header"><button onClick={onList}>返回机会列表</button><h1>{opportunity.companyName} · {opportunity.role}</h1><p>当前阶段：{phaseLabel[opportunity.phase]} · 当前结果：{resultLabel[opportunity.result]}</p><nav aria-label="机会分区" className="opportunity-sections">{sections.map(([id,label])=><button key={id} aria-current={section===id?'page':undefined} onMouseDown={event=>event.preventDefault()} onClick={()=>onSection(id)}>{label}</button>)}</nav></header>;
}

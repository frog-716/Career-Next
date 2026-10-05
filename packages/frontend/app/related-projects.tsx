import {useQuery} from '@tanstack/react-query';
import {Result,type Request} from '../../contracts/project/schema';
/** Read-only composition of existing Project relations; each owner remains authoritative. */
export function RelatedProjects({employmentId,personId,epoch,request,onOpen,onManage}:{employmentId:string;personId?:string;epoch:number;request:(input:Request)=>Promise<unknown>;onOpen(id:string):void;onManage():void}){
 const query=useQuery({queryKey:['related-projects',employmentId,personId,epoch],retry:false,queryFn:async()=>{
  const list=Result.parse(await request({operation:'list'}));if(list.kind!=='list')throw Error();
  if(!personId)return list.projects.filter(project=>project.employmentId===employmentId);
  const details=await Promise.all(list.projects.map(async project=>{const value=Result.parse(await request({operation:'read',id:project.id}));return value.kind==='project'&&value.participants.some(person=>person.personId===personId&&person.employmentId===employmentId)?project:undefined;}));
  return details.filter(project=>project!==undefined);
 }});
 return <div aria-label="相关项目列表">{query.isPending?<p>正在读取相关项目…</p>:query.isError?<p role="alert">相关项目暂时不可读。<button onClick={()=>void query.refetch()}>刷新</button></p>:query.data?.length?<ul>{query.data.map(project=><li key={project.id}><button onClick={()=>onOpen(project.id)}>{project.name}</button></li>)}</ul>:<p>尚未关联项目。</p>}<button onClick={onManage}>管理项目关联</button><p>可在项目中选择所属任职，再记录真实参与人物。</p></div>;
}

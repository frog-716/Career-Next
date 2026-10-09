import {useState,type ReactNode} from 'react';
import {FeishuMaterialsPicker} from './FeishuMaterialsPicker';
import type {Raw} from '../../../contracts/materials/schema';
export function MaterialSources({local,onUse}:{local:ReactNode;onUse?:(raw:Raw)=>void}){
 const [source,setSource]=useState<'local'|'feishu'>(()=>sessionStorage.getItem('career-material-source')==='feishu'?'feishu':'local');
 function choose(value:'local'|'feishu'){setSource(value);sessionStorage.setItem('career-material-source',value);}
 return <section className="material-source-flow" aria-label="添加资料"><h2>添加资料</h2><ol className="material-flow-steps" aria-label="资料保存流程"><li>选择来源</li><li>选择资料</li><li>查看内容</li><li>保存</li></ol><div className="material-source-tabs" aria-label="资料来源"><button className="button" aria-pressed={source==='local'} onClick={()=>choose('local')}>本地文件</button><button className="button" aria-pressed={source==='feishu'} onClick={()=>choose('feishu')}>飞书</button></div><div hidden={source!=='local'}>{local}</div><div hidden={source!=='feishu'}>{source==='feishu'&&<FeishuMaterialsPicker onUse={onUse}/>}</div></section>;
}

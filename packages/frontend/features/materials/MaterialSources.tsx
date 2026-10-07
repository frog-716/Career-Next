import {useState,type ReactNode} from 'react';
import {FeishuMaterialsPicker} from './FeishuMaterialsPicker';
export function MaterialSources({local}:{local:ReactNode}){
 const [source,setSource]=useState<'local'|'feishu'>('local');
 return <section aria-label="添加资料"><h2>添加资料</h2><div className="material-source-tabs" aria-label="资料来源"><button className="button" aria-pressed={source==='local'} onClick={()=>setSource('local')}>本地文件</button><button className="button" aria-pressed={source==='feishu'} onClick={()=>setSource('feishu')}>飞书</button></div><div hidden={source!=='local'}>{local}</div>{source==='feishu'&&<FeishuMaterialsPicker/>}</section>;
}

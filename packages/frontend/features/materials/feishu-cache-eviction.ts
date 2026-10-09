import {useEffect,useRef} from 'react';
import {FeishuCacheEviction} from '../../../contracts/platform/feishu-cache-eviction';
export function useFeishuCacheEviction(evict:(notice:FeishuCacheEviction)=>void){
 const current=useRef(evict);current.current=evict;
 useEffect(()=>{const receive=(event:Event)=>{const parsed=FeishuCacheEviction.safeParse((event as CustomEvent).detail);if(parsed.success)current.current(parsed.data);};window.addEventListener('career-feishu-cache-evicted',receive);return()=>window.removeEventListener('career-feishu-cache-evicted',receive);},[]);
}

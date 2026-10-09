import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {FeishuCacheEviction} from '../packages/contracts/platform/feishu-cache-eviction';
import {PurgeNotification} from '../packages/contracts/application/schema';
it('a valid large owner purge can also notify connector caches without failing after the purge commits',()=>{
 const ids=Array.from({length:2001},()=>randomUUID());
 expect(PurgeNotification.safeParse({workspaceInstance:randomUUID(),references:ids.map(objectId=>({owner:'materials',objectId}))}).success).toBe(true);
 expect(FeishuCacheEviction.safeParse({kind:'feishu_cache_evicted',materialIds:ids,previewRefs:[],recordRefs:[],all:true}).success).toBe(true);
});

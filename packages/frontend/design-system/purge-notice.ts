/** UI invalidation notice after a confirmed backend purge; it carries no authority. */
export interface PurgeNotice {sequence:number;references:{owner:string;objectId:string}[]}
export function wasPurged(notice:PurgeNotice|undefined,owner:string,id?:string){return !!id&&!!notice?.references.some(ref=>ref.owner===owner&&ref.objectId===id);}

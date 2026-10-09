import {execFile as nodeExecFile} from 'node:child_process';
import {promisify} from 'node:util';
import {access,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {z} from 'zod';
import type {FeishuDocumentReadPorts,DocumentBlock} from './document';
export type FeishuDocumentCliRun=(args:string[],signal:AbortSignal)=>Promise<{stdout:string;code:number;failure?:'authorization'|'permission'|'unavailable'}>;
const execFile=promisify(nodeExecFile),Token=z.string().regex(/^[A-Za-z0-9]{16,128}$/);
const Block=z.strictObject({id:z.string().min(1).max(200),parentId:z.string().max(200),type:z.number().int().positive(),children:z.array(z.string().min(1).max(200)).max(500),text:z.string().max(200001),done:z.boolean().nullable().optional()});
export const documentProjections={
 metadata:'{ok:.ok,data:{documentToken:.data.document.document_id,title:.data.document.title,revision:.data.document.revision_id}}',
 wiki:'{ok:.ok,data:{documentToken:.data.obj_token,type:.data.obj_type,title:.data.title}}',
 legacy:'{ok:.ok,data:{documentToken:(.data.upgraded_token // null)}}',
 blocks:`def elements: [.[]? | if .text_run then .text_run.content elif .mention_user then "[提及用户未展开]" elif .mention_doc then "[关联文档未展开]" elif .equation then "[公式未展开]" elif .inline_block then "[内嵌内容未展开]" else "[不支持的行内内容]" end] | join("");
 {ok:.ok,data:{hasMore:.data.has_more,pageToken:(.data.page_token // null),items:[.data.items[]? | {id:.block_id,parentId:(.parent_id // ""),type:.block_type,children:(.children // []),text:((.text.elements // .heading1.elements // .heading2.elements // .heading3.elements // .heading4.elements // .heading5.elements // .heading6.elements // .heading7.elements // .heading8.elements // .heading9.elements // .bullet.elements // .ordered.elements // .code.elements // .quote.elements // .todo.elements // [] | elements)[0:200001])} + (if .block_type==17 then {done:(if (.todo.style.done | type)=="boolean" then .todo.style.done else null end)} else {} end)]}}`,
};
async function defaultRunner(args:string[],signal:AbortSignal):ReturnType<FeishuDocumentCliRun>{
 signal.throwIfAborted();const candidates=[process.env.CAREER_LARK_CLI,path.join(os.homedir(),'.local/bin/lark-cli'),'/opt/homebrew/bin/lark-cli','/usr/local/bin/lark-cli'].filter((v):v is string=>!!v);
 let binary:string|undefined;for(const candidate of candidates){try{await access(candidate);binary=candidate;break;}catch{}}if(!binary)throw Error('feishu_cli_unavailable');
 const target=await realpath(binary).catch(()=>binary!),script=/\.(?:c|m)?js$/i.test(target);
 try{const result=await execFile(script?process.execPath:target,script?[target,...args]:args,{encoding:'utf8',timeout:20_000,maxBuffer:2*1024*1024,signal,env:{...process.env,LARKSUITE_CLI_NO_UPDATE_NOTIFIER:'1',LARKSUITE_CLI_NO_SKILLS_NOTIFIER:'1'}});return {stdout:result.stdout,code:0};}
 catch(error){signal.throwIfAborted();const value=error as {stdout?:string;stderr?:string;code?:number},clue=(value.stderr??'').toLowerCase();return {stdout:value.stdout??'',code:typeof value.code==='number'?value.code:1,failure:/missing_scope|99991679|permission_denied|1770032|131006/.test(clue)?'permission':/token_expired|invalid_token|unauthorized|need_user_authorization|user_authorization|refresh_token_expired|9999166[1348]/.test(clue)?'authorization':'unavailable'};}
}
/** Fixed GET-only official endpoints. No credentials are read by Career; CLI owns user auth. */
export function createLarkCliDocumentPorts(run:FeishuDocumentCliRun=defaultRunner):FeishuDocumentReadPorts{
 async function read<T>(args:string[],projection:string,schema:z.ZodType<T>,signal:AbortSignal):Promise<T>{
  signal.throwIfAborted();const result=await run([...args,'--as','user','--json','--jq',projection],signal);signal.throwIfAborted();
  if(result.code!==0)throw Error(result.failure==='permission'?'feishu_document_permission_required':result.failure==='authorization'?'feishu_authorization_required':'feishu_document_unavailable');
  // Whole projected envelope only: malformed/noisy output is a failure, never guessed success.
  try{return z.object({ok:z.literal(true),data:schema}).parse(JSON.parse(result.stdout)).data;}catch{throw Error('feishu_document_response_invalid');}
 }
 return {
  async resolveWiki(token,signal){Token.parse(token);return read(['wiki','+node-get','--node-token',token],documentProjections.wiki,z.strictObject({documentToken:Token,type:z.string().min(1).max(30),title:z.string().min(1).max(1000)}),signal);},
  async resolveLegacy(token,signal){Token.parse(token);const value=await read(['api','GET','/open-apis/doc/v2/meta/'+token],documentProjections.legacy,z.strictObject({documentToken:Token.nullable()}),signal);return value.documentToken?{documentToken:value.documentToken}:undefined;},
  async readMetadata(token,signal){Token.parse(token);return read(['api','GET','/open-apis/docx/v1/documents/'+token],documentProjections.metadata,z.strictObject({documentToken:Token,title:z.string().min(1).max(1000),revision:z.number().int().positive()}),signal);},
  async readBlocks(token,revision,pageToken,signal){Token.parse(token);z.number().int().positive().parse(revision);if(pageToken!==undefined)z.string().min(1).max(4000).parse(pageToken);
   const result=await read(['api','GET','/open-apis/docx/v1/documents/'+token+'/blocks','--params',JSON.stringify({page_size:100,document_revision_id:revision,...pageToken?{page_token:pageToken}:{}})],documentProjections.blocks,z.strictObject({items:z.array(Block).max(100),hasMore:z.boolean(),pageToken:z.string().max(4000).nullable()}),signal);
   return {items:result.items as DocumentBlock[],hasMore:result.hasMore,...result.pageToken?{pageToken:result.pageToken}:{}};
  },
 };
}

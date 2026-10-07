import {z} from 'zod';
import {
 deepSeekConnectionBody,deepSeekConnectionEndpoint,tavilyConnectionBody,tavilyConnectionEndpoint,
 ProviderConnectionTestRequest,ProviderConnectionTestResult,
 type ProviderConnectionTestInput,type ProviderConnectionTestOutput,
} from '../../../contracts/ai/connection-test';

const MAX_RESPONSE_BYTES=64*1024;
const DeepSeekResponse=z.object({model:z.literal('deepseek-flash'),choices:z.array(z.object({message:z.object({content:z.string().max(4096)})})).length(1)});
const TavilyResponse=z.object({query:z.literal(tavilyConnectionBody.query),results:z.array(z.unknown()).max(1)});

function preview(provider:'deepseek'|'tavily'){
 return ProviderConnectionTestResult.parse({kind:'preview',preview:provider==='deepseek'?{
  provider,displayModel:'DeepSeek V4.1-Flash',model:'deepseek-flash',endpoint:deepSeekConnectionEndpoint,method:'POST',body:deepSeekConnectionBody,thinking:'disabled',fallback:false,automaticRetry:false,followRedirects:false,businessDataSent:false,
 }:{provider,endpoint:tavilyConnectionEndpoint,method:'POST',body:tavilyConnectionBody,fallback:false,automaticRetry:false,followRedirects:false,businessDataSent:false}});
}

async function readBounded(response:Response):Promise<string>{
 const reader=response.body?.getReader();if(!reader)throw Error('parse');
 const chunks:Uint8Array[]=[];let bytes=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_RESPONSE_BYTES)throw Error('parse');chunks.push(value);}return Buffer.concat(chunks).toString('utf8');}
 finally{await reader.cancel().catch(()=>{});}
}

function reflected(value:string,key:string){return value.includes(key)||value.includes(JSON.stringify(key).slice(1,-1));}

/** Fixed, stateless connection checks. The trusted host supplies the private Keychain resolver. */
export function createProviderConnectionTester(options:{deepseekKey:(generation:string)=>Promise<string>;tavilyKey:(generation:string)=>Promise<string>;deepseekTransport?:typeof fetch;tavilyTransport?:typeof fetch}){
 const consumed=new Set<string>(),resolving=new Set<string>();
 const deepseekTransport=options.deepseekTransport??fetch,tavilyTransport=options.tavilyTransport??fetch;
 async function run(provider:'deepseek'|'tavily',generation:string):Promise<ProviderConnectionTestOutput>{
  let key:string|undefined,requestCount:0|1=0,httpStatus:number|undefined,failureStage:'credential_resolve'|'connect'|'TLS'|'HTTP auth'|'HTTP response'|'parse'|'already_used'|undefined,responseValid=false,resultCount:number|undefined;
  const slot=provider;
  if(consumed.has(slot))return ProviderConnectionTestResult.parse({kind:'result',provider,status:'failed',requestCount:0,responseValid:false,failureStage:'already_used'});
  try{
   try{key=await (provider==='deepseek'?options.deepseekKey(generation):options.tavilyKey(generation));if(!key||key.length>4096||/[\r\n]/.test(key))throw Error();}
   catch{return ProviderConnectionTestResult.parse({kind:'result',provider,status:'failed',requestCount:0,responseValid:false,failureStage:'credential_resolve'});}
   consumed.add(slot);
   const endpoint=provider==='deepseek'?deepSeekConnectionEndpoint:tavilyConnectionEndpoint;
   const body=JSON.stringify(provider==='deepseek'?deepSeekConnectionBody:tavilyConnectionBody);
   try{
    const response=await (provider==='deepseek'?deepseekTransport:tavilyTransport)(endpoint,{
     method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+key},body,redirect:'error',signal:AbortSignal.timeout(30_000),
    });
    requestCount=1;httpStatus=response.status;
    if(!response.ok){await response.body?.cancel().catch(()=>{});failureStage=response.status===401||response.status===403?'HTTP auth':'HTTP response';}
    else{
     try{
      const text=await readBounded(response);if(reflected(text,key))throw Error('parse');
      const value=JSON.parse(text);
      if(provider==='deepseek'){
       const parsed=DeepSeekResponse.parse(value);if(reflected(JSON.stringify(parsed),key))throw Error('parse');
       const content=JSON.parse(parsed.choices[0]!.message.content) as unknown;
       responseValid=z.object({status:z.literal('ready')}).strict().safeParse(content).success;
      }else{
       const parsed=TavilyResponse.parse(value);if(reflected(JSON.stringify(parsed),key))throw Error('parse');
       responseValid=true;resultCount=parsed.results.length;
      }
      if(!responseValid)failureStage='parse';
     }catch{failureStage='parse';}
    }
   }catch(error){requestCount=1;const code=String((error as {cause?:{code?:unknown}})?.cause?.code??'');failureStage=/CERT|TLS|SSL/i.test(code)?'TLS':'connect';}
   return ProviderConnectionTestResult.parse({kind:'result',provider,status:responseValid?'connected':'failed',requestCount,...httpStatus?{httpStatus}:{},responseValid,...resultCount!==undefined?{resultCount}:{},...failureStage?{failureStage}:{}});
  }finally{key=undefined;}
 }
 return {request(input:ProviderConnectionTestInput,generation:()=>Promise<string|undefined>):Promise<ProviderConnectionTestOutput>{
  const parsed=ProviderConnectionTestRequest.parse(input);
  if(parsed.operation==='preview')return Promise.resolve(preview(parsed.provider));
  if(resolving.has(parsed.provider)||consumed.has(parsed.provider))return Promise.resolve(ProviderConnectionTestResult.parse({kind:'result',provider:parsed.provider,status:'failed',requestCount:0,responseValid:false,failureStage:'already_used'}));
  resolving.add(parsed.provider);
  return generation().then(value=>value?run(parsed.provider,value):ProviderConnectionTestResult.parse({kind:'result',provider:parsed.provider,status:'failed',requestCount:0,responseValid:false,failureStage:'credential_resolve'})).catch(()=>ProviderConnectionTestResult.parse({kind:'result',provider:parsed.provider,status:'failed',requestCount:0,responseValid:false,failureStage:'credential_resolve'})).finally(()=>resolving.delete(parsed.provider));
 }};
}

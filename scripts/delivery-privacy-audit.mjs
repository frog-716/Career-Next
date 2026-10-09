import {execFileSync} from 'node:child_process';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
// Scan only public commit candidates. Never opens Keychain, credential stores or user databases.
const git=args=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
const files=[...new Set([...git(['ls-files','-z']).split('\0'),...git(['ls-files','--others','--exclude-standard','-z']).split('\0')].filter(Boolean))];
const suspicious=[],excluded=[];
const patterns=[['provider_key',/\b(?:sk-|tvly-)(?:[A-Za-z0-9_-]{20,})/g],['private_key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],['bearer_literal',/Bearer\s+[A-Za-z0-9_.-]{24,}/g],['oauth_token_literal',/(?:access_token|refresh_token)\s*["']?\s*[:=]\s*["']([A-Za-z0-9_.-]{24,})/g]];
let textCount=0,mediaCount=0;
for(const filename of files){const info=await stat(filename).catch(()=>undefined);if(!info?.isFile())continue;
 if(/(?:^|\/)(?:\.env(?:\.|$)|career\.sqlite(?:-|$)|userData|chrome-profile|identity\.json$|browser-host\.json$)/.test(filename)||/\.(?:pdf|db|sqlite|tar|zip)$/i.test(filename)){excluded.push({file:filename,reason:'runtime_or_private_artifact_in_commit_candidates'});continue;}
 const bytes=await readFile(filename);if(bytes.subarray(0,8192).includes(0)){mediaCount++;continue;}textCount++;const text=bytes.toString('utf8');
 for(const[type,pattern]of patterns){pattern.lastIndex=0;for(const match of text.matchAll(pattern)){const literal=match[0];if(/TEST|SIMULATED|example|fictional|placeholder/i.test(literal))continue;suspicious.push({file:filename,line:text.slice(0,match.index).split('\n').length,type});}}
}
const frozen={};for(const prefix of ['docs/product-spec/','docs/architecture/']){const rows=files.filter(file=>file.startsWith(prefix)&&git(['ls-files','--',file]).trim());let unchanged=0;for(const file of rows){const old=execFileSync('git',['show','cb84f2c4f326a67650635e6326d7a3d367f79abc:'+file],{maxBuffer:4*1024*1024}),now=await readFile(file);if(createHash('sha256').update(old).digest('hex')===createHash('sha256').update(now).digest('hex'))unchanged++;}frozen[prefix]={total:rows.length,unchanged};}
const result={scan:'public_commit_candidates_only; no credential store or business DB reads',textFiles:textCount,binaryMediaFiles:mediaCount,suspicious,excluded,frozen,passes:suspicious.length===0&&excluded.length===0&&Object.values(frozen).every(v=>v.total===v.unchanged)};
await mkdir('out/delivery-validation',{recursive:true});await writeFile('out/delivery-validation/privacy-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passes)process.exitCode=1;

import {it,expect} from 'vitest';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync,readFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {digest} from '../../packages/backend/application/migration/source';
import {readLiteSource,liteSpans} from '../../packages/backend/application/migration/lite-source';
it('reads only selected current identities, preserving visible fields and managed centered identity without legacy metadata',()=>{
 const root=realpathSync(mkdtempSync(path.join(tmpdir(),'career-lite-test-'))),file=path.join(root,'source.sqlite'),db=new Database(file);
 try{
  db.exec('CREATE TABLE current (id TEXT PRIMARY KEY, kind TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL);PRAGMA user_version=6');
  const row=(id:string,kind:string,body:unknown)=>db.prepare('INSERT INTO current VALUES (?,?,?,?)').run(id,kind,1,JSON.stringify(body));
  row('profile','profile',{basics:{name:'TEST NAME',phone:'',email:'',wechat:'',github:'https://example.invalid/test',links:[]}});
  for(const id of ['c1','c2'])row(id,'domain_company',{name:'TEST SAME COMPANY'});
  for(const [id,company_id] of [['o1','c1'],['o2','c1'],['o3','c2']])row(id,'opportunity',{company_id,title:'TEST ROLE',jd:'TEST JD',phase:'resume',result:'active'});
  for(const [id,opportunity_id] of [['r1','o2'],['r2','o3']])row(id,'resume_document',{opportunity_id,document:{schemaVersion:1,profile:{name:'OLD IDENTITY'},formatting:{'profile-name':{textAlign:'center'}},meta:{legacy_import:{private_history:'NOT IMPORTED'}},sections:[{id:'s',type:'experience',title:'TEST SECTION',items:[{id:'i',organization:'TEST ORG',role:'TEST ROLE',date:'unknown',bullets:[{id:'b',content:'中文 <strong>bold</strong> <em>italic</em> <s>strike</s> <a href="https://example.invalid/">link</a>'}]}]}]}});
  row('secret','ai_settings','SECRET BODY MUST NEVER BE DECODED');
  const selection=['profile','c1','c2','o1','o2','o3','r1','r2'].map(id=>({hash:digest(id),kind:db.prepare('SELECT kind FROM current WHERE id=?').get(id) as {kind:string}})).map(x=>({hash:x.hash,kind:x.kind.kind}));
  const schemaDigest=digest(JSON.stringify(db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all()));db.close();
  const before=readFileSync(file),snapshot=readLiteSource(file,digest(before),{selection,schemaDigest});
  expect(snapshot.records).toHaveLength(8);expect(readFileSync(file)).toEqual(before);
  const r=snapshot.records.find(r=>r.kind==='resume');if(!r||r.kind!=='resume')throw Error('resume');
  expect(r.document.identityNameAlignment).toBe('center');expect(r.document.sections[0].blocks).toHaveLength(4);
  const bullet=r.document.sections[0].blocks[3];if(bullet.type!=='bullet-list')throw Error('list');
  expect(bullet.items[0].spans).toEqual([{text:'中文 ',marks:[]},{text:'bold',marks:[{type:'bold'}]},{text:' ',marks:[]},{text:'italic',marks:[{type:'italic'}]},{text:' ',marks:[]},{text:'strike',marks:[{type:'strike'}]},{text:' ',marks:[]},{text:'link',marks:[{type:'link',href:'https://example.invalid/'}]}]);
  expect(JSON.stringify(snapshot.records)).not.toContain('NOT IMPORTED');expect(JSON.stringify(snapshot.records)).not.toContain('OLD IDENTITY');
 }finally{if(db.open)db.close();rmSync(root,{recursive:true,force:true});}
});
it('rejects unsupported visible markup rather than dropping formatting or guessing plain text',()=>{
 expect(()=>liteSpans('<table><tr><td>TEST</td></tr></table>')).toThrow('RESUME_LOSSY_CONVERSION');
 expect(()=>liteSpans('<strong>TEST</em>')).toThrow('RESUME_LOSSY_CONVERSION');
 expect(liteSpans('中文 plain text < 3')).toEqual([{text:'中文 plain text < 3',marks:[]}]);
});

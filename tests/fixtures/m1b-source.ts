import Database from 'better-sqlite3';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {syntheticLegacyHistory} from './legacy-history';
/** Deliberately synthetic source format, not a claim of real legacy schema compatibility. */
export function createM1bSource(filename:string){
 const common={revision:4,recordedAt:null},profile={...common,identity:'profile-primary',kind:'profile',origin:'primary',basics:{name:'TEST DATA Primary',phone:'',email:'',wechat:'',links:[]}};
 const records=[profile,{...profile,identity:'profile-secondary',origin:'secondary',basics:{...profile.basics,name:'TEST DATA Secondary'}},
 ...['company-a','company-b'].map(identity=>({...common,identity,kind:'company',name:'TEST DATA same display name'})),
 ...['opportunity-a','opportunity-b','opportunity-c'].map((identity,index)=>({...common,identity,kind:'opportunity',companyIdentity:index===2?'company-b':'company-a',title:'TEST DATA Analyst '+index,phase:'resume',result:'active',...index?{jd:'TEST DATA JD'}:{}})),
 ...['resume-a','resume-b'].map((identity,index)=>({
  ...common,identity,kind:'resume',opportunityIdentity:index?'opportunity-c':'opportunity-b',
  document:{schemaVersion:1,identityNameAlignment:'center',sections:[{
   id:'skills',type:'skills',title:'TEST DATA Skills',blocks:[
    {id:'intro',type:'paragraph',alignment:'center',spans:[{text:'TEST DATA centered text',marks:[{type:'bold'},{type:'italic'}]}]},
    {id:'bullets',type:'bullet-list',items:[{id:'bullet',alignment:'right',spans:[{text:'TEST DATA list',marks:[]}]}]},
   ],
  }]},
 })),
 ...syntheticLegacyHistory().map((item,index)=>({...common,identity:'proposal-'+index,kind:item.kind==='research'?'research-proposal':'resume-proposal',legacyStatus:item.legacyStatus,target:{type:item.kind==='research'?'opportunity':'resume',identity:index===0?'missing-target':item.kind==='research'?'opportunity-a':'resume-a'},content:item.content})),
 ];
 const db=new Database(filename);try{db.exec('CREATE TABLE source_meta(kind TEXT NOT NULL,version INTEGER NOT NULL); CREATE TABLE legacy_records(identity TEXT PRIMARY KEY,kind TEXT NOT NULL,body TEXT NOT NULL);');db.pragma('user_version=1');db.prepare('INSERT INTO source_meta VALUES (?,?)').run('synthetic-career-legacy',1);for(const record of records)db.prepare('INSERT INTO legacy_records VALUES (?,?,?)').run(record.identity,record.kind,JSON.stringify(record));}finally{db.close();}
 return {records,digest:createHash('sha256').update(readFileSync(filename)).digest('hex'),classification:{version:1,records:records.filter(r=>r.identity!=='profile-secondary').map(r=>({identity:r.identity,classification:'REAL'}))},mapping:{version:'M1-A-fixture-v1',profileAuthority:'primary',opportunityPhase:'resume-to-preparation',opportunityResult:'active',unknownDates:'preserve',alignment:'preserve',proposals:'archive-only'}};
}

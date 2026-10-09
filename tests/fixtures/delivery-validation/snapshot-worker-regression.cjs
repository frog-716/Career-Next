'use strict';
// Same readonly-source Worker shape as platform/backup/public.ts. Used only in
// an isolated TEST diagnostic profile, never the active user's/profile's writer.
const fs=require('node:fs'),path=require('node:path'),{Worker}=require('node:worker_threads');
const {randomUUID}=require('node:crypto');
const profileArg=process.argv.find(value=>value.startsWith('--user-data-dir='));
const bundleArg=process.argv.find(value=>value.startsWith('--bundle='));
if(!profileArg||!bundleArg)throw Error('TEST_diagnostic_arguments_required');
const profile=path.resolve(profileArg.slice('--user-data-dir='.length)),bundle=path.resolve(bundleArg.slice('--bundle='.length));
if(!profile.includes('TEST')||!bundle.includes('TEST'))throw Error('isolated_TEST_profile_required');
const scratch=path.join(profile,'snapshot-diagnostic-TEST-'+randomUUID());fs.mkdirSync(scratch);
const rejectOutside=process.argv.includes('--reject-outside-profile'),rejectDriver=process.argv.includes('--reject-untrusted-driver');
const rejectExpected=rejectOutside||rejectDriver;
const source=rejectOutside?path.join(profile,'../FORBIDDEN-TEST/career.sqlite'):path.join(profile,'workspaces/local/career.sqlite'),destination=path.join(scratch,'working.sqlite');
const driver=rejectDriver?path.join(profile,'UNTRUSTED-TEST-driver.cjs'):path.join(bundle,'Contents/Resources/application/node_modules/better-sqlite3');
const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');const DB=require(workerData.driver);const db=new DB(workerData.source,{readonly:true,fileMustExist:true});db.backup(workerData.destination).then(()=>{db.close();parentPort.postMessage('done');},()=>{db.close();parentPort.postMessage('failed');});`,{eval:true,workerData:{source,destination,driver}});
let settled=false;
function finish(actual,workerError){if(settled)return;settled=true;const passed=rejectExpected?actual==='backup_incomplete'&&workerError==='isolated_TEST_profile_required':actual==='success';console.log(JSON.stringify({expected:rejectExpected?'boundary_rejection':'success',actual,...workerError?{workerError}:{},readOnlySource:true,pass:passed}));if(!passed)process.exitCode=1;fs.rmSync(scratch,{recursive:true,force:true});}
worker.once('message',result=>finish(result==='done'?'success':'backup_incomplete'));
worker.once('error',error=>finish('backup_incomplete',/^[a-zA-Z_]+$/.test(error.message)?error.message:'REDACTED_error'));
worker.once('exit',code=>{if(code!==0)finish('backup_incomplete');});

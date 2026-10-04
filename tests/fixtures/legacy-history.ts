import {LegacyHistoryImport} from '../../packages/contracts/ai/legacy-history/schema';
export function syntheticLegacyHistory():LegacyHistoryImport[]{
 const statuses=['pending','accepted','rejected','resolved','superseded'] as const;
 const common={sourceSystem:'career-legacy' as const,snapshotDigest:'a'.repeat(64),target:{legacyType:'opportunity' as const,legacyIdentity:'TEST-target-only',resolution:'unresolved' as const},recordedAt:null,readOnly:true as const,independentlyVerified:false as const};
 const basis={reason:'TEST DATA historical reason',evidence:'TEST DATA synthetic evidence',sources:[]};
 const research=statuses.map(status=>LegacyHistoryImport.parse({...common,kind:'research',sourceRecordIdentity:'TEST-research-'+status,legacyStatus:{kind:'known',value:status},content:{availability:'available',proposal:{title:'TEST Research '+status,body:'TEST DATA research body '+status,nature:'hypothesis'},basis}}));
 const resume=statuses.filter(s=>s!=='resolved').map(status=>LegacyHistoryImport.parse({...common,kind:'resume',target:{...common.target,legacyType:'resume'},sourceRecordIdentity:'TEST-resume-'+status,legacyStatus:{kind:'known',value:status},content:{availability:'available',proposal:{title:'TEST Resume '+status,changeKind:'rewrite',sectionIdentity:'TEST-section',blockIdentity:'TEST-block',text:'TEST DATA resume suggestion '+status},basis}}));
 return [...research,...resume,LegacyHistoryImport.parse({...research[0],sourceRecordIdentity:'TEST-unrecognized',legacyStatus:{kind:'unrecognized',original:'legacy-custom-status'}})];
}

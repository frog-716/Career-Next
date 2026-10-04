import {validateLegacyHistoryCandidate,legacyHistoryCandidateRelations} from '../ai-runtime/legacy-history/public';
import {validateSearchCandidate,searchCandidateRelations} from '../ai-runtime/search/public';
import {validateDraftCandidate,draftCandidateRelations} from '../domains/opportunity/communication/public';
import {validateFeedbackCandidate} from '../application/feedback/public';
import {validatePreferencesCandidate} from '../application/preferences/public';
import type Database from 'better-sqlite3';
import {validateCandidate as materials,candidateRelations as materialsRelations} from '../domains/materials/public';
import {validateCandidate as wiki,candidateRelations as wikiRelations} from '../domains/wiki/public';
import {validateCandidate as resume,candidateRelations as resumeRelations} from '../domains/resume/public';
import {validateCandidate as profile,candidateRelations as profileRelations} from '../domains/profile/public';
import {validateCandidate as employment,candidateRelations as employmentRelations} from '../domains/employment/public';
import {validateCandidate as project,candidateRelations as projectRelations} from '../domains/project/public';
import {validateCandidate as company,candidateRelations as companyRelations} from '../domains/opportunity/company/public';
import {validateCandidate as core,candidateRelations as coreRelations} from '../domains/opportunity/core/public';
import {validateCandidate as research,candidateRelations as researchRelations} from '../domains/opportunity/research/public';
import {validateCandidate as interview,candidateRelations as interviewRelations} from '../domains/opportunity/interview/public';
import {validateCandidate as offer,candidateRelations as offerRelations} from '../domains/opportunity/offer/public';
import {validateCandidate as submission,candidateRelations as submissionRelations} from '../domains/opportunity/submission/public';
import {validateCandidate as communication,candidateRelations as communicationRelations} from '../domains/opportunity/communication/public';
import {composeDomains} from './domain-registry';
import {createMaterialsStore} from '../domains/materials/store';
import {validateFileCandidates} from '../platform/files/candidates';
import {validateAiCandidate,candidateRelations as aiRelations} from '../ai-runtime/public';
export function validateBusinessCandidate(db:Database.Database){for(const validate of [validateLegacyHistoryCandidate,materials,wiki,resume,profile,employment,project,company,core,research,interview,offer,submission,communication,validateAiCandidate,validatePreferencesCandidate,validateFeedbackCandidate,validateDraftCandidate,validateSearchCandidate])validate(db);}

export function validateCandidateRelations(db:Database.Database){
 const materialsStore=createMaterialsStore(db,'candidate-validation','candidate-validation');
 const d=composeDomains(db,materialsStore,{ai:{handle(){throw Error('candidate_read_only');}},application:{handle(){throw Error('candidate_read_only');}}});
 const present=(owner:string,id:string)=>owner==='search'?!!d.search.read(id):owner==='communication-draft'?d.communication.drafts.read(id).revision>=0:owner==='offer'?!!d.offer.purgeImpact(id):owner==='profile'?id==='current':owner==='wiki'?!!d.wiki.purgeImpact(id):owner==='research'?!!d.research.purgeImpact(id):owner==='materials'?!!materialsStore.purgeImpact(id):owner==='company'?!!d.opportunity.companyPurgeImpact(id):owner==='person'?!!d.employment.personPurgeImpact(id):owner==='opportunity'?!!d.opportunity.purgeImpact(id):owner==='submission'?!!d.submission.describePurge(id):owner==='communication'?!!d.communication.describePurge(id):owner==='interview'?!!d.interview.purgeImpact(id):owner==='resume'?!!d.resume.purgeImpact(id):owner==='employment'?!!d.employment.purgeImpact(id):owner==='project'?!!d.project.purgeImpact(id):false;
 const relationCollectors:((db:Database.Database)=>{owner:string;objectId:string;kind:'object'|'source';source?:import('../../contracts/common/source-ref').SourceRef;optional?:boolean;revision?:number;provenance?:import('../../contracts/common/provenance').Provenance}[])[]=[legacyHistoryCandidateRelations,materialsRelations,wikiRelations,resumeRelations,profileRelations,employmentRelations,projectRelations,companyRelations,coreRelations,researchRelations,interviewRelations,offerRelations,submissionRelations,communicationRelations,aiRelations,draftCandidateRelations,searchCandidateRelations];
 for(const collect of relationCollectors)for(const ref of collect(db)){
  const purged=db.prepare('SELECT purged FROM platform_purge_fences WHERE owner=? AND object_id=?').get(ref.owner,ref.objectId) as {purged:number}|undefined;
  if(purged?.purged||ref.optional)continue;
  if(!present(ref.owner,ref.objectId))throw Error('backup_relation_invalid');
  if(ref.source){const current=d.resolveSource(ref.source);if(!current||ref.source.revision>current.revision)throw Error('backup_relation_invalid');}
  if(ref.owner==='wiki'&&(ref.revision||ref.provenance)){const expected=d.wiki.revisionIdentity(ref.objectId,ref.provenance?.revision??ref.revision!);if(!expected||ref.provenance&&(expected.scope!==ref.provenance.scope||expected.scopeId!==ref.provenance.scopeId))throw Error('backup_relation_invalid');}
 }
 validateFileCandidates(db);
}

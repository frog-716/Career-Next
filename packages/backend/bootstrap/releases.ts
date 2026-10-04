import {legacyHistoryMigration} from '../ai-runtime/legacy-history/public';
import {localSearchMigration} from '../platform/search/public';
import {localSearchNotifications} from './local-search-migration';
import {searchMigration} from '../ai-runtime/search/public';
import {importTargetMigration} from '../domains/materials/public';
import {materialOriginMigration} from '../domains/materials/origin';
import {draftMigration} from '../domains/opportunity/communication/public';
import {productMigration} from '../ai-runtime/product/migration';
import {feedbackMigration} from '../application/feedback/public';
import {g5RetentionMigration} from '../platform/database/g5-retention';
import {preferencesMigration} from '../application/preferences/public';
import {persistenceMigration} from '../platform/persistence/fence';
import {g4RetentionMigration} from '../platform/database/g4-retention';
import {fileCandidateMigration} from '../platform/files/candidates';
import {aiMigration} from '../ai-runtime/migration';
import {submissionMigration} from '../domains/opportunity/submission/migration';
import {communicationMigration} from '../domains/opportunity/communication/migration';
import { commandMigration } from '../platform/commands/receipts';
import { artifactMigration } from '../platform/database/ledger';
import { employmentMigration } from '../domains/employment/public';
import { projectMigration } from '../domains/project/public';
import { opportunityMigration } from '../domains/opportunity/migration';
import { profileMigration } from '../domains/profile/public';
import { resumeMigration,resumeProvenanceMigration } from '../domains/resume/public';
import { wikiMigration } from '../domains/wiki/migration';
import type { MigrationBatch } from '../platform/database/migrations';
import {researchMigration} from '../domains/opportunity/research/migration';
import {interviewMigration} from '../domains/opportunity/interview/migration';
import {offerMigration} from '../domains/opportunity/offer/migration';
import {offerRetentionMigration} from '../platform/database/offer-retention';
/** Released batches are immutable; G3 appends its own owner fragments. */
export const releases:readonly MigrationBatch[]=[{version:2,name:'002-g2-first-batch',fragments:[
 {id:'platform.commands.v1',dependencies:[],sql:commandMigration},
 {id:'platform.artifacts.v2',dependencies:['platform.commands.v1'],sql:artifactMigration},
 {id:'employment.initial.v1',dependencies:['platform.commands.v1'],sql:employmentMigration},
 {id:'project.initial.v1',dependencies:['platform.commands.v1','employment.initial.v1'],sql:projectMigration},
 {id:'opportunity.initial.v1',dependencies:['platform.commands.v1'],sql:opportunityMigration},
 {id:'profile.initial.v1',dependencies:['platform.commands.v1'],sql:profileMigration},
 {id:'resume.initial.v1',dependencies:['platform.artifacts.v2','profile.initial.v1','opportunity.initial.v1'],sql:resumeMigration},
 {id:'wiki.initial.v1',dependencies:['platform.commands.v1'],sql:wikiMigration},
]},{version:3,name:'003-g3-submodules',fragments:[
 {id:'platform.offer-retention.v1',dependencies:['platform.artifacts.v2'],sql:offerRetentionMigration},
 {id:'research.initial.v1',dependencies:['platform.commands.v1','opportunity.initial.v1'],sql:researchMigration},
 {id:'interview.initial.v1',dependencies:['platform.commands.v1','opportunity.initial.v1'],sql:interviewMigration},
 {id:'offer.initial.v1',dependencies:['platform.commands.v1','opportunity.initial.v1','platform.offer-retention.v1'],sql:offerMigration},
]},{version:4,name:'004-g4-seams',fragments:[
 {id:'platform.persistence.v1',dependencies:[],sql:persistenceMigration},
 {id:'platform.g4-retention.v1',dependencies:['platform.offer-retention.v1'],sql:g4RetentionMigration},
 {id:'platform.file-candidates.v1',dependencies:['platform.g4-retention.v1'],sql:fileCandidateMigration},
 {id:'submission.initial.v1',dependencies:['platform.commands.v1','opportunity.initial.v1','platform.g4-retention.v1'],sql:submissionMigration},
 {id:'communication.initial.v1',dependencies:['platform.commands.v1','opportunity.initial.v1','platform.g4-retention.v1'],sql:communicationMigration},
 {id:'ai.initial.v1',dependencies:['platform.commands.v1','wiki.initial.v1','platform.persistence.v1'],sql:aiMigration},
]},{version:5,name:'005-g5-journeys',fragments:[
 {id:'platform.g5-retention.v1',dependencies:['platform.g4-retention.v1'],sql:g5RetentionMigration},
 {id:'application.feedback.v1',dependencies:['platform.commands.v1','platform.g5-retention.v1'],sql:feedbackMigration},
 {id:'application.preferences.v1',dependencies:['platform.commands.v1'],sql:preferencesMigration},
 {id:'communication.draft.v1',dependencies:['communication.initial.v1'],sql:draftMigration},
 {id:'materials.targets.v1',dependencies:['platform.artifacts.v2'],sql:importTargetMigration},
 {id:'ai.search.v1',dependencies:['ai.initial.v1'],sql:searchMigration},
 {id:'resume.provenance.v1',dependencies:['resume.initial.v1'],sql:resumeProvenanceMigration},
 {id:'ai.product.v1',dependencies:['ai.initial.v1'],sql:productMigration},
]},{version:6,name:'006-g6-failure-gates',fragments:[
 {id:'platform.local-search.v1',dependencies:['wiki.initial.v1','project.initial.v1','opportunity.initial.v1'],sql:localSearchMigration},
 {id:'platform.local-search-notifications.v1',dependencies:['platform.local-search.v1'],sql:localSearchNotifications},
]},{version:7,name:'007-j07-material-origin',fragments:[
 {id:'materials.origin.v1',dependencies:['materials.targets.v1'],sql:materialOriginMigration},
]},{version:8,name:'008-legacy-proposal-history',fragments:[
 {id:'ai.legacy-history.v1',dependencies:['platform.persistence.v1'],sql:legacyHistoryMigration},
]}];

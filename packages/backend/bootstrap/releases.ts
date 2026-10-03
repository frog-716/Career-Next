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
import { resumeMigration } from '../domains/resume/public';
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
]}];

import { commandMigration } from '../platform/commands/receipts';
import { artifactMigration } from '../platform/database/ledger';
import { employmentMigration } from '../domains/employment/public';
import { projectMigration } from '../domains/project/public';
import { opportunityMigration } from '../domains/opportunity/migration';
import { profileMigration } from '../domains/profile/public';
import { resumeMigration } from '../domains/resume/public';
import { wikiMigration } from '../domains/wiki/migration';
import type { MigrationBatch } from '../platform/database/migrations';
/** This first G2 batch remains unreleased until its integration checkpoint passes. */
export const releases:readonly MigrationBatch[]=[{version:2,name:'002-g2-first-batch',fragments:[
 {id:'platform.commands.v1',dependencies:[],sql:commandMigration},
 {id:'platform.artifacts.v2',dependencies:['platform.commands.v1'],sql:artifactMigration},
 {id:'employment.initial.v1',dependencies:['platform.commands.v1'],sql:employmentMigration},
 {id:'project.initial.v1',dependencies:['platform.commands.v1','employment.initial.v1'],sql:projectMigration},
 {id:'opportunity.initial.v1',dependencies:['platform.commands.v1'],sql:opportunityMigration},
 {id:'profile.initial.v1',dependencies:['platform.commands.v1'],sql:profileMigration},
 {id:'resume.initial.v1',dependencies:['platform.artifacts.v2','profile.initial.v1','opportunity.initial.v1'],sql:resumeMigration},
 {id:'wiki.initial.v1',dependencies:['platform.commands.v1'],sql:wikiMigration},
]}];

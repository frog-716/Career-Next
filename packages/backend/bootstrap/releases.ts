import { commandMigration } from '../platform/commands/receipts';
import { artifactMigration } from '../platform/database/ledger';
import { employmentMigration } from '../domains/employment/public';
import { wikiMigration } from '../domains/wiki/migration';
import type { MigrationBatch } from '../platform/database/migrations';
/** This first G2 batch remains unreleased until its integration checkpoint passes. */
export const releases:readonly MigrationBatch[]=[{version:2,name:'002-g2-first-batch',fragments:[
 {id:'platform.commands.v1',dependencies:[],sql:commandMigration},
 {id:'platform.artifacts.v2',dependencies:['platform.commands.v1'],sql:artifactMigration},
 {id:'employment.initial.v1',dependencies:['platform.commands.v1'],sql:employmentMigration},
 {id:'wiki.initial.v1',dependencies:['platform.commands.v1'],sql:wikiMigration},
]}];

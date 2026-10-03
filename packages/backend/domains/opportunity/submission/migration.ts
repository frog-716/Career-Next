export const submissionMigration=`CREATE TABLE opportunity_submission(id TEXT PRIMARY KEY,opportunity_id TEXT NOT NULL UNIQUE,body_json TEXT NOT NULL);
CREATE TABLE opportunity_submission_purged(id TEXT PRIMARY KEY,opportunity_id TEXT NOT NULL UNIQUE);
CREATE TABLE opportunity_submission_commands(command_id TEXT PRIMARY KEY,submission_id TEXT NOT NULL);`;

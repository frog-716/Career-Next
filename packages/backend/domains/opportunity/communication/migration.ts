export const communicationMigration=`CREATE TABLE opportunity_communication(id TEXT PRIMARY KEY,opportunity_id TEXT NOT NULL,body_json TEXT NOT NULL);
CREATE TABLE opportunity_communication_history(id TEXT PRIMARY KEY,communication_id TEXT NOT NULL,event_json TEXT NOT NULL);
CREATE TABLE opportunity_communication_commands(command_id TEXT PRIMARY KEY,communication_id TEXT NOT NULL);`;

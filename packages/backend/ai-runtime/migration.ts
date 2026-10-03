export const aiMigration=`
CREATE TABLE ai_tasks(id TEXT PRIMARY KEY, data_json TEXT NOT NULL);
CREATE TABLE ai_operations(id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES ai_tasks(id), data_json TEXT NOT NULL, fence_json TEXT NOT NULL);
CREATE TABLE ai_proposals(id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES ai_tasks(id), operation_id TEXT NOT NULL REFERENCES ai_operations(id), data_json TEXT NOT NULL);
`;

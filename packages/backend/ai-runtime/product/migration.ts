export const productMigration=`
CREATE TABLE ai_product_tasks(id TEXT PRIMARY KEY,data_json TEXT NOT NULL);
CREATE TABLE ai_product_operations(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES ai_product_tasks(id),data_json TEXT NOT NULL,fence_json TEXT NOT NULL);
CREATE TABLE ai_product_proposals(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES ai_product_tasks(id),operation_id TEXT NOT NULL REFERENCES ai_product_operations(id),data_json TEXT NOT NULL);
CREATE INDEX ai_product_operation_owner ON ai_product_operations(task_id);
CREATE INDEX ai_product_proposal_owner ON ai_product_proposals(task_id);`;

export const researchMigration=`
CREATE TABLE research_documents(owner_kind TEXT NOT NULL CHECK(owner_kind IN ('company','opportunity')),owner_id TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),PRIMARY KEY(owner_kind,owner_id));
CREATE TABLE research_items(id TEXT PRIMARY KEY,owner_kind TEXT NOT NULL CHECK(owner_kind IN ('company','opportunity')),owner_id TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),item_json TEXT NOT NULL,FOREIGN KEY(owner_kind,owner_id) REFERENCES research_documents(owner_kind,owner_id));
CREATE TABLE research_history(item_id TEXT NOT NULL,revision INTEGER NOT NULL,history_json TEXT NOT NULL,PRIMARY KEY(item_id,revision),FOREIGN KEY(item_id) REFERENCES research_items(id));
CREATE TABLE research_references(opportunity_id TEXT NOT NULL,item_id TEXT NOT NULL,origin_revision INTEGER NOT NULL,company_id TEXT NOT NULL,PRIMARY KEY(opportunity_id,item_id),FOREIGN KEY(item_id) REFERENCES research_items(id));
`;

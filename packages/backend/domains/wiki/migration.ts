export const wikiMigration=`
CREATE TABLE wiki_knowledge(id TEXT PRIMARY KEY,revision INTEGER NOT NULL CHECK(revision>0),status TEXT NOT NULL CHECK(status IN ('active','retired')),content_json TEXT NOT NULL);
CREATE TABLE wiki_revisions(knowledge_id TEXT NOT NULL REFERENCES wiki_knowledge(id),revision INTEGER NOT NULL,history_json TEXT NOT NULL,PRIMARY KEY(knowledge_id,revision));
`;

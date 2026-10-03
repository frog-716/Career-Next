/** Rebuildable local search projection; no occupational fact or permission state. */
export const localSearchMigration = `
CREATE TABLE platform_local_search_documents (
 owner TEXT NOT NULL CHECK(owner IN ('wiki','opportunity','project')),
 object_id TEXT NOT NULL, revision INTEGER NOT NULL, title TEXT NOT NULL,
 scope TEXT NOT NULL, scope_id TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL,
 PRIMARY KEY(owner,object_id));
CREATE INDEX platform_local_search_scope ON platform_local_search_documents(owner,scope,scope_id,object_id);
CREATE INDEX platform_local_search_scope_cursor ON platform_local_search_documents(owner,scope,object_id);
CREATE INDEX platform_local_search_active ON platform_local_search_documents(owner,active,object_id);
CREATE INDEX platform_local_search_scope_active ON platform_local_search_documents(owner,scope,active,object_id);
CREATE INDEX platform_local_search_scope_id_active ON platform_local_search_documents(owner,scope,scope_id,active,object_id);
CREATE INDEX platform_local_search_id_scope ON platform_local_search_documents(owner,scope_id,object_id);
CREATE INDEX platform_local_search_id_scope_active ON platform_local_search_documents(owner,scope_id,active,object_id);
CREATE TABLE platform_local_search_chunks (
 rowid INTEGER PRIMARY KEY, owner TEXT NOT NULL, object_id TEXT NOT NULL,
 ordinal INTEGER NOT NULL, text TEXT NOT NULL CHECK(length(CAST(text AS BLOB))<=4096),
 FOREIGN KEY(owner,object_id) REFERENCES platform_local_search_documents(owner,object_id) ON DELETE CASCADE,
 UNIQUE(owner,object_id,ordinal));
CREATE VIRTUAL TABLE platform_local_search_fts USING fts5(text,content='platform_local_search_chunks',content_rowid='rowid',tokenize='trigram');
CREATE TRIGGER platform_local_search_chunk_insert AFTER INSERT ON platform_local_search_chunks BEGIN
 INSERT INTO platform_local_search_fts(rowid,text) VALUES(new.rowid,new.text); END;
CREATE TRIGGER platform_local_search_chunk_delete AFTER DELETE ON platform_local_search_chunks BEGIN
 INSERT INTO platform_local_search_fts(platform_local_search_fts,rowid,text) VALUES('delete',old.rowid,old.text); END;
CREATE TABLE platform_local_search_dirty (
 owner TEXT NOT NULL CHECK(owner IN ('wiki','opportunity','project')), object_id TEXT NOT NULL,
 PRIMARY KEY(owner,object_id));
`;

export const legacyHistoryMigration=`CREATE TABLE ai_legacy_history (
 id TEXT PRIMARY KEY,
 source_system TEXT NOT NULL,
 snapshot_digest TEXT NOT NULL,
 source_record_identity TEXT NOT NULL,
 source_kind TEXT NOT NULL CHECK(source_kind IN ('research','resume')),
 body_json TEXT NOT NULL,
 UNIQUE(source_system,snapshot_digest,source_record_identity,source_kind)
);`;

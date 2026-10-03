/** Append-only platform release adds the actual Feedback attachment owner. */
export const g5RetentionMigration=`CREATE TABLE platform_artifact_retention_g5 (
 blob_id TEXT NOT NULL REFERENCES platform_blobs(id),owner TEXT NOT NULL CHECK(owner IN ('materials','resume','offer','submission','communication','actual-artifact','feedback')),
 object_id TEXT NOT NULL,PRIMARY KEY(blob_id,owner,object_id),UNIQUE(owner,object_id));
INSERT INTO platform_artifact_retention_g5 SELECT * FROM platform_artifact_retention;
DROP TABLE platform_artifact_retention;
ALTER TABLE platform_artifact_retention_g5 RENAME TO platform_artifact_retention;`;

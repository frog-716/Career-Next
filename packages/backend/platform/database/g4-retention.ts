/** G4 appends an immutable fragment; released G1/G2/G3 SQL stays unchanged. */
export const g4RetentionMigration=`
CREATE TABLE platform_artifact_retention_g4 (
 blob_id TEXT NOT NULL REFERENCES platform_blobs(id),
 owner TEXT NOT NULL CHECK(owner IN ('materials','resume','offer','submission','communication','actual-artifact')),
 object_id TEXT NOT NULL,
 PRIMARY KEY(blob_id,owner,object_id), UNIQUE(owner,object_id));
INSERT INTO platform_artifact_retention_g4 SELECT * FROM platform_artifact_retention;
DROP TABLE platform_artifact_retention;
ALTER TABLE platform_artifact_retention_g4 RENAME TO platform_artifact_retention;`;

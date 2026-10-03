/** New G3 fragment; the released G1/G2 migration SQL stays unchanged. */
export const offerRetentionMigration = `
CREATE TABLE platform_artifact_retention_g3 (
 blob_id TEXT NOT NULL REFERENCES platform_blobs(id),
 owner TEXT NOT NULL CHECK(owner IN ('materials','resume','offer')),
 object_id TEXT NOT NULL,
 PRIMARY KEY(blob_id,owner,object_id), UNIQUE(owner,object_id));
INSERT INTO platform_artifact_retention_g3 SELECT * FROM platform_artifact_retention;
DROP TABLE platform_artifact_retention;
ALTER TABLE platform_artifact_retention_g3 RENAME TO platform_artifact_retention;`;

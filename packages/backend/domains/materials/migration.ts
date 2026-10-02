// First unreleased Materials migration; only the personal Raw slice.
export const materialsMigration = `
CREATE TABLE materials_imports (
 id TEXT PRIMARY KEY, generation TEXT NOT NULL, connection TEXT NOT NULL,
 validity INTEGER NOT NULL DEFAULT 1, state TEXT NOT NULL CHECK(state IN ('preparing','preview','revoked','consumed')),
 name TEXT NOT NULL, digest TEXT, size INTEGER, revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE materials_raw (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, size INTEGER NOT NULL, digest TEXT NOT NULL,
 blob_id TEXT NOT NULL REFERENCES platform_blobs(id), revision INTEGER NOT NULL CHECK(revision=1),
 scope TEXT NOT NULL CHECK(scope='personal'), lifecycle TEXT NOT NULL CHECK(lifecycle='evidence-original'), recorded_at TEXT NOT NULL
);`;

// Append-only release fragment; do not change the published Materials migrations.
export const materialOriginMigration=`ALTER TABLE materials_imports ADD COLUMN origin_json TEXT;
ALTER TABLE materials_raw ADD COLUMN origin_json TEXT;`;

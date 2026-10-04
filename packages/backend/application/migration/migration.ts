/** Migration provenance only. No business body, execution receipt or reusable authority. */
export const migrationReceiptMigration='CREATE TABLE migration_import_receipts(plan_digest TEXT PRIMARY KEY,body TEXT NOT NULL);';

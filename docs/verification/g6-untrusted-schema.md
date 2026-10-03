# G6 untrusted restore: released SQLite structure

Status: **PASS for this local regression boundary**. This report does not declare the whole G6 gate passed. Normal packaged desktop verification of this new guard remains **NOT RUN** here.

## Actual red evidence

- Public `data.restore.prepare` was given a real registered v5/v6 backup, with its legitimate migration batch/fragment records unchanged and its database digest recomputed after a schema alteration. SQLite integrity and foreign-key checks still passed.
- An added `AFTER INSERT` Proposal trigger was demonstrated on a disposable clone: inserting a schema-valid pending ProductProposal changed the actual Opportunity phase from `preparation` to `offer`, without owner acceptance. The active workspace was never used for this demonstration.
- Before the fix, both backup versions incorrectly returned a **ready restore_candidate**. The test expected `backup_schema_untrusted`; command exit **1**, two failures. Evidence: `/tmp/g6-untrusted-schema-red.log`.
- A second red test replaced the artifact table with an executable view. Original verification queried candidate structures before its schema guard and returned `data_operation_failed`. The test expected `backup_schema_untrusted`; command exit **1**. Evidence: `/tmp/g6-untrusted-schema-order-red.log`.

Hashes, commands' actual exit codes, and machine-readable observations are in [g6-untrusted-schema-results.json](g6-untrusted-schema-results.json).

## Minimum fix

Platform builds an independent `:memory:` reference from the **same initial workspace DDL** and the trusted released v5/v6 fragments injected by Bootstrap. It executes no DDL taken from the backup. This memory database has no active-workspace path or writer lock and does not become a second active writer.

The complete `sqlite_schema` structure is compared: object type, name, owning table, and SQL tokens. Checks include all tables, views, triggers, explicit indexes, SQLite autoindexes, and FTS shadow tables. Unquoted SQL case and whitespace may vary; quoted literals/identifiers and comments retain their contents. Unknown object identities are rejected before tokenization; known-object DDL has a fixed size bound relative to its trusted definition. Only exact SQLite-generated `sqlite_stat1` / `sqlite_stat4` structures are optional.

Bootstrap checks the structure before candidate sanitization or any owner candidate decoding. Platform backup verification now invokes this validation before integrity/FK inspection or artifact SELECTs. The independently committed ordering correction is `60c04fd`, owned by the G6 F3 backup line.

## Green evidence

- **14/14** public-command regressions passed: 11 rejection cases and 3 compatible cases. These cover new triggers, altered known triggers, quoted literal changes, tables replaced by views, changed constraints, unknown views, FTS tokenizer/shadow changes, malformed owner JSON behind an invalid structure, and an executable artifact view.
- Valid v5 and v6 registered backups still prepare normally. SQL keyword/whitespace variation and SQLite ANALYZE statistics also remain compatible.
- Rejected preparation keeps source backup bytes, managed-copy manifest, active Opportunity phase and revision unchanged; no ready candidate is registered.
- F3's final batch included all 14 cases plus real backup/recovery/fault/restore regressions: **5 files, 42 tests PASS, exit 0** (`/tmp/g6-backup-guard-order-green.log`).
- Additional G1/G2 upgrade, G4 backup/lifecycle, and normal v5/v6 search backup/restore regression batch: **5 files, 16 tests PASS, exit 0** (`/tmp/g6-untrusted-schema-regression.log`). These batches overlap; their counts are not summed.
- Selected Node 24 TypeScript check: **exit 0**. Scoped `git diff --check`: **exit 0**.
- Frozen Product Spec **12/12**, Frozen Architecture **8/8** byte SHA256 values remain unchanged against `befe2437`.

All fixtures are synthetic isolated temporary directories and are removed after execution. No old Career, user data, real provider/search/Feishu, or secret was accessed. No new migration, business implementation, external network call, issue closure, or push is included in this boundary.

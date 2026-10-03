# G6 normal local-search lifecycle integration

Scope: F4 bounded local-search integration with F3 purge / filtered backup / restore. These are narrow seam results, not a complete G6 PASS. Tests use isolated temporary real SQLite workspaces and actual backend writer / read-only search child processes. They do not read old Career, user data, real services or credentials.

## Public seams and observed results

`createRuntimeBackend` with normal release6 composition receives public Wiki / Project / Opportunity commands. `runtime.search` performs normal dirty maintenance and the separate real read-only child query. `data.purge.plan/confirm`, `data.backup`, and `data.restore.prepare/activate` use the real lifecycle. SQL and database-byte observations only supplement these behaviors.

| Case | Actual evidence | Result |
| --- | --- | --- |
| Owner writes / edit / index refresh | Create all three owners, save a real JD before consuming the dirty queue; three dirty entries. Chinese original body queries find the correct owner. Public updates return new revision/body. New queries match, old body queries no longer match. | PASS |
| Purge current sensitive owners | Actual plan/confirm, all approved managed copies selected. Normal search returns empty, non-partial results; documents, chunks and FTS have zero records; original marker absent from actual active SQLite bytes. | PASS |
| Filtered v6 backup | First populate the actual search index; purge a separate sensitive Wiki; publish an actual backup. Backup has zero derived documents/chunks/FTS and three rebuild queue entries. Purged marker absent from published SQLite bytes. | PASS |
| Old v5 backup restore | Create/save owners using actual v5 releases and normal writer commands; actual v5 backup. Normal release6 runtime prepares and activates it; migrated current database is v6 and three dirty entries are rebuilt through actual search. Wiki/Project/JD Chinese bodies all find correct IDs. | PASS |
| New v6 backup restore | Prepare and activate filtered v6 backup. New workspace identity; old human search capability rejected. Rebuild yields three documents and no pending dirty entries. All owner bodies searchable; purged content is absent. | PASS |

## Red then minimal fix

Initial run returned empty Opportunity JD search. Strengthening the fixture to assert the public `save-jd` result exposed the actual failure: `{kind:'failure', code:'storage_failed'}` only on release6, while v5 succeeded. Red command:

```sh
npx vitest run tests/integration/g6-search-lifecycle.test.ts --maxWorkers=1
```

`/tmp/career-g6-search-lifecycle/red-jd-detail.log`: exit 1, 2 failing / 1 passing tests. The SQLite minimal reproduction in `/tmp/career-g6-search-lifecycle/sqlite-trigger-proof.log` confirms the trigger `INSERT OR IGNORE` inherits the conflicting outer owner upsert behavior, producing `SQLITE_CONSTRAINT_PRIMARYKEY` and preserving revision 1.

The integration owner changed only notification insertion to explicit `ON CONFLICT(owner,object_id) DO NOTHING` (including company-update selection). This agent did not modify production files. Assertions remain strict: every owner write and purge must succeed, and restore checks body queries separately from title queries.

Integration owner ran:

```sh
npx vitest run tests/integration/g6-search-lifecycle.test.ts tests/integration/g6-search-control.test.ts --maxWorkers=1
```

`/tmp/career-g6/root-seams-green.log`: 2 files / 4 tests PASS (3 lifecycle, 1 control). Exit 0 confirmed by the integration owner from `write_stdin` session 84803. `npx tsc --noEmit`: exit 0, `/tmp/career-g6-search-lifecycle/typecheck.log`. Frozen SHA comparison against `befe2437a9b260237ae5f08a2d11517437a27032`: product 12/12 and architecture 8/8 unchanged (`/tmp/career-g6-search-lifecycle/frozen-sha.log`).

## Limits

This report verifies the actual new search projection/FTS cache, not every unrelated AI summary or other cache format. Broader lifecycle copy, producer and crash evidence remains in the F3 report. No packaged UI, actual macOS power cut, real provider/search/Feishu, Developer ID, notarization or x64 execution occurred here. This line does not close any Issue, change G5 external-live status, or advance to another gate.

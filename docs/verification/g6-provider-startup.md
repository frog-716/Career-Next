# G6 Main startup: incomplete credential state

**PASS for the local startup resolver boundary.** Normal packaged startup verification belongs to root's final build; no whole-G6 PASS is claimed here.

## Red → green

The old Main startup config tested only `security/binding.json` accessibility. If the first save had published a pending configuration marker/cipher but failed before binding creation, Vault correctly reopened disabled while Main silently enabled `fake-v1`. Any filesystem access error was also treated as a fresh profile.

Two public resolver tests first reproduced this exact decision: actual temporary Vault save with a controlled metadata-open EIO, and an actual directory permission EACCES. Both incorrectly returned `enabled:true`; command exit **1**. Logs and SHA are preserved in [g6-provider-startup-results.json](g6-provider-startup-results.json).

The narrow Main capability now distinguishes absent/empty security state from persisted evidence. Marker, cipher or other evidence requires a validated status read. A missing/incomplete binding, a pending marker, malformed status, read failure or security symlink remains disabled. A valid active binding also requires its regular encrypted file. Only genuinely absent/empty state retains the controlled local fake baseline. No credential bytes enter the utility/runtime metadata.

Frozen AI-14 explicitly permits a still-allowed original generation after an uncommitted replacement failure; this branch remains enabled when its original binding/cipher are valid. Explicitly disabled/deleted configurations remain disabled. The fix does not rewrite that product rule or change Vault.

## Actual checks

- Startup resolver **9 PASS**: pending first save without binding, real EACCES, fresh/empty state, marker-only/cipher-only/unknown evidence, valid binding, allowed old replacement failure, disable/delete, malformed/rejected status, directory/binding symlinks.
- Combined startup + existing Vault regression: **2 files / 14 tests PASS, exit 0**.
- Selected Node 24 `tsc --noEmit`: **exit 0**. Scoped diff check: **exit 0**.
- Green first-save fixture performs actual marker/cipher file and directory fsync before the injected metadata failure. Encryption uses real AES-GCM on synthetic values. This is not a physical power-cut or macOS Keychain claim.

Commands, test counts, failure observations and raw log SHA are retained in JSON. All temporary directories are removed. No old Career, real user data, provider/search/Feishu, actual secret or native-module rebuild was accessed.

Main's resolver import and `connect()` config replacement are left for root to commit together with F2's independent Secret coordinator handler changes. This subtask commits only its capability, test and evidence files; packaged Main/utility startup, actual safeStorage and physical sleep/wake are not replaced by these unit results.

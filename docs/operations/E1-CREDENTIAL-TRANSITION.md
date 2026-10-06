# Historical E1 plan — superseded by E2

本文件保留 E1 当时的交接/回退设计，不是当前可执行流程。E2 用户明确禁止读取旧 Key，并选择后续自行重新输入；当前入口见 [CREDENTIAL-REENTRY](CREDENTIAL-REENTRY.md)。代码删除不再以真实凭据解密为前提，旧 Secret 数据保持不动。

# E1 credential transition and rollback

E1 does not read, decrypt or migrate existing real credentials. New native-v1 vaults live in `security-native-v1/` and `security-tavily-native-v1/`, outside business workspaces/backups. Existing Electron `security/` and `security-tavily/` ciphertext and metadata remain unchanged. The browser has no saved-secret getter. Restore disables native service bindings; a configured key is not a restored execution authorization.

## Mandatory authorization stop before real transition

Real transition is NOT RUN. Before accessing an existing credential, show the user the provider slot, local profile, old/new storage implementation and private-memory-only path. Obtain explicit authorization for each actual slot/generation. A system password prompt belongs to the user. Do not read/screenshot/type/record passwords. No service request is part of credential transition.

## Executable sequence for the separately authorized transition

1. Stop the old host and verify its writer lock released. Keep its signed binary, old ciphertext and old metadata intact as the rollback path; no business backup contains keys.
2. Use the original trusted Electron credential resolver once, under the same application/profile identity. Transfer the result only through private bounded IPC to native-v1 encryption; never stdout-to-terminal, args, environment, URL, browser response or business commands. The verified v10 compatibility experiment is not permission to fetch the real Keychain wrapping key.
3. Prepare a disabled native generation. Verify native decryption locally inside the trusted chain and compare in memory. Publish activation only after verification. Record slot/generation and READY/failure, never values or unnecessary ciphertext in Git.
4. On cancellation/deny/timeout/failure, leave original credentials untouched and native binding disabled. Never try another slot/provider, guess a key or silently request re-entry.
5. Reopen the Node host; check safe UI status and explicit local readiness. Egress still needs a new final preview and authorization. No real Search/Provider/Feishu call occurs automatically.

This sequence is deliberately not wired to a default startup action or a runnable real-key migration command in E1. Its authorization step is still pending.

## Rollback

Stop Node with the profile-specific launcher stop command, wait for process exit and writer-lock release, then explicitly start the retained Electron host with that same active pointer/profile. Electron uses its original device vaults. Do not restore an old business backup as part of host rollback. E1 changes no business schema; frozen PDF bytes and snapshots remain readable in both paths. Native credentials do not overwrite legacy credentials; keys entered only in the native path are not automatically copied backward. Report that limitation before rollback.

E2 may remove Electron only after the accepted replacement matrix is complete and existing real credentials are safely transitioned, intentionally discarded with user approval, or proven absent. E1 does not make that decision for the user.

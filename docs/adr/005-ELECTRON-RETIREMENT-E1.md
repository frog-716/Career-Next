# Electron Retirement E1 — approved host amendment

Status: E1 VERIFIED / PASS; E2 VERIFIED / PASS, 2026-10-06. Implementation was approved by the user on the same date; automated replacement acceptance and both final real-environment gates have passed. Evidence: [E1 verification](../verification/E1-ELECTRON-REPLACEMENT.md), [E2 verification](../verification/E2-ELECTRON-RETIREMENT.md).

This explicitly amends the host choices in Frozen V2 ARCHITECTURE §2/§3 and DATA §1/§9, and supersedes ADR 004's temporary Electron platform host. Frozen documents and Product Spec remain unchanged. This is a deployment/platform change, not a new product architecture.

The target default is `Career.app → Node local backend → 127.0.0.1 → Chrome Web UI`. Desktop host means a small macOS launcher plus narrowly scoped native helpers. Electron is not part of the target architecture. E2 removes the former dependencies and adapters after E1 replacement acceptance. No compatibility host is part of the formal engineering path. The complete E1 code is retained only by the local rollback tag `e1-pass-before-e2`.

Owners, contracts, React/A6, SQLite, Kysely, Zod, single writer, persistence fences, AI authorization/preview, Proposal Apply, backup/restore and browser security remain intact. A launcher never owns business state. Closing a tab never closes the writer. Repeated launch reuses a verified host; SQLite lock is the final writer fence. Invalid active pointers fail closed and require explicit verified recovery, never an empty replacement.

Keychain uses a dedicated signed native helper with fixed Career slots, private bounded stdin/stdout, no arbitrary Keychain query, and no browser secret getter. Native-v1 storage is separate from legacy Electron ciphertext. E2 uses TEST secrets only and never reads/migrates real old keys. The user chose later re-entry through the new UI; existing legacy secret data remains untouched.

PDF uses the exact frozen Career renderer and pinned headless Chromium, fixed print settings and a verified font fingerprint. Historical PDFs are read as stored, never regenerated as historical evidence. File import uses a browser-selected byte stream, private bounded staging and the same owner Preview/confirm/cancel; no browser-supplied system paths. Export uses authenticated owner-bound downloads. No native directory picker is added.

All HTTP listening remains 127.0.0.1 with Host/Origin/CSRF, HttpOnly session and per-tab capability/workspace binding. Native helpers and process-control capabilities are not general localhost RPC.

E1 is complete. E2 removes source/dependencies and retires implementation-only probes, while current product coverage runs against Node/Browser/launcher seams. Single-writer Worker, owner contracts, AI final authorization, session security, PDF semantics and A6 are unchanged. Only trusted assembly can select test transports/bindings; the production main supplies none and never falls back to a fake provider.

Real credential data and REAL business data are not removed or migrated. Later credential re-entry, actual external testing and any old Secret retirement remain separate user decisions; see [credential re-entry](../operations/CREDENTIAL-REENTRY.md). Developer ID, Notarization and x64 remain READY / NOT RUN. E2 evidence and the per-file test/reference classifications are in [E2 verification](../verification/E2-ELECTRON-RETIREMENT.md). No push in E2.

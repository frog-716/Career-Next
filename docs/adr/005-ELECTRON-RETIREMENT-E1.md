# Electron Retirement E1 — approved host amendment

Status: APPROVED FOR IMPLEMENTATION by the user, 2026-10-06.

This explicitly amends the host choices in Frozen V2 ARCHITECTURE §2/§3 and DATA §1/§9, and supersedes ADR 004's temporary Electron platform host. Frozen documents and Product Spec remain unchanged. This is a deployment/platform change, not a new product architecture.

The target default is `Career.app → Node local backend → 127.0.0.1 → Chrome Web UI`. Desktop host means a small macOS launcher plus narrowly scoped native helpers. Electron is not part of the target architecture. E1 retains its dependencies and adapters only as an explicit rollback path; E2 removes them after replacement acceptance.

Owners, contracts, React/A6, SQLite, Kysely, Zod, single writer, persistence fences, AI authorization/preview, Proposal Apply, backup/restore and browser security remain intact. A launcher never owns business state. Closing a tab never closes the writer. Repeated launch reuses a verified host; SQLite lock is the final writer fence. Invalid active pointers fail closed and require explicit verified recovery, never an empty replacement.

Keychain uses a dedicated signed native helper with fixed Career slots, private bounded stdin/stdout, no arbitrary Keychain query, and no browser secret getter. Native-v1 storage is separate from legacy Electron ciphertext. E1 writes/tests synthetic secrets only; real credential access/transition needs a separate explicit authorization.

PDF uses the exact frozen Career renderer and pinned headless Chromium, fixed print settings and a verified font fingerprint. Historical PDFs are read as stored, never regenerated as historical evidence. File import uses a browser-selected byte stream, private bounded staging and the same owner Preview/confirm/cancel; no browser-supplied system paths. Export uses authenticated owner-bound downloads. No native directory picker is added.

All HTTP listening remains 127.0.0.1 with Host/Origin/CSRF, HttpOnly session and per-tab capability/workspace binding. Native helpers and process-control capabilities are not general localhost RPC.

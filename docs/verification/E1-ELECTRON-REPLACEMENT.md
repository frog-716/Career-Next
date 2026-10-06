# E1 — replacement host verification

Issue: [#40](https://github.com/frog-716/Career-Next/issues/40). Starting checkpoint: `edf22cd2d533a16906a0995e20c5af972d869929`. Scope: standalone replacement host; Electron deletion is explicitly excluded.

## Implemented path

`Career.app → bundled Node 24.21.0 → one backend/SQLite Worker → authenticated 127.0.0.1 → Google Chrome`. The arm64 bundle does not contain or load Electron. Its launcher only holds the startup lock, checks a verified host, starts the fixed runtime, waits ready, opens Chrome, and provides stop/status. Repeated/concurrent launch reuses the same pid/instance. SQLite exclusive lock remains the final writer fence. Existing Electron adapters and dependencies remain as an explicit rollback path.

Invalid active pointers fail closed into a separate read-only recovery UI. No business owner is available there. A chosen managed backup is validated in an isolated candidate; only an explicit confirmation activates it. An interrupted first bootstrap resumes only its explicit app-created journal; a lost established active pointer still fails closed. Normal backup/restore reuses the existing application owner and invalidates old tabs.

## Automated evidence (TEST DATA only)

- TDD red evidence: missing standalone host, native TEST vault save failure before helper build, file transfer admission rejection, missing packaged launcher, missing pointer recovery path. Captured locally under ignored `out/implementation/e1/`.
- Full unit/UI: 69 files / 202 tests PASS, final serial run. Initial parallel UI timeouts and a package-edit HMR interruption were not treated as product passes; the final stable serial run passes.
- Full integration: 91 files / 453 tests PASS, final serial run; the added interrupted-first-bootstrap case and final E1 slice pass 7/7, giving 454 covered integration cases. Includes existing ownership/AI/secret wait/SQLite/backup/purge regressions and E1 host, Keychain, PDF, pointer recovery, browser files and secret/backup exclusion tests.
- Final reviewed scope: 10 files / 19 tests PASS, including host initialization disk-failure cleanup, actual Chromium close/timeout cleanup, original Browser admission checks and the complete E1 adapters/journey. Typecheck and build PASS.
- Packaged arm64: four cases PASS — concurrent/repeated launch and crash restart; relocated app installation path with spaces/Chinese and bundled runtime; production Chrome journey; framework links remain relative inside the bundle. Repeated packaging PASS. Chrome framework links do not point into the development cache.
- Chrome journey: four modules, opportunity Resume, autosave, center alignment, named frozen version/PDF, settings/help/changelog, feedback draft retention, reload/two tabs/close-reopen, backup/restore old-tab fence, backend stop/restart/reconnect and 600px. Settings offers an explicit background exit with confirmation; startup waits out a stopping process. The production path never silently substitutes a fake provider when credentials are absent. Browser file chooser selects TEST Markdown, shows preview, cancellation leaves no Raw. HTTP owner test confirms idempotency and rejects supplied OS paths.
- PDF: pinned Chromium `153.0.8010.12`, Playwright `1.63.0`, A4/preferCSSPageSize/background/no headers/scale 1. Font files (regular/bold/italic/bold-italic Arial, Arial Unicode MS, Hiragino Sans GB, actual CoreText PingFangUI) are fingerprinted at build and checked at print. OS release and font fingerprints are checked in a dedicated supervised print process; changed engine/environment/fonts fail instead of silently falling back. Its ephemeral printing connection listens only on loopback and stays private to the printing process. Cancel/timeout closes its owned Chromium, with owned process-group termination as a fallback; the parent waits for exit. The same formal static renderer produces a three-page fixture with Chinese, left/center/right, marks and 91 links; all geometry/text/link positions equal retained Electron printing across three generations. Byte identity is not required. Old frozen PDFs remain stored artifacts.
- Keychain: actual native Security.framework/CryptoKit TEST save/read across helper restart/delete PASS. Public protocol rejects saved-secret readback. Private helper pipes are bounded; values do not enter args/environment/URL/logs/business DB/backup. Host-level TEST scan covers profile files including SQLite/command recorder/backups; no TEST credential plaintext found. Restore disables bindings, and restart does not reactivate them. Real credentials have not been read/migrated.
- Browser security: original Host/Origin/CSRF/HttpOnly session/per-tab capability/workspace checks remain; binary uploads and owner-bound PDF downloads share the same checks, body limits and post-body admission checks. Cross-origin, oversize upload, forged path and stored-key reads are rejected. No new retry/fallback/real external request.

## Manual / release boundaries

- Computer Use confirmed real Chrome was automatically opened by Career.app with an isolated TEST profile; four navigation labels and the saved TEST Wiki body are visible.
- Actual system sleep/wake continuity: PENDING USER ACTION. The existing TEST window/backend remains running for verification; not replaced by a simulated clock or a restart.
- Chrome already running: PASS. Chrome fully quit then opened: NOT RUN, to avoid closing unrelated user tabs without handoff.
- Developer ID / Notarization / x64: READY / NOT RUN. Local arm64 bundle is ad-hoc signed. Testing on macOS 26.5 does not claim coverage of the declared minimum OS.
- REAL workspace: read-only verification only; no switch, import or write tests there. Existing real host remains untouched. Final business counts and content hash match the pre-test baseline; private content is not copied into this report.
- Frozen Product 12/12 and Architecture 8/8 hashes unchanged; the approved host amendment is in docs/adr/005, not an edit to Frozen V2.

## Review and E2 gate

Standards/Spec/Architecture review: PASS for the implemented scope. Two independent review agents covered Standards and Spec; host/owner/dependency/privacy boundaries were checked against the approved amendment and existing standards. Review found a cancelled print Worker could leave Chromium alive and a failed bootstrap disk operation could retain the writer lock. Both were reproduced red, fixed and retested green. Repeated packaging also exposed absolute Chrome framework links; the regression now verifies retained relative links and relocation. Final re-review reports no remaining findings. Repository scan: 683 files, no credential-pattern findings; Frozen Product 12/12 and Architecture 8/8 unchanged. TEST credential scans include logs, SQLite/command records and backups without inspecting real credential stores.

Credential transition and rollback plan: [E1 credential transition](../operations/E1-CREDENTIAL-TRANSITION.md). Real transition is not wired into startup or an executable auto-migration command. It requires new explicit authorization and OS-password handoff.

E2 deletion is NOT authorized or started by E1. Before deletion: finish the manual startup matrix, obtain the user's separate E2 instruction, and resolve legacy real credential transition/intentional exclusion without losing the rollback path. E1 is a replacement implementation checkpoint, not a complete signed release.

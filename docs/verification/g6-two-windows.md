# G6 normal packaged two-window Resume

Status: **PASS for the final normal packaged arm64 two-window boundary**. This evidence covers this local desktop boundary only and does not declare full G6 PASS.

The test launches the ordinary arm64 executable with an isolated temporary `userData`, creates a fictional Company/Opportunity through the visible UI, types ASCII into the actual Resume editors, and opens the second window through the production File → New Window menu. No test-only renderer bridge, editor setter, injected transport, or production code change is used. Public read/decision commands supplement the actual UI evidence.

## Verified behaviors

- Both actual editors begin with the same current content. Both type separate drafts from the same saved revision. Exactly one save increments the formal revision; the other editor displays **保存冲突，保留了你的输入**. The losing draft remains visible, the committed text appears in the formal comparison, and both explicit resolution choices are present. Only the test's deliberate “discard local and adopt formal” choice removes that draft; refresh retains the committed body.
- After Proposal generation, the other window saves an unrelated block. Accepting the selected-block rewrite preserves that remote contribution. One AI Undo removes the AI rewrite and preserves the remote body in both the editor and formal document. The Proposal remains accepted.
- A fresh Proposal is prepared, then the other window edits its selected target block. The actual accept button becomes disabled. A supplemental public `product.decide` call also returns `product_conflict`; the formal document and revision are unchanged, both remote contributions survive, and the Proposal remains pending.

## Execution evidence

- Current ordinary packaged arm64 pre-run: **1 file / 2 tests PASS, exit 0**, `/tmp/g6-two-windows-pre3.log`. Command, hashes and observed UI/DTO values are retained in [g6-two-windows-results.json](g6-two-windows-results.json).
- Initial attempts corrected two harness problems: UI cache after an out-of-band seed, and an unavailable Vitest matcher. These were test harness failures, not claimed production regressions or red/green product fixes.
- Final rebuilt package from production source `e70f4de6574604a27ea94111af99cedb5d80e172`: **1 file / 2 tests PASS, exit 0**, `/tmp/g6-two-windows-final.log` and `/tmp/g6-two-windows-final-results.json`. Main actually reports `process.arch=arm64`. App ASAR SHA256 is `7ef33f0ea02a44fb48bac9199539cfd0865010d224b301384b252640f7b9a996`; observed values and file hashes are retained in the JSON report.
- Scoped diff whitespace check: **exit 0**. Frozen Product Spec **12/12** and Frozen Architecture **8/8** remain byte-identical against `befe2437`. No index or commit action is performed by this line; root owns the serial final submission.

The temporary fixture profile is removed after each scenario. Failure dumps contain only these fictional fixtures. Real macOS Chinese IME, real external services, physical power-loss, Developer ID, Notarization and x64 are outside this automated boundary. Frozen Product Spec / Architecture and all production files are untouched.

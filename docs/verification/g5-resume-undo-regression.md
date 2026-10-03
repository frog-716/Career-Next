# G5 Resume AI Apply / Undo 人工失败与修复复验

日期：2026-10-03。G5 继续 PARTIAL，Issue #20 及子 Issue 保持 OPEN，不进入 G6。本文是失败与修复证据，不代替 Frozen 正本，不代表 G5 PASS。

## 原始人工失败

用户在正常 arm64 打包 App 的 `G5 Manual Test` 简历输入「蒸牛蛙，这是中文输入测试 abc123」，手工选中「这是中文输入测试」加粗，接受 `resume-add`，再点击撤销。加粗被一起撤销，且页面提示「保存冲突，保留了你的输入」，要求选择采用正式基线或放弃本地正文。对应用户指出的 RV-P1-03，以及 Frozen AC-UX-06-01 / UX-06。

原失败窗口未被继续自动操作。已只读保存截图、完整辅助功能文本、SQLite 一致快照、blob 及旧打包 App：

- 现场 userData：`/var/folders/cl/wtl8p1w508g43s7b4wqsr5gh0000gn/T/career-next-g5-manual-Xy7e8S/profile`
- 本机失败证据：`/var/folders/cl/wtl8p1w508g43s7b4wqsr5gh0000gn/T/career-g5-resume-undo-failure-nfha12ep/`，含 `failure.png`、`failure-ax.txt`、`profile/`、`CareerNext-failed.app` 和 `metadata.json`。测试数据不提交 Git。
- 旧包 `app.asar` SHA256：`92cf58a7965bef731a162afeac55f6b10006be8a7ec15afd3457fb202ac3c690`。
- 一致快照确认：06:19:09Z 的手工保存是 revision 39，包含加粗；06:27:56Z 的 AI 回执 before=39、after=40，before 与手工保存回执相同；06:29:06Z 的后续保存收到 revision 40 的冲突。服务端确实采用了提案，而编辑器后续保存没有正确接续新基线。

## 红灯与修复

测试接缝：真实 ResumePage / Tiptap 输入、加粗、采纳、撤销，以及真实 Runtime / Resume owner 保存与正式回读。按本轮明确要求覆盖 unit、integration 和正常 packaged smoke；不以数据库私有断言代替公共行为。

最小可运行红灯：`npx vitest run tests/g5-resume-ai-undo-ui.test.ts`。只在本地传输边界延迟采纳后的正式回读，模拟 accepted 状态先被轮询看到、编辑器尚未完成回写的窗口。旧实现允许撤销此前的手工加粗：`strong` 数量期望 1、实际 0；AI 增补仍保留，正式正文的加粗也被移除。红灯日志：`/tmp/career-g5-resume-undo-race-red.log`。此自动红灯复现了错误撤销；原现场的保存冲突另由上述人工与快照证据确认。

修复在 Resume 编辑会话内完成：

- 采纳开始时就进入回写保护；完成或核对前暂停 toolbar 与键盘 undo / redo，无关正文仍可编辑。
- 采纳请求返回前，由 Resume 编辑器完成回执处理、独立 AI history transaction 和新 revision 基线交接，避免任务视图丢弃过期响应时漏掉编辑器更新。
- 沿用既有独立 AI 撤销组；撤销只修改当前 Resume，不修改已 accepted Proposal。真正的远端并发冲突仍保留比较流程。
- 丢失回执时保持原命令、保护与明确核对路径，不自动重发或假装已完成。

## 验证与待复验

- Resume unit：5 文件 / 13 测试通过，含 toolbar / 键盘回写时序回归与原 unknown-receipt 回归。
- Resume / 产品接缝 integration：8 文件 / 14 测试通过。
- 最终 toolbar / 键盘时序回归与 normal dev 新/已有任务回归：2 文件 / 4 测试通过。
- 新正常 arm64 包：Resume 新/已有任务 Undo、G2 Resume/PDF、G5 完整桌面旅程、G5 多窗口共 4 文件 / 5 测试通过；追加正式 Proposal 回读断言后，最终 packaged Undo 回归 2 / 2 通过。
- `npm run typecheck`、构建、打包及 `git diff --check` 通过。测试支持指定 `CAREER_PACKAGED_EXECUTABLE`，因此没有覆盖正在保留失败现场的旧包。

最终日志在本机 `/tmp/career-g5-resume-unit-results.log`、`/tmp/career-g5-resume-integration-results.log`、`/tmp/career-g5-resume-final-regression-results.log`、`/tmp/career-g5-resume-packaged-results.log`、`/tmp/career-g5-resume-final-packaged-regression.log`、`/tmp/career-g5-resume-typecheck.log`。真实跨窗口修改的冲突比较与 unrelated live input / unknown receipt 场景仍通过，没有关闭冲突检查来获取绿灯。

## 独立人工复验实例（已打开，待用户）

- 正常包：`/var/folders/cl/wtl8p1w508g43s7b4wqsr5gh0000gn/T/career-g5-resume-fixed-package-QoL6lz/CareerNext-darwin-arm64/CareerNext.app`。
- 新包 `app.asar` SHA256：`0221e12826f33dabc78fcfaad793ab03a8cf4119f92784a34631e0cf251439e5`。
- 全新隔离 userData：`/var/folders/cl/wtl8p1w508g43s7b4wqsr5gh0000gn/T/career-g5-resume-undo-retest-zWApx3/profile`。
- 标题：`G5 Manual Test · Resume Undo Retest 的简历`；机会 `f9b133cb-1439-45d9-bdd7-fb7f106ed702`；简历 `b9ab5366-fb8c-415c-bc31-0a3d594bb6b0`。
- 已通过普通 UI 选第一段英文并读取已有任务 `c47ae68a-8d06-4dc8-9aef-717b76a2f2d4`；`resume-add` 提案 `f27d29d1-bbef-460f-a10e-81278d578a7d` 仍 pending/current，未自动接受。
- 为便于真人输入，提案面板已收起，正文已聚焦末尾 `Manual input area:`。用户可重做原先的中文输入、手工加粗、打开提案、接受 resume-add、撤销。没有为用户输入中文、切换输入法或操作候选窗口。
- 元数据：`/tmp/career-g5-resume-undo-ready.json`；新实例准备截图/辅助功能文本位于上述新临时目录的 `ready.png`、`ready-ax.txt`。

自动测试的中文字符串只作为确定性文档夹具，不是 macOS IME PASS。原人工 FAIL 保留，修复后仍须用户亲自复验输入、手工加粗、接受 resume-add、撤销及保存状态；尚未关闭任何 G5 Issue，没有最终 checkpoint 或 push。

2026-10-03 用户后续确认：本轮真实操作的 Undo 已撤销 AI 修改，并保留之前手工加粗。紧接着命名版本历史预览丢格式的新 FAIL 见 [版本格式](g5-version-format-regression.md)。这是 Undo 子步骤的人工确认，不是整个 G5 PASS。

## 真人最终结算

2026-10-03 用户明确报告本项修复复测 PASS，完整中文输入、手工加粗、Apply / Undo、命名版本历史和 PDF 链已由本人完成。原失败现场及修复前的等待状态作为历史保留；当前结论见 [真人最终证据](g5-manual-desktop-final.md)。G5 总状态仍 PARTIAL（仅真实外部待验），本轮开发 Issues 按最新授权收尾。

最终收尾补充：以上原红灯日志仍保留，SHA256 `4e75f1fb5e1b8d227c8ad03995d13a18c783f12762c4718498b01bde37ed06b8`；修复后同一公开/UI 行为纳入最终 unit / integration / dev / arm64 packaged 回归，结果见 [最终执行记录](g5-auto-results.json)。

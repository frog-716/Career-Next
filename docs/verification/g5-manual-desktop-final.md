# G5 真人桌面最终验收

日期：2026-10-03。用户明确报告 `G5 MANUAL DESKTOP: PASS`。这是本轮正常 macOS arm64 包的真人证据，不把自动化输入当作 IME。

| 范围 | 真人确认 |
| --- | --- |
| 简体拼音 | composition、候选框、中文提交、中英文连续输入、光标正常，无重复或丢字 |
| Resume | 选区及加粗、Proposal Apply、独立 Undo；此前手工正文与格式保持，Proposal 仍 accepted |
| 冻结版本与 PDF | 重新创建命名 ResumeVersion 后格式保留；历史查看、取消恢复及当前稿保持；PDF / 命名版本冻结保存 |
| 焦点与键盘 | ⌘S 弹窗 Esc 后焦点回正文；Enter、Backspace、Undo 等实际操作正常 |
| 显示与窗口 | 放大、缩小、重置；约 600px 窄窗口滚动与编辑正常 |
| Feedback | 打开、返回及底层草稿保持 |
| 页面连续使用 | Wiki / Opportunity / Project / Employment 及机会内 Research / Communication / Interview / Offer 可达，返回 Resume 后正文与格式保持 |

## 独立 Computer Use 与人工补证

独立 GPT-6 Luna、空上下文、Computer Use 原始记录已归档到 [g5-computer-use-manual.md](g5-computer-use-manual.md)。它曾真实发现 Undo 冲突与 PDF 受阻，并将 IME 留 HUMAN_ONLY；没有用程序中文冒充真人。其原 FAIL 保留，最终真人实际操作与修复复测补齐了未通过、无法可靠控制的操作。本轮没有新增生产内测试教程。

## 两个真人缺陷

1. Apply / Undo 曾撤销用户先前手工加粗并产生保存冲突。同步保护、独立 history group 和 revision 回执交接修复后，用户明确复测 PASS。红绿及现场见 [Undo 记录](g5-resume-undo-regression.md)。
2. 命名版本历史曾不显示加粗。用户报告“丢失 bold”；分层核对确认当前 JSON、冻结 JSON 与原 PDF 均保留 bold，真正丢失发生在历史 renderer。修复只读预览后，用户重新命名、查看历史、取消恢复、确认当前稿，复测 PASS。见 [版本格式记录](g5-version-format-regression.md)。

最终真人实例：`G5 Manual Test · Version Format Retest 的简历`；正常包 app.asar SHA256 `04b1fbda5936d8be8a931e445b68344be7ce4f7ce8b7c24d195049dbceb4ab3f`；隔离 profile `/var/folders/cl/wtl8p1w508g43s7b4wqsr5gh0000gn/T/career-g5-version-format-retest-Nljr8l/profile`。未操作真实职业资料，未读旧 Career。

人工结束后的只读 SQLite 一致快照与冻结 PDF 保存于 `/var/folders/cl/wtl8p1w508g43s7b4wqsr5gh0000gn/T/career-g5-final-human-evidence-28cuw7zj/`；当前正文、冻结版本 JSON 和 PDF 字节分别保存。该快照只是补充真实性证据，不能代替真人输入报告。最终打包后的自动回归另见 [连续旅程](g5-complete-journeys.md)；收尾审查中的 Offer 局部修复没有改 Resume 编辑器。

## 结算边界

真人桌面与本轮普通本地产品流程 PASS。104 矩阵三项真人 AC 结算为 PASS_G5；真实 Search / Feishu 外部 J-07 尚未完成，故 G5 总状态保持 PARTIAL，仅外部待验。本轮开发 Issues 按用户最新明确授权关闭，不把关闭 Issue 当成完整外部旅程通过。

REAL PROVIDER / REAL SEARCH / REAL FEISHU = NOT TESTED。Developer ID signing / Notarization / x64 = READY。DEFER_G6、DEFER_M、EXTERNAL_LIVE_PENDING、CONDITIONAL 保留，见 [104 矩阵](g5-acceptance-matrix.md)。不进入 G6。

三项真实 UX 困惑进入 [polish backlog](../backlog/g5-ux-polish.md)，不更改 Frozen 正本，不阻断本轮桌面结算。

# G5 命名 ResumeVersion 格式人工失败与复验

2026-10-03。G5 继续 PARTIAL；Issue #20 保持 OPEN，不进入 G6。本记录不替代 Frozen 正本。

## 原始人工失败与分层核对

用户真实输入「蒸牛蛙，这是中文输入测试 abc123」，手工加粗「这是中文输入测试」，接受 resume-add 后 Undo。用户确认 AI 增补已撤销、手工加粗仍保留；随后命名 `G5 manual baseline`，历史预览没有显示加粗。

现场没有继续自动编辑。保存了 SQLite 一致备份、原 blob、原 App、辅助功能文本和截图。本机证据：`/var/folders/cl/wtl8p1w508g43s7b4wqsr5gh0000gn/T/career-g5-version-format-failure-ndb7qhww/`。测试实例与文件不提交 Git。

| 层 | 实际证据 | 结论 |
| --- | --- | --- |
| 当前 ResumeDocument | 简历 `b9ab5366-fb8c-415c-bc31-0a3d594bb6b0`，revision 10；`current-document.json` 含普通中文、bold 中文及普通 abc123 | 当前格式完整 |
| 冻结 ResumeVersion | `349b6bc9-6c7b-4c84-8df7-cb6bac7adcda`、`d80d9138-d854-4cec-9f47-d41d90d36c55` 两个同名版本均冻结 revision 10；`frozen-versions.json` 的完整 content 与当前稿相同，bold 存在 | A 排除，保存未丢 marks |
| 历史预览 | `failure.png`、`failure-ax.txt`；原 renderer 只拼接 span.text，列表也拼接成斜线文字 | B 确认，预览丢格式 |
| 对应冻结 PDF | 两份均为 61299 字节；SHA 与各自冻结 PDF digest 相同；逐字字体检查和页面渲染均显示目标中文为 PingFangSC-Semibold，普通中文为 Regular | C 排除，本次原 PDF 保留加粗 |

PDF SHA256 分别为 `d19cda2278fb19cc1a1970310977c590c2cbd7a73e5c08ef56ba346660fe67fa`、`46eb7723caa042106a642599ad739799e1cd96c614459c51db11dc0956564126`。证据目录含 `pdf-format-evidence.json`、两个 `frozen-pdf-<versionId>.png`；原包 app.asar SHA 为 `0221e12826f33dabc78fcfaad793ab03a8cf4119f92784a34631e0cf251439e5`。

## 红灯与修复

先运行 `npx vitest run tests/resume-session.test.ts -t 'named version freezes'`：真实 ResumePage、真实 SQLite owner 完成保存和冻结，JSON marks 断言通过；历史预览 strong 期望「这是中文输入测试」「List bold」，实际空数组。原始红灯日志 `/tmp/career-g5-version-format-red.log`。

修复仅在 Resume 历史只读展示：按冻结 CareerDocument 渲染段落与 bullet-list，并展示已有 bold / italic / strike / link marks，保留空格和换行。React 文本节点负责转义，没有导入任意 HTML，也没有重新初始化编辑器。没有改变存储、数据库、版本冻结、PDF renderer 或 AI Undo 行为。

普通正文、bold、italic 和列表已走同一冻结内容路径，验证了命名、后来编辑当前稿、查看历史、恢复和重新打开后的完整 content。实际桌面 PDF 另查字重、斜体与列表，自动化中文夹具不代表真人 IME 验收。

## 验证及人工复验

- Resume unit / integration：10 文件、25 测试通过，含先红后绿的历史预览回归、既有 Undo / unknown-receipt、版本文件及冻结来源接缝。
- 新格式桌面回归 dev：1 / 1 通过；最终正常 arm64 packaged：3 文件、4 测试通过（版本格式、Resume Apply / Undo 新/已有任务完整链、G2 Resume / 实际 PDF）。
- PDF 解析检查正文、bold / italic 字体与列表；页面渲染复核可见普通正文、加粗、斜体和真实 bullet。恢复及 App 重启后冻结 JSON 与 PDF 字节保持不变。
- typecheck、build、独立正常 arm64 package 和 git diff --check 通过。Frozen Product Spec 12/12、Frozen Architecture 8/8 SHA 未变；只改 Resume 历史展示、回归和证据文档，其他既有脏改动没有覆盖或撤回。
- 本机日志：`/tmp/career-g5-version-format-regressions.log`、`/tmp/career-g5-version-format-dev.log`、`/tmp/career-g5-version-format-packaged.log`、`/tmp/career-g5-version-format-typecheck.log`、`/tmp/career-g5-version-format-build.log`、`/tmp/career-g5-version-format-package.log`。实际 PDF 与字体证据为 `/tmp/career-g5-version-format-pdf.pdf`、`/tmp/career-g5-version-format-pdf-fonts.json`、`/tmp/career-g5-version-format-pdf.png`。

独立真人复验实例已用普通 UI 打开：

- App：`/var/folders/cl/wtl8p1w508g43s7b4wqsr5gh0000gn/T/career-g5-version-format-package-KzIezf/CareerNext-darwin-arm64/CareerNext.app`；app.asar SHA256 `04b1fbda5936d8be8a931e445b68344be7ce4f7ce8b7c24d195049dbceb4ab3f`。
- 隔离 profile：`/var/folders/cl/wtl8p1w508g43s7b4wqsr5gh0000gn/T/career-g5-version-format-retest-Nljr8l/profile`，正常进程 16346 只带 user-data-dir 参数，没有调试端口。
- 标题：`G5 Manual Test · Version Format Retest 的简历`；Resume `8bee44cb-d2ab-497d-a08b-8ee9b7c2360a`，revision 2，命名版本数量 0。
- 已读取本地受控任务 `4acbeeac-f1d5-4f81-abc4-5636638a67a9`；resume-add `e97b7ee7-764a-4113-b674-28ec990a0e49` 保持 pending/current，没有自动接受。
- 已收起提案面板，光标停在空白的 `Manual input area: ` 之后，等待用户亲自输入、手工加粗、采纳、Undo、命名和查看历史。未为此实例输入中文、切换输入法或控制候选窗。
- 准备截图与 AX：`/var/folders/cl/wtl8p1w508g43s7b4wqsr5gh0000gn/T/career-g5-version-format-retest-Nljr8l/ready.png`、`ready-ax.txt`；完整元数据 `/tmp/career-g5-version-format-ready.json`。

原失败现场保留，真人复验未结算；G5 Issue #20 只读确认 OPEN，没有最终 checkpoint 或 push，不进入 G6。Developer ID signing / Notarization / x64 继续 READY。

## 真人最终结算

2026-10-03 用户明确报告本项修复复测 PASS，完整中文输入、手工加粗、Apply / Undo、命名版本历史和 PDF 链已由本人完成。原失败现场及修复前的等待状态作为历史保留；当前结论见 [真人最终证据](g5-manual-desktop-final.md)。G5 总状态仍 PARTIAL（仅真实外部待验），本轮开发 Issues 按最新授权收尾。

最终收尾补充：以上原红灯日志仍保留，SHA256 `a2cfb1072366fef5ef61e24d75836ffa28c7f5fa7fdf1dd8a85a96bf9fa0e280`；修复后同一公开/UI 行为纳入最终 unit / integration / dev / arm64 packaged 回归，结果见 [最终执行记录](g5-auto-results.json)。

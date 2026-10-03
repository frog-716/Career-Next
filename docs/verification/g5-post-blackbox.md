# G5 post-blackbox 收口

当前结论：真人 MANUAL DESKTOP PASS；G5 总状态仍 PARTIAL，唯一整体未验原因为 J-07 真实外部待验。本文只补来源核对、最新用户实际证据和本轮重新回归，不创建新产品 Gate，不进入 G6。

## 只读来源核对

本轮指定 OLD MAIN：`5f16661624eab1800efa3d09a2500d5a3a9e53bb`，远端 main 已实读核对。该提交已包含两个 Resume 修复、红绿/UI/desktop 回归及 Luna 原报告；“main 尚未包含修复”与实际 Git 文件不一致。本轮不重复制造修复提交，也不把无关整个 worktree 合入。

来源 Agent：`/root/g5_luna_blackbox`。来源 worktree：`/Users/frog/.codex/worktrees/g5-computer-use/Career-Next`，分支 `codex/g5-computer-use`，HEAD `0f8cd658901f2485666121fb932f83d68c458202`。只读 status 只有未提交 `docs/verification/g5-computer-use-manual.md`，没有修复源码、测试或其他脏改动。没有发现另一个 G5 修复分支；实际修复位于主工作区并已进入 OLD MAIN。其他 G2/G3/G4 历史 worktree 未合并、未改动。

来源原报告 SHA256：`1d0985b391c6fa3c7575c1e981df12e496e53bb9b3c6aad6156ceee41c5aa110`；仅去除 Markdown 行尾空白后，全文已经是 main 正式报告的完整前缀，main 另有最终人工结算段。来源 worktree 原件保留不动。源码/测试/修复记录逐文件核对 OLD MAIN 如下：

| 文件 | OLD MAIN SHA256（与核对时主工作区一致） |
| --- | --- |
| `packages/frontend/features/resume/index.tsx` | `980b64c9309c2687564b0a180c857b68de408c7a170ac3dd9352309c32dd3fe8` |
| `packages/frontend/features/resume/frozen-body.tsx` | `decca6d008aed7baed8e1d5e32bf574e0c9bae9c021ab3e4e3a28bd2871dbb39` |
| `packages/frontend/features/resume/resume.css` | `fd1dace13757aa62b36749fc97abb6f6e7d78c8eebff338c7db14de643c8bcaf` |
| `packages/frontend/support/ai/product-task.tsx` | `b6f2fcdd7a13d11d583e8c2c8724c0be8334d3cc742dedc1de47c500a52ffd73` |
| `tests/g5-resume-ai-undo-ui.test.ts` | `3817cfc3eb72a629bd316c63badc514f082f8856c32211bfdb8796be80e3c249` |
| `tests/g5-resume-ai-unknown-ui.test.ts` | `2aeaba23e38ba1608543bed86419eba1ac590b67dd5839571fabca3485357417` |
| `tests/desktop/g5-resume-undo.electron.test.ts` | `28cce6adf56c30b20413ec6454a4e2f85b5af676d5f7110b6c9f6fbc9bdf25e5` |
| `tests/desktop/g5-resume-version-format.electron.test.ts` | `3cc99eec98a646a1e2285977d1f038d720cf62167687874fd38a65ab28a5e98f` |
| `tests/resume-session.test.ts` | `15be04ebbc4e6f1c0992c328e0b5081bd8becf67b695e80494da88ae1ef1081d` |
| `docs/verification/g5-resume-undo-regression.md` | `103904e5b860508fa8f515ba0522dd707c89817da901dd7e197e6d9dd3f707f2` |
| `docs/verification/g5-version-format-regression.md` | `93526bb0a4f0afd0ead3e6e148191c636ea06229b12234fe2e5552c00d888aee` |

额外修复代码待合入：**0**。本轮初始 main clean，没有无关未提交改动。旧 Career 未读取。

## 三种证据

| 来源 | 能证明什么 | 不扩大结论 |
| --- | --- | --- |
| AUTOMATED | 真实 Resume UI/owner 的手工编辑、bold、Apply、独立 Undo、accepted 不复活、保存接续、冻结 JSON、历史 renderer、取消查看和真实 PDF 字体/文件；本轮重新执行见下节 | 自动化中文夹具不是 macOS IME |
| LUNA COMPUTER USE | 空上下文在旧正常包实际发现 Undo 保存冲突及 PDF 受阻；真实菜单缩放及部分连续使用；原始 FAIL/部分通过仍保留 | IME 留 HUMAN_ONLY；选区/插入点控制不确定，不改写成 PASS；原报告没有独立发现后来的版本 bold renderer 故障 |
| HUMAN MANUAL | 用户本人复现两个缺陷，修复后真实键盘/输入法、选区 bold、Apply/Undo、命名版本/历史/PDF 及整段桌面连续操作复测 PASS | 不替代真实 Provider/Search/Feishu |

原始 [Luna 报告](g5-computer-use-manual.md)、[Undo 红绿与失败现场](g5-resume-undo-regression.md)、[版本格式分层核对/红绿](g5-version-format-regression.md)、[真人最终证据](g5-manual-desktop-final.md) 都保留。BUG 2 的当前/冻结 JSON 和原 PDF 原本已有 bold，实际修复在只读历史 renderer；不伪称持久化丢 marks。

最新用户补证：Feedback 打开 → 返回并保留底层草稿 → 再打开反馈草稿仍在 PASS。两个同名 `G5 manual baseline` 是用户实际点击两次保存；本轮不将同名当作 Bug，不新增名称唯一性规则、不去重或删除版本。三项 UX 发现仅记录 [polish backlog](../backlog/g5-ux-polish.md)，不做 UI 重构，不改 Frozen。

## 本轮重新回归

本轮日志位于 `/tmp/career-g5-post-blackbox/`。结果在执行完成后写入 `g5-post-blackbox-results.json`；旧执行记录 [g5-auto-results.json](g5-auto-results.json) 不改写。必须覆盖 npm ci、typecheck、unit、integration、build、G0 unit/build/真实 Electron、G1–G4 和 G5 普通 dev/packaged、正常 arm64 package、codesign 本地校验、git diff --check。

Standards / Spec 独立复审与 Architecture 复核结果在完成后追加本节。本轮没有产品代码变更，不因此扩大上一轮证明的范围。已记录的 G4 基线 Wiki late-open P2 仍留 DEFER_G6，详见 [上一轮 review](g5-final-review.md)，不宣称该晚到回读行为 PASS。

## 状态与 Git 顺序

104 仍为 **38 PASS_ALREADY / 31 PASS_G5 / 28 DEFER_G6 / 5 DEFER_M / 1 EXTERNAL_LIVE_PENDING / 1 CONDITIONAL**，合计104，不升级外部或后续门禁。REAL PROVIDER / REAL SEARCH / REAL FEISHU = **NOT TESTED**。Developer ID / Notarization / x64 = **READY**。

#20 按本轮用户授权重新打开并追加 `Post-close independent blackbox findings`，明确实际来源和 OLD MAIN 已包含修复。完成必要回归和证据后创建新的 G5 post-blackbox checkpoint；push main、实际远端 HEAD 一致且 clean 后再关闭 #20。具体新提交及关闭结果以 Git 和 Issue 收口记录为准。Frozen Product Spec 12/12、Architecture 8/8 SHA 按本轮基线及 G4 原基线复核，不能改正文。不进入 G6。

## Standards

### 独立 Standards reviewer

基线与范围：已合入修复按 `0f8cd658901f2485666121fb932f83d68c458202...HEAD` 的指定 Resume / ProductTask / 回归文件审查；新 checkpoint 按 OLD MAIN `5f16661624eab1800efa3d09a2500d5a3a9e53bb` 至当前工作区及 `g5-post-blackbox.md` 审查。标准为全局/项目 AGENTS、MAP、docs/agents/domain.md、issue-tracker.md、Frozen MODULES §7.2–7.3 和 ADR-002；smell 仅作判断性启发，repo 标准优先。

### Findings

本轮 documented hard violations：**0**；实质 smell：**0**；新增阻断：**0**。

已实读修复和测试，未只依赖上轮报告：Resume 同步建立 Apply 保护、阻止在途 history transaction，并在任务视图可能丢弃过期响应前完成回执 reconciliation；patch 前后显式 closeHistory。Undo 保存当前 Resume，未把 accepted Proposal 复活。unknown 回执仍保留原 command 与保护路径，未引入静默重发。

历史预览独立消费冻结 CareerDocument，渲染既有 marks 与列表、不替换 live editor。真实 UI 回归核对手工 bold、孤立 Undo、无保存冲突、正式 owner 回读及 accepted 状态；版本回归核对完整 JSON、只读预览、实际 PDF 字体/文件、恢复及重启。自动中文夹具均明确不是真人 IME。

本轮新增文件仅是验证文档，MAP 已补长期导航，符合全局 AGENTS“核心入口变化时同步更新”及 domain.md“不复制或替代冻结正本”。证据分别记录 AUTOMATED / LUNA COMPUTER USE / HUMAN MANUAL；保留 Luna 原始 FAIL/HUMAN_ONLY，不把用户后来发现的版本 renderer Bug 归给 Luna。明确 OLD MAIN 已含修复，不重复合并 worktree；同名版本两次人工保存未新增去重规则。104 分类、J-07 external pending、真实服务 NOT TESTED 和签名/公证/x64 READY 均保留。

基线已知风险仍为 **1 项 P2**：Wiki late-open 可能覆盖新 dirty 输入，违反 MODULES §7.2 的保留要求；它不是本轮新增或已修复行为，继续明确 DEFER_G6，不算晚到回读 PASS。

本 reviewer 只读仓库，未读旧 Career、未操作 App、未执行测试；仅写本临时报告。当前文档没有把尚待 root 执行的回归写成新绿灯。最终回归、Frozen SHA 与远端状态须由 root 的本轮执行结果结算，不沿用旧日志冒充。

## Spec

### 独立 Spec reviewer

范围：最新用户附件d957a408…、OLD MAIN 5f166616…、0f8cd65至HEAD指定Resume修复/测试diff，以及本轮verification增量。只读；不运行测试或App、不读旧Career、不修改仓库。

(a) 缺失/partial：未发现新的G5本地实现缺口。当前重新tests/packaged结果尚待集成owner完成并写入post-blackbox结果；不能引用旧绿色日志充当本轮执行。G5 overall PARTIAL（仅J-07真实外部），符合最新请求§六和Frozen JOURNEYS J-07“查看真实Search结果”。104逐行实核：唯一104、Frozen集合一致，38/31/28/5/1/1；真实Provider/Search/Feishu NOT TESTED，发布三项READY。已有Wiki late-open P2按g5-final-review留DEFER_G6，不宣称所有晚到回读已通过。

(b) 越界：未发现。OLD MAIN实含两个修复、回归、Luna报告；指定worktree HEAD0f8cd65仅untracked原报告，无代码待合并。9个源码/测试文件当前SHA与OLD MAIN和来源表全一致；正文增量仅导航/证据/最新真人结算。同名baseline源于两次人工保存，无去重规则。Frozen产品12/12、架构8/8与G4基线字节一致。

(c) 看似实现实则错误：未发现新增明确finding。对照Frozen UX.md:63–67 / AC-UX-06-01，resume/index.tsx:58–64独立history事务，:83同步保护键盘撤销，:94–102在任务过期丢弃前完成editor更新及revision交接；Undo不修改acceptedProposal。对应真实UI回归覆盖toolbar/keyboard、既有任务和unknown原回执；原红灯SHA4e75f1…与记录一致。

对照最新请求BUG2和Frozen DM-22，frozen-body.tsx:4–24只读渲染冻结marks/list；resume-session红灯真实strong为空，SHA a2cfb107…匹配。desktop格式回归核对JSON、历史样式、实际PDF字体、恢复/重启。用户后发现的是历史renderer，冻结JSON/PDF原本正确；没有错误扩成存储修复。

证据边界：post-blackbox.md:31–39和computer-use追加段正确区分AUTOMATED / LUNA / HUMAN；Luna只证Undo冲突/PDF受阻，IME HUMAN_ONLY。真人最终PASS含Feedback返回再打开草稿保持；旧FAIL保留。代码/文档审查无新增阻断；最终回归、push/clean再关闭Issue顺序由root确认。

## Architecture

按 Frozen MODULES §7.2/7.3、ADR-002 核对已有两个修复：独立 AI history group 与 revision 接续由 Resume 编辑会话管理；Undo 只改当前稿，不改 Runtime 已 accepted 状态；历史视图只读消费完整 CareerDocument marks/list，不把 renderer 变成第二份正文 owner。PDF、版本冻结与已有 owner 的 backend 语义未变。

本轮 `git diff OLD_MAIN -- apps packages tests` 为空，没有改 Contract、依赖方向、事务、owner 或数据库，没有复制整树、引入新抽象或 UI 重构。Architecture 无新增阻断。G4 已知 Wiki late-open P2 仍具体记录在 [上一轮 review](g5-final-review.md) 与 DEFER_G6，不升级状态，不在本轮实施。

两份独立报告写于最终桌面执行期间；它们的等待描述保留该时点，最终新绿灯只取本轮实际执行日志和下方结果，不沿用历史日志。

## 本轮最终执行结算

本轮实际重新运行：npm ci **0 vulnerabilities**、typecheck / build PASS；unit **38 文件 / 82 测试**、integration **59 文件 / 239 测试**；G0 **3 unit + 1 真实 Electron smoke** PASS。开发态与正常 arm64 packaged 全套桌面各 **10 文件 / 11 测试** PASS，无未处理错误，包含 G1 材料、G2、G3、G4 及 G5 Resume / 完整旅程 / 多窗口回归。两个修复是已有代码的新一轮 green，未把历史红灯重新冒称为当前执行。

本轮 normal app：`out/g5-post-blackbox/CareerNext-darwin-arm64/CareerNext.app`；ASAR SHA256 `765d7ec87cfb9eeffa92808abd943d428680b7d0beea605b1fcf7ad0455b923d`，正式 dist **7/7** 与当前构建逐字节一致，无 tests/probe/test-support/.env/Skills。`codesign --verify --deep --strict` PASS 仅本地 ad-hoc，Developer ID / Notarization / x64 继续 READY。本轮包经新 npm ci/native preparation 生成，构建/包摘要来自本轮，不冒用旧手工包。

完整命令、日志 SHA、来源表与包核对见 [本轮结构化结果](g5-post-blackbox-results.json)。当前源代码/测试与 OLD MAIN 完全相同，额外业务代码合入 **0**；冻结产品 **12/12**、架构 **8/8** 与 OLD MAIN 及 G4 原基线逐字节一致。104 ID/分类及链接再次核对一致，38/31/28/5/1/1 不变。Standards / Spec 独立复审与 Architecture 复核无新增阻断；保留明确的 Wiki 基线 P2。

#20 最终关闭条件：新的证据 checkpoint 推送 main 后，核对本地 HEAD = origin/main = 实际远端 main 且 `git status --porcelain` 空，再关闭并添加提交链接。此结算不执行 G6，也不改变 G5 PARTIAL / 真实外部 NOT TESTED。

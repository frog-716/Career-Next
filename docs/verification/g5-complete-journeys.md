# G5｜完整旅程与真实桌面连续性（最终收尾）

最终状态（2026-10-04）：**G5 PASS**，J-01～J-09 产品、真人桌面及 J-07 真实三个服务分支均已通过。证据见 [J-07](j07-real-external.md)。G6 LOCAL PASS；104 最终结算为 38 PASS_ALREADY / 32 PASS_G5 / 28 PASS_G6 / 5 DEFER_M / 1 CONDITIONAL，EXTERNAL_LIVE_PENDING=0。下文旧 PARTIAL/NOT TESTED 为当时记录，未追溯改写。

最新 J-07 真实外部结果见 [补验文档](j07-real-external.md) / [#31](https://github.com/frog-716/Career-Next/issues/31)，三个分支均 PASS；下面普通旅程的测试接缝和执行记录属于原 G5 本地阶段。

本轮使用隔离的空工作区、临时真实文件、真实 SQLite、正常 Electron 进程与 arm64 包。职业数据均为明确测试资料。Provider 为 deterministic fake；Search 为 controlled adapter；Feishu 为无网络 shaped fixture。REAL PROVIDER / REAL SEARCH / REAL FEISHU 均 **NOT TESTED**。Developer ID、Notarization、x64 均 **READY**；本地 ad-hoc 签名校验不能替代这些发布验收。

## 连续旅程与证据层

下列路径均相对仓库根；正常桌面测试在开发态及 arm64 打包态分别执行。命令结果见下节，精确摘要见 `g5-auto-results.json`。测试通过仅覆盖列明的本地产品链。

| Journey | 实际执行 | 证据 |
| --- | --- | --- |
| J-01 | 空库无外部服务：公司+岗位无 JD、后补 JD 保持身份；Personal/Cognition 首条知识；取消空知识不留记录；Project/实际 Employment 独立创建；无 AI 可制 PDF、面试/Offer 人工记录 | `tests/desktop/g5.electron.test.ts`、`g2.electron.test.ts`、`g3.electron.test.ts`；`tests/integration/g5-onboarding.test.ts` |
| J-02 | Employment A/B、任职人物/项目职责 → Project 范围真实文件 Raw → Wiki 及实际 Transcript 来源 → 历史 → fake Wiki 拒绝/接受 → Project 换 Employment、旧角色历史保留 → 更正真实 Transcript、衍生知识待复核且正文不改 → Raw 影响确认/purge，独立知识 owner 保留 | `tests/desktop/g5-work-accumulation.electron.test.ts`；`tests/integration/g4-source-support.test.ts`、`g4-wiki-provenance-review.test.ts`。不可覆盖 Raw 不提供普通编辑；Wiki 上下文普通修订与实际可更正来源变化有别 |
| J-03 | 沟通先行、无首次投递直接真实面试、无面试直接 Offer、晚录历史、结束后补录、真实继续和原事件纠错；未知日期不补今天 | `tests/desktop/g2.electron.test.ts`、`g3.electron.test.ts`、`g5-sagas.electron.test.ts`；`tests/integration/opportunity.test.ts`、`g4-s-communication.test.ts`、`g3-core-capabilities.test.ts` |
| J-04 | Resume 当前稿连续保存 → 命名/PDF A → 当前 B → 真正 Submission 选择冻结 A → 后续真实文件发送；独立版本内容复制；retained/file_missing/content_unknown/not_used 四种事实与 Greeting 三种状态分开 | `tests/desktop/g2.electron.test.ts`、`g4.electron.test.ts`、`g5.electron.test.ts`；`tests/integration/g4-s-submission.test.ts`、`g4-s-communication.test.ts`、`g5-resume-copy.test.ts`、`g5-frozen-resume-lineage.test.ts`。最后一项的 PDF 二进制为边界夹具，真实 Chromium PDF 由 desktop 另证 |
| J-05 | 日期未知真实轮次 → 排期、Preparation 草稿 → 同一轮 2 次 Simulation/文字稿/Review → 主动选本人片段并确认含义、受限 Wiki → 真实 Transcript/Review → Transcript 更正仅标复核 → 人工当前 Final Review → Research 组采用 | `tests/desktop/g5-sagas.electron.test.ts`；`tests/integration/interview.test.ts`、`g5-product-policies.test.ts`、`g5-submission-preparation.test.ts`。无 Submission 明示缺项；有 Submission 读取当时冻结材料，不能以当前 Resume 冒充 |
| J-06 | 无投递/面试直接 Offer 原件/30k → fake 分析草稿 → 真实谈薪 Communication → 35k 正式替代/人工接受 → 32k 正式替代回 active → 35k 接受依据仍保留 → 报到沟通 → 招聘方撤回 → 另一真实入职独立手工 Employment | `tests/desktop/g5-sagas.electron.test.ts`、`g3.electron.test.ts`；`tests/integration/offer.test.ts`、`g5-product-policies.test.ts`。AI 或接受不自动建任职/投递/面试 |
| J-07 | 精确查询预览/独立确认 → controlled SearchRun 的本轮结果 → 同 owner Research 原子组；明确提升后同 ID 唯一 Company 正文、机会只读引用、Wiki 只读；本地真实文件/Feishu shaped candidate → body → preview → Raw → 另行 AI 授权 | `tests/desktop/g5.electron.test.ts`、`g3.electron.test.ts`；`tests/integration/g5-controlled-search.test.ts`、`g5-object-import.test.ts`、`g5-product-policies.test.ts`、`research.test.ts`。本地链通过；随后 J-07 真实三个分支 PASS，见 [真实证据](j07-real-external.md)。真实 Search 与 Provider 使用分别授权材料，不声称同份真实搜索结果已发送模型 |
| J-08 | 真实未保存 Communication → Feedback 独立弹层/可选图片 → 保存返回原焦点及草稿；查看/补充/导出/归档/purge；保存未知仍查询同一 receipt、仅一条创建 | `tests/desktop/g5.electron.test.ts`；`tests/g5-feedback-ui.test.ts`；`tests/integration/g5-feedback.test.ts`。未知回执是测试传输丢失夹具，并非正常包测试后门 |
| J-09 | 实际资料绝对位置、周期备份开关、完整手动恢复点、隔离候选校验/明确影响/Restore、唯一 active pointer、重启回读；完整/缺文件/多余文件/恢复缺失区别 | `tests/desktop/g4.electron.test.ts`、`g5.electron.test.ts`、`g5-windows.electron.test.ts`；`tests/integration/g4-data-backup.test.ts`、`g4-data-lifecycle.test.ts`。不完整副本真实文件集成检查；全切点故障收口 G6。普通 Restore 不等于正式迁移；MG-01/02/03/06/07 迁移部分 DEFER_M |

## 桌面连续性

`g5.electron.test.ts` 证实真实编辑器选区/光标保留、AI 单条立即生效及独立撤销、Proposal 不复活、命名 Esc 焦点返回、命名 PDF、历史取消后继续输入/导出、Feedback 返回、缩放与 600×650 窄窗口可达；普通导航/重启/明确对象直达和置顶清除分别断言。

`g5-windows.electron.test.ts` 经正常“文件 → 新建窗口”打开第二窗口，共用单 writer。真实 B 身份 dirty/A 保存时 B 保留草稿并显示正式比较；远端正文与本地 AI 各有归属，单次 undo 不撤销远端；真实冲突保留本地输入并显示正式值；长正文保存/刷新；关闭 dirty 窗口选择继续；Restore 后拒绝旧窗口重新绑定/写回，用户真正 reload 后才接受新工作区；精确 purge 通知清除第二窗口相关缓存。

`tests/g5-resume-ai-unknown-ui.test.ts` 在真实 Resume UI + SQLite Runtime 外部测试传输中证明：丢失决定结果时保留原命令、锁受影响块、无关输入继续；missing receipt 不生成第二意图，继续同一命令后立即应用并只撤销 AI 内容。

以上自动化键盘不是 macOS 中文 IME 证据。AC-UX-06-01、AC-UX-07-01、AC-UX-14-01 现由用户本轮正常包真人操作补齐并结算 PASS_G5，见 [真人最终证据](g5-manual-desktop-final.md)。旧 G0/G2 中文 PASS 没有替代本轮组合验收。

## 首次执行记录（修复前历史）

以下命令全部 exit code 0，2026-10-03 本机执行；完整日志路径、SHA 与测试摘要保存于 `g5-auto-results.json`：

| 验证 | 结果 |
| --- | --- |
| `npm ci` | 243 packages，0 vulnerabilities；根依赖/lock 本轮未变 |
| `npm run typecheck` / `npm run build` | PASS；TS 7.0.2，正式装配构建 |
| `npm test -- --maxWorkers=2` | 37 files / 79 tests PASS |
| `npm run test:integration -- --maxWorkers=2` | 59 files / 239 tests PASS，真实 SQLite/文件/worker；包含 G1–G4 回归 |
| G0 unit / build /真实 Electron smoke | 3 unit + 1 Electron PASS；仅临时测试 Secret，合成中文不是 IME 证明 |
| `npx vitest run tests/desktop --maxWorkers=1` | 8 files / 8 tests PASS，含 G1 材料、G2、G3、G4 与 4 条 G5 正常桌面旅程 |
| `CAREER_PACKAGED=1 npx vitest run tests/desktop --maxWorkers=1` | 同一 8 files / 8 tests PASS，正常 arm64 生产构建 |
| 追加同会话选中知识/筛选返回检查 | J02 dev 与 packaged 各 1/1 PASS |
| 追加普通停止/续做 UI | G5 dev 与 packaged 各 1/1 PASS；停止时 0 请求、重新预览是新操作、旧 manifest 不再可授权 |
| `npm run native:rebuild` / `npm run package` | PASS，正常 darwin arm64 包；包中 7 个 dist 文件与当前构建逐字节一致 |
| `codesign --verify --deep --strict` / `git diff --check` | PASS；仅本地 ad-hoc 封装，不升级 Developer ID READY |

首次验证产物（修复前，不是最终包）：`out/CareerNext-darwin-arm64/CareerNext.app`；ASAR SHA256 `92cf58a7965bef731a162afeac55f6b10006be8a7ec15afd3457fb202ac3c690`。测试外部驱动不进入包，正常手工启动不启 inspector，不增通用能力桥。当前源码未提交摘要见 JSON；日志原始文件在 `/tmp/career-g5-*.log`，结构化证据在仓库保存。这是修复前自动证据，最终真人与新包结果见下节。

## 首次 Review 与冻结输入（历史）

Standards + architecture：当前代码审核无 unresolved finding；另外用真实 ProseMirror/history 验证 rewrite/add/delete 独立 undo/redo、远端内容保留。Spec 审查要求补充两窗口身份、持久首页、列表过滤/选中位置及普通停止/续做，均补正常桌面 dev/packaged 证据；IME 留真人。104 集合/链接/统计审查通过。104 分支与最终 Gate 审计见 [matrix](g5-acceptance-matrix.md)。代码审核通过不代表真人或真实外部服务通过。

冻结产品 12/12、架构 8/8 逐文件 SHA 与 G4 基线一致；旧 Career 未读取，无用户真实资料/真实 Key 外发。首次建矩阵发生在业务实现前；初始分类和当前证据分清，最后三个真人分支须在人工报告后结算，不把“等待证据”伪装成新的产品缺口。

## 真人门过程（历史失败现场保留）

2026-10-03 用户报告 **G5 MANUAL FAIL：Resume AI Apply / Undo**：接受 resume-add 后撤销一起移除了手工加粗，并出现保存冲突。原失败现场已保留，修复与红绿回归见 [Resume Undo 复验记录](g5-resume-undo-regression.md)。此前自动子链通过不覆盖这次人工失败；修复后的正常包仍待用户重新人工验收。

正常 arm64 packaged App 已使用全新隔离测试资料启动；旧 G2 窗口保留。请在新窗口打开 `G5 Manual Test · Desktop Review` → 编辑本机会简历，在最后的 `Manual input area:` 段落输入。已准备 `G5 manual baseline` 版本和第一段英文的待审 AI 提案；没有程序填中文、不粘贴、不切换输入法、不操作候选窗。用户完成七项后再记录结果；在此之前 Issues OPEN、无最终 checkpoint/push。

1. macOS 简体拼音 `zhengniuwa`，本人选“蒸牛蛙”；连续中文、混合英文，候选未提交时等待 autosave，确认无提前提交、丢字/重复。
2. 在未选为 AI 目标的下方段落编辑中文、选区加粗；接受已准备的第一条 AI 改写 → 撤销一次 → 历史中选择测试版本后取消恢复 → 继续输入 → 导出。中文/无关修改保留，Proposal 仍已采用，导出属于当前机会。
3. 命名弹窗 ⌘S，Esc 取消；焦点/光标回到正文，直接继续输入。
4. Tab/Shift-Tab、方向键、删除、回车及 undo 正常；弹窗键盘焦点不跑到背后。
5. 视图菜单放大/缩小/还原；内容与动作可达。
6. 窗口拖窄到约 600px；能滚动到主要内容/动作，表单不丢输入。
7. Wiki/机会/项目/任职及机会内研究/沟通/面试/Offer、反馈/资料维护均可达；打开/关闭反馈保留底层草稿，返回当前 Resume 内容正确。

2026-10-03 用户继续确认 Undo 已只撤销 AI 增补、此前手工加粗仍保留；随后创建 `G5 manual baseline` 并查看历史时，加粗不显示，另报 **G5 MANUAL FAIL：ResumeVersion 格式**。分层核对确认冻结正文与原 PDF 均保留 bold，故障位于历史预览；修复与待真人复验见 [版本格式记录](g5-version-format-regression.md)。G5 仍 PARTIAL，Issue 不关闭。


## 最终验收与 checkpoint

2026-10-03 用户报告 **G5 MANUAL DESKTOP: PASS**。以上两次人工失败已分别修复并由用户重新操作复测通过，不再是待真人阻断。实际证据见 [真人最终验收](g5-manual-desktop-final.md) 与 [独立 Computer Use 原报告](g5-computer-use-manual.md)；历史 FAIL / HUMAN_ONLY 保留，未改写成最初就通过。

最终执行：npm ci（0 vulnerabilities）、typecheck、build PASS；unit **38 文件 / 82 测试**，integration **59 文件 / 239 测试**；G0 unit **3** 与真实 Electron smoke **1** 通过。全套普通桌面 **10 文件 / 11 测试**，开发态和最终 arm64 打包态各一套 PASS，含 G1–G4 回归、两个 Resume 缺陷与 Offer 编辑采用回归。最终重跑中的测试脚本问题（历史读取/多余 reopen 时序、未处理 dirty 关闭确认、Esc 后立即焦点检查）已保留失败日志并修正测试后重跑通过，产品关闭保护未变。

最终 normal app：`out/g5-final/CareerNext-darwin-arm64/CareerNext.app`；app.asar SHA256 `1926e4d87093f5699a31421430d12a9f27c32cab5108689cf89d927b70f88af5`。包内 **7** 个正式 dist 文件与最终构建逐字节一致；无 tests/probe/test-support/.env/Skills。`codesign --verify --deep --strict` PASS 只指本地 ad-hoc。两个 Resume 修复后真人使用的包另有 SHA，见真人证据；最终包只多 Offer 草稿采用局部修复，Resume 未再修改。

[最终 code-review](g5-final-review.md)：Standards / Spec / Architecture 对本轮增量无未解决阻断；Spec 发现的 Offer 编辑稿丢失 P2 已红灯复现、修复并自动回归。两个人工缺陷不与这个审核发现混算。补审还确认 1 个 G4 基线 P2 风险：Wiki 重新打开期间的输入可能被晚到回读覆盖，具体触发及 G6 归属见 review / AC-UX-04-01；非本轮增量阻断，不能宣称此行为 PASS。三项 UX 发现仅记录于 [polish backlog](../backlog/g5-ux-polish.md)，不阻断本轮桌面结算。

104 最终统计：**38 PASS_ALREADY / 31 PASS_G5 / 28 DEFER_G6 / 5 DEFER_M / 1 EXTERNAL_LIVE_PENDING / 1 CONDITIONAL**，总数104、唯一ID与 Frozen一致、证据链接有效、待真人0。Frozen Product Spec **12/12**、Architecture **8/8** 文件 SHA 不变。详细命令/日志 SHA 及首次历史证据见 [g5-auto-results.json](g5-auto-results.json)。

按用户本轮授权，已完成子 Issues #21–25 与 umbrella #20 收尾关闭，独立 final checkpoint 推送 main；提交标识、远端一致性见该 checkpoint 的 Git 记录及 Issue 关闭报告。关闭本轮开发范围不表示真实外部通过：**G5 overall PARTIAL（仅 J-07 真实外部待验）**，普通本地产品链和真人桌面 PASS。REAL PROVIDER / REAL SEARCH / REAL FEISHU **NOT TESTED**；Developer ID / Notarization / x64 **READY**。不进入 G6，不读取旧 Career。

## Post-blackbox 新 checkpoint

按用户最新要求，对 OLD MAIN `5f16661624eab1800efa3d09a2500d5a3a9e53bb` 已有两个修复进行来源复核与重新回归，不重复合并源码或整棵 worktree。最新真人 Feedback 再打开草稿保持与同名版本两次人为保存说明已记录；三种证据严格分开，详情见 [post-blackbox 验收](g5-post-blackbox.md)。#20 先重开记录 findings，新的 main checkpoint push / clean 核对后再关闭。G5 总状态仍 PARTIAL，仅真实 J-07 外部待验。


## J-07 最终外部结算

2026-10-04 用户确认真实 Tavily / DeepSeek / Feishu 三个隔离 TEST DATA 分支 PASS，授权收尾。G5 产品、真人桌面及 J-01～J-09 结算为 PASS；Search 与 Provider 的材料按用户授权分别隔离，不将受控接缝表述为同份真实 Search 资料曾发送模型。J-07 计数、安全边界与最终本地回归见 [最终外部证据](j07-real-external.md) / [收尾摘要](j07-final-closeout.json)。Acceptance 最终为 38 PASS_ALREADY + 32 PASS_G5 + 28 PASS_G6 + 5 DEFER_M + 1 CONDITIONAL = 104，EXTERNAL_LIVE_PENDING=0。G6 LOCAL PASS；发布环境三项仍 READY / NOT RUN，Migration M 未开始。

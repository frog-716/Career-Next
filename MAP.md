# Career-Next 项目地图

当前状态：[E1 替代宿主 PASS](docs/verification/E1-ELECTRON-REPLACEMENT.md)，真人睡眠唤醒与两次 Chrome 冷启动均通过，[E2 清理与回归 PASS](docs/verification/E2-ELECTRON-RETIREMENT.md)，默认 Node / Chrome，Electron 正式依赖/适配层已移除。[S1 新 Keychain 重新录入 PASS](docs/verification/s1-keychain-reentry.md)：DeepSeek 与 Tavily 各完成一次真实连接检查，Chrome 冷启动后配置仍可用；旧 Electron safeStorage 未读、未删；飞书阶段尚未开始。G0–G5 PASS；[J-07 真实外部验收](docs/verification/j07-real-external.md)（[#31](https://github.com/frog-716/Career-Next/issues/31)）已用隔离 TEST DATA 通过 Tavily / DeepSeek / Feishu 三分支。G6 本地故障/恢复 PASS。Developer ID / Notarization / x64 = READY / NOT RUN；Migration M 已完成 M0 盘点及 M0.5 人工分类，M1-B #33 fixture adapter 已通过，M-Lite 当前8个对象已迁入并启用；不继续重型 M2/M3。⑩前端功能与UX baseline PASS（A/B/C），见 [⑩-C最终验收](docs/verification/frontend-c.md)。UX BASELINE = IMPLEMENTED；⑪ A6 / 方案3已获用户批准并进入正式实现，当前 checkpoint 与真实能力边界见 [A6实施](docs/ux/A6-IMPLEMENTATION.md)。

## 目标与当前阶段

Career 是本地优先的长期职业工作台，覆盖求职、真实工作记录和职业积累。四个一级入口是 Wiki、机会、项目、任职。

本仓库是从零全量重写的唯一开发仓库。G0、G1、G2 第一批已 PASS，G2 Resume Editor 的真实 macOS 中文 IME 于 2026-10-03 由用户人工验收通过。G3 Research / Interview / Offer 人工子模块已 PASS，证据见 [G3 验收](docs/verification/g3-manual-submodules.md)；接口、并行边界和验收接缝见 [G3 集成约定](docs/agents/g3-integration.md)。G4 跨域接缝已 PASS，见 [G4 验收证据](docs/verification/g4-cross-domain.md) 和 [G4 集成约定](docs/agents/g4-integration.md)；G4 历史范围只用 deterministic fake；G5 产品、真人桌面与 J-01～J-09 已 PASS，见 [G5 最终证据](docs/verification/g5-complete-journeys.md)。G6 本地故障与恢复已 PASS，见 [G6 矩阵](docs/verification/g6-failure-matrix.md)。Developer ID signing、公证、x64 保持 READY，尚未实际验收。旧 Career 已按用户 M-Lite 明确授权只读提取当前8个对象，在隔离验证后启用新资料工作区；旧库与备份保留。

## 冻结输入与阅读入口

1. 先读本 MAP，再读 [Product Spec 入口](docs/product-spec/rebuild-spec/README.md) 和 [PRODUCT](docs/product-spec/rebuild-spec/PRODUCT.md)。产品正文位于 `docs/product-spec/rebuild-spec/`；`audit/` 仅保留决策追溯，校验清单位于 `docs/product-spec/SHA256SUMS.txt`。
2. 再读 [ARCHITECTURE](docs/architecture/ARCHITECTURE.md)、[MODULES](docs/architecture/MODULES.md)，按需查看 [DATA](docs/architecture/DATA.md)、[AI-RUNTIME](docs/architecture/AI-RUNTIME.md) 与 `ADR/`。
3. [DELIVERY](docs/architecture/DELIVERY.md) 是开发顺序和验收门的导航。当前 G1 范围、验收和命令证据见 [G1 Issue #2](https://github.com/frog-716/Career-Next/issues/2)；历史技术验证见 [G0 Issue #1](https://github.com/frog-716/Career-Next/issues/1)。

状态以用户于 2026-10-02 确认为准：Product Spec = Frozen R3，Architecture V2 = Frozen。两个 ZIP 的全部文件已原样保存，仅移除各自外层目录；正文中的 R2 标题、待审查状态和历史阶段指令保留原文，不覆盖当前状态或本轮授权范围。

## 顶层模块

| 位置 | 未来职责 |
| --- | --- |
| `apps/desktop/` | macOS launcher、Node 宿主、Chrome 接入、窄 Keychain helper、文件/PDF与打包 |
| `packages/contracts/` | 前后端查询与命令合同；领域合同由对应模块维护 |
| `packages/frontend/` | Shell、设计系统、业务视图和编辑会话 |
| `packages/backend/` | 业务 owner、跨域用例、AI Runtime、平台能力 |
| `tests/` | 后续合同、跨域集成、旅程与真实桌面验证 |

上述四个 package 均为私有 npm workspace。顶层名称对应冻结架构的 desktop / contracts / frontend / backend；G0 `probe/` 已退役，其历史源码仅保存在回滚 tag。

## G1 正式入口

- `frontend/features/materials/`：选择、预览、明确确认、取消、回执核对和正式回读；合同正本在 `contracts/materials/`。构建按模块生成 JSON Schema 和操作清单到 `dist/contracts/materials/`。
- `apps/desktop/node/`、`browser/`、`capabilities/`：正式 Node 装配与窄平台能力；不依赖窗口壳或 preload，不拥有业务正本。
- `backend/bootstrap/`：独立 Node backend 和唯一 SQLite 写 worker 的装配；`domains/materials/`：个人独立 Raw 的身份、SourceRef、证据原件生命周期与业务裁决。
- `backend/platform/database/`：真实写锁、最小迁移、receipt / hold / retention；`platform/files/`：有界文本 staging 与不可覆盖的 UUID blob，不裁决业务语义。
- 工作区身份持久化，backend 与浏览器会话每次启动/重连换代；旧 MessagePort 适配仅保存在回滚 tag；可信 human 由接入端建立。正式提交在同一短事务内完成 Materials、retention 与 receipt；文件发布在事务外，GC 由同一 writer 排序。
- 开发与验收命令见 README；`tests/integration/` 使用真实 SQLite 和文件，`tests/desktop/` 验证真实开发态和 arm64 包。测试资料与构建产物不进入 Git。

## G0 历史证据

G0 探针及执行入口已在 E2 退役。历史结果保留在 verification / Issue #1；旧源代码由本地 `e1-pass-before-e2` tag 保留，正式运行和测试不再依赖它。

## 依赖方向与 owner 原则

- 前端通过 Contract 查询和提交命令；不导入后端实现，不直接访问数据库、文件或 Provider。合同不依赖前后端实现。
- Desktop 负责桥接与进程监督，不持有业务真相；正式状态由后端对应 owner 裁决。
- 各领域及 Opportunity 子模块只经公开能力组合，不能直接写其他 owner 的数据。跨域事务不放宽私有实现访问边界。
- Profile 拥有当前本人身份；Research 拥有研究正文，Wiki 仅引用；Opportunity core 拥有阶段与结果；Resume 与实际发送历史各守自己的正本。详细归属以 MODULES 为准。
- AI Runtime 管任务、权限和提案，目标业务 owner 负责正式写入；关联与来源引用不自动授予读取、外发或修改权。
- 根依赖、lockfile、bootstrap 与未来迁移发布顺序由集成 owner 串行管理；公共合同和模块边界变化时同步本 MAP。

全局操作规则来自 `/Users/frog/.codex/AGENTS.md`，已确认可读取。

项目工程协作入口见 [AGENTS.md](AGENTS.md)；Matt setup 配置位于 `docs/agents/`：[GitHub Issues](docs/agents/issue-tracker.md) 与 [Single-context 文档约定](docs/agents/domain.md)。

## G2 正式入口与协作

- `contracts/<owner>/manifest.ts` 和 `frontend/features/<owner>/routes.ts` 是各模块合同与路由片段；`npm run generate` 机械产生合同总册、后端路由注册与前端路由总册，生成目录不提交。
- `backend/domains/{wiki,employment,project,opportunity,profile,resume}/public.ts` 是业务公开能力；`bootstrap/` 注入跨域公开关系并维护单一 SQLite writer 和迁移批次。
- `frontend/app/` 装配 `shell/` 的四入口和对应真实页面；保持编辑会话，任职成功写入后机械刷新项目的公开关系投影。
- Resume 使用 Career 自有文档合同；Tiptap 仅作输入适配。当前稿、Profile 当前身份、命名版本各守自己的语义。后端冻结快照，固定 headless Chromium 平台适配器生成 PDF，平台以 hold / retention 保住实际文件，再由 Resume 完成版本回执。
- [G2 Issue #3](https://github.com/frog-716/Career-Next/issues/3) 及六个业务 Issue 是任务和验收正本；运行和真人中文 IME 的 PASS 证据见 [G2 第一批验收](docs/verification/g2-first-batch.md)；接口与并行边界见 [G2 集成约定](docs/agents/g2-integration.md)，统一术语见 [GLOSSARY](GLOSSARY.md)。根依赖、迁移批次和运行装配由 integration owner 串行维护。

## G3 入口

- `contracts/opportunity/{research,interview,offer}/manifest.ts` 注册三个强子模块；`backend/domains/opportunity/<module>/public.ts` 各自管理状态与迁移。Bootstrap 只组合公开能力，不由兄弟 owner 读写私有表。
- `frontend/app/opportunity-submodules.tsx` 在机会内接入三个入口，保留编辑会话；Wiki 的 `features/wiki/research.tsx` 仅经公开查询显示同一研究正文及所属机会导航。
- 版本 3 迁移批次追加研究、面试、Offer 与 Offer 原件独立保留原因，已发布 G1/G2 SQL 不变；真实原件在 writer 中有界校验后才可绑定。
- [G3 umbrella #10](https://github.com/frog-716/Career-Next/issues/10) 与子 Issue #11 / #12 / #13 保存任务和验收状态；实际证据见 [G3 人工子模块验收](docs/verification/g3-manual-submodules.md)。

## G4 入口

- `contracts/opportunity/{submission,communication}/` 与对应 backend / frontend 子模块：首次投递唯一、后续发送独立，记录实际发送材料；Resume 只提供已冻结候选，文件选择由浏览器受控上传提供；旧 Desktop 适配仅能从本地回滚 tag 恢复。
- `backend/ai-runtime/` 管 Wiki 整理任务、逐次授权、实际来源、ExternalOperation、Proposal 与回执；`backend/platform/providers/` 提供本地 fake。人工采纳在唯一 writer 同事务经 Wiki public 生效。无真实外发，不恢复旧执行权。
- `backend/application/data-lifecycle/` 组合 owner 的公开维护能力；`platform/backup/` 管一致恢复点、受管理副本和唯一 active pointer，`platform/persistence/` 拒绝已清除对象的迟到生产者。
- `backend/bootstrap/{ai-composition,lifecycle-composition,candidate-validation}.ts` 是真实跨 owner 接缝与候选恢复校验入口；迁移发布版本为 4，已发布 G1–G3 SQL 不变。
- `frontend/support/{ai,data-lifecycle}/` 是 Wiki 辅助与设置入口，`frontend/app/g4-support.tsx` 装配。清除通知关闭受影响正文/缓存并拒绝旧响应，保留无关草稿；恢复先卸载旧编辑会话再建立新资料身份。
- [G4 umbrella #14](https://github.com/frog-716/Career-Next/issues/14) 和 #15–19 管任务；正常开发与 arm64 打包证据见 [G4 验收](docs/verification/g4-cross-domain.md)。G5 本轮真人 Desktop Gate 已通过；G4 开发 Issues 的历史关闭不代表当时已测真实服务；最新真实验收见 J-07。

## G5 入口（产品、真人桌面与真实外部 PASS）

- [G5 umbrella #20](https://github.com/frog-716/Career-Next/issues/20)，子任务 #21–25；[104 分支矩阵](docs/verification/g5-acceptance-matrix.md) 是本轮独立证据入口，不改变冻结正本。
- `backend/application/{preferences,feedback}/` 分别拥有唯一首页偏好与反馈，合同在 `contracts/application/`。Feedback 截图复用平台 blob 保留；不进入职业知识或 AI Context。
- `frontend/support/feedback/` 使用独立弹层保留底下编辑会话；`shell/preferences.ts` 仅在无具体目标时读取首页偏好。
- `backend/ai-runtime/{product,search}/` 复用同一 Runtime/权限/预算/回执，接入业务 owner 的 `ai-policy.ts`；`bootstrap/product-composition.ts` 只组合公开能力。Resume 单条、Research 同 owner 原子组、Greeting/面试/Offer 可编辑草稿由用户处理后立即写对应 owner；不自动推进现实状态。
- `frontend/support/ai/{product-launcher,product-task}.tsx` 是明确目标、Context/外发分离、最终预览与人工处理入口；Resume editor 只把本条实际修改加入独立撤销历史，无关本地/远端输入保留。
- `materials/targets.ts` 与 `platform/imports/` 接明确对象的本地文件/受控 Feishu-shaped 导入；G5 本地 SearchRun 使用受控 fixture；J-07 另有固定 Tavily 一次真实查询形成 candidate。普通恢复隔离旧窗口写回，精确 purge 通知各窗口受影响编辑缓存。
- 迁移版本 5 追加本轮 owner 片段，既有 G1–G4 发布 SQL 保持不变。普通旅程回归使用受控资料与 fake adapter；真实三个分支后来由 J-07 单独授权并验收。M 历史盘点与轻量当前资料迁入见下方入口；G6 见下方入口。
- [G5 连续旅程与真人门](docs/verification/g5-complete-journeys.md) 是历史旅程证据入口；当前执行矩阵见 [E2](docs/verification/E2-ELECTRON-RETIREMENT.md)；[真人最终证据](docs/verification/g5-manual-desktop-final.md) 已 PASS；两次缺陷原现场及复测保留，104 最终分类见矩阵。G5 总状态 PASS，J-07 真实三个分支已验收；开发 Issues 按对应授权收尾。后续体验改进仅记录在 [UX backlog](docs/backlog/g5-ux-polish.md)，后续 G6 见下方当前入口。

- [G5 post-blackbox 收口](docs/verification/g5-post-blackbox.md)：历史 G5 checkpoint 当时为 PARTIAL；最新 J-07 外部收尾后 G5 PASS。

## G6 入口（本地门 PASS）

- 本地 G6 故障/恢复门已 PASS：63 个矩阵场景，117 unit / 382 integration / 23 正常包案例，以及用户真实系统睡眠 + Computer Use 唤醒验收；见 [最终证据](docs/verification/g6-final.md)。发布条件仍 READY / NOT RUN，不代表完整发布验收。
- [G6 umbrella #26](https://github.com/frog-716/Career-Next/issues/26) 与 F1–F4 #27–30；[故障矩阵](docs/verification/g6-failure-matrix.md) 映射原 28 个 DEFER_G6（现 PASS_G6）和全部 RV 项，记录真实执行与缺口。
- [G6 并行边界](docs/agents/g6-integration.md)：四个隔离 worktree，root 串行负责根依赖、迁移排序、打包及最终集成。
- J-07 真实 Provider/Search/Feishu 三分支已 PASS；Developer ID/Notarization/x64 仍 READY / NOT RUN。G6 历史范围不含旧 Career；后续 M0 只读授权见下方。

- G6 新增 `platform/search/` 为有界、可重建的人类本地搜索投影；`bootstrap/local-search-composition.ts` 仅组合公开 owner，v6 追加内容无关 dirty 通知。备份排除投影正文，清除后重建。
- Node 专用 write-only Secret 协调位于 `capabilities/secret-vault.ts`，系统加密存储与业务备份分离；J-07 已验证正式凭据联动；超过60秒交互等待保持响应，读取仅在受信链内，Renderer不可回读已存Key。
- Node 打开业务 writer 前复用只读 active identity 核对（历史 Main 使用 `workspace-check`）；无效指针关闭业务/外发，用户明确选择完整备份后才经隔离候选验证激活。

## J-07 接缝与最终证据

- 正式固定 Tavily / DeepSeek adapter：`backend/platform/providers/{tavily,deepseek}.ts`；Node 私有凭据协调与可取消授权等待在 `apps/desktop/capabilities/`。最终外发预览与人工 Proposal Apply 不合并。
- 飞书真实验收使用 user 只读 CLI 读取指定文档，再经已确认缓存走正式 Materials；`materials/origin.ts` / schema7 保留真实文档身份与外部 revision，未增加 App 内置 live Feishu adapter。
- [最终外部收尾](docs/verification/j07-final-closeout.json) 记录164 unit / 401 integration / 12 packaged通过、三个真实分支的唯一请求计数、安全审计及证据限制。回归不复用已消费真实发送授权。

## Migration M0：只读盘点已完成

- [Resume 对齐能力](docs/verification/resume-alignment.md)（[#32](https://github.com/frog-716/Career-Next/issues/32)）：PASS；Career 文稿/编辑/版本/PDF与 AI Undo 保留对齐，真人 IME及packaged桌面验收通过。仅隔离 TEST DATA，不执行 Migration M。
- [M0 盘点](docs/migration/M0-INVENTORY.md) / [结构化清单](docs/migration/M0-INVENTORY.json)：保留分类前历史证据；两套旧运行实例单独记录。
- [M0.5 最终分类基线](docs/migration/M0.5-SUMMARY.md)：Primary REAL=14、TEST=65、UNKNOWN=5，共84条；backup-only TEST=30。19组均已分类；仅14条 REAL 可作为后续候选，TEST 禁止迁移，UNKNOWN 默认不迁移且不自动升级。
- M0.5 已固化，M1-B #33 完成 fixture adapter；后续用户明确改用 M-Lite，只迁8个当前对象，其余历史/TEST/UNKNOWN不迁。本地人工审阅文件保持 Git ignored。

## Legacy Proposal 只读历史能力

- [#34](https://github.com/frog-716/Career-Next/issues/34) / [验证](docs/verification/legacy-proposal-history.md)：`contracts/ai/legacy-history/`、`backend/ai-runtime/legacy-history/`、`frontend/support/ai/legacy-history.tsx`。独立强类型历史、list/read、受控 staging 私有写入、备份/恢复及 purge；设置内查看，不加入当前 AI 任务或恢复旧执行权。
- schema 8 追加独立历史表，旧发布批次不变。全部以 synthetic TEST DATA 验证；M1-B fixture 后续入口见下方，未进入 M2。

## Migration M1-B：仅 fixture adapter

- [#33](https://github.com/frog-716/Career-Next/issues/33) / [验证与限制](docs/verification/m1b-fixture-migration.md)：`backend/application/migration/` 显式只读 synthetic source、分类/哈希固定计划、受管理隔离 staging 与幂等回执；各 owner 的 `staging.ts` 经 backend public 能力保存快照，不走普通事件创建，不接公开 RPC。
- schema 9 只追加最小迁移来源回执，保留1–8与完整恢复校验。#34 原私有 archive writer 不重做。此历史 M1-B 仅演练，未读真实14条正文、未启用；后续 M-Lite 的独立用户授权与当前启用见下方。

## Migration M-Lite：当前资料迁移

- [#35](https://github.com/frog-716/Career-Next/issues/35)：用户明确授权取代重型 M2/M3，仅 Primary 当前 Profile1 / Company2 / Opportunity3 / Resume2；TEST/UNKNOWN、Secondary、backup-only、所有 Proposal/历史与旧凭据均排除。
- `backend/application/migration/lite-source.ts` 按批准身份哈希只读 current；`lite-activation.ts` 在写锁内核对候选指纹、无 WAL、回执和范围。`scripts/m-lite.ts` 是显式离线操作入口，经 owner staging 写入；从不由应用启动自动执行。
- 激活前建立完整 rollback，原工作区保留；当前迁移验收与启用状态见 [脱敏摘要](docs/migration/M-LITE-SUMMARY.md)。

## ⑩ 前端 UX baseline：⑩-A / ⑩-B / ⑩-C 已实施

- [UX审计与IA方案](docs/ux/UX-BASELINE.md) / [普通用户指南](docs/ux/USER-GUIDE.md)：当前正式打包版只读审计；首页欢迎区、机会六分区、4步教程、页面提示与帮助、用户文案及技术详情折叠。
- baseline已 IMPLEMENTED。⑩-A历史版本接入窄栏名称与引导；A6已删除 Home/欢迎导航，启动入口只是现有四模块之一，Resume归属机会与正式owner保持。⑩-B已接入机会列表与详情六分区，不进入⑪ Gemini。旧体验问题已纳入 [UX backlog](docs/backlog/g5-ux-polish.md)。

- ⑩-A [#36](https://github.com/frog-716/Career-Next/issues/36)：`frontend/support/experience/` 提供本机界面偏好、欢迎区、4步教程与Markdown帮助；`shell/`仅装配视图，`app/g4-support.tsx`组合独立设置/帮助面板与原反馈能力。导航置顶/排序仍由原preferences owner持久化；教程与业务资料/授权分离。

- ⑩-A验收见 [Shell/Home/教程/帮助](docs/verification/frontend-a.md)：unit 173、integration 447、packaged 5 PASS；隔离TEST DATA Computer Use完成，真实迁入资料未改。⑩-B已完成；⑩-C收尾见下。

- ⑩-B [#37](https://github.com/frog-716/Career-Next/issues/37)：`features/opportunity/`提供列表、创建、概览及六分区头部；`shell/routes.ts`解析对象/分区链接，`app/`仅经公开Contract装配各owner。Resume维持原独立route和编辑会话。访问过的子模块草稿保留，清除通知卸载匹配缓存，迟到读取不能覆盖新对象/分区。验证见 [机会列表与六分区](docs/verification/frontend-b.md)。

- ⑩-C [#38](https://github.com/frog-716/Career-Next/issues/38)：Wiki/项目/任职阅读与编辑分层；`app/related-projects.tsx`经公开Project Contract装配任职/人物项目关系；`support/profile/`为设置内基础资料编辑；`support/ai/business-entry.tsx`按真实连接能力提供业务任务入口。Research的两种owner会话分别保留，Apply后只读刷新，不覆盖未保存草稿。设置五分组、普通语言与技术详情分层，开发诊断仅显式隔离模式显示。验收见 [⑩-C 全 baseline](docs/verification/frontend-c.md)。不进入⑪。

## ⑪ A6 / 方案 3 实施入口

- [A6实施](docs/ux/A6-IMPLEMENTATION.md) / [验收](docs/verification/frontend-a6.md) / [#39](https://github.com/frog-716/Career-Next/issues/39)：`design-system/brand/` 透明 SVG 与有限动效，`shell/` 四名称导航，`support/experience/avatar-menu.tsx` 辅助菜单，`features/opportunity/` 四列管线、详情六分区与新建小面板；Resume套用原件纸面/工具栏，三个其他模块使用原件资料行。人工审批尚未通过，当前补齐版本等待复审。`docs/ux/CHANGELOG.md` 是产品内更新日志源。
- 不再使用独立 Home 或品牌跳转首页；已有默认启动模块仍由 preferences owner 管理。未连接飞书不显示姓名，不将 Profile 或 CLI token 当连接身份。现有合同无提醒字段，显示“未设”，不新增业务能力。

## Node / Chrome 正式运行入口（E2）

- 用户批准 Electron Retirement，见 [E1 Amendment](docs/adr/005-ELECTRON-RETIREMENT-E1.md)；它覆盖 V2 的宿主选择，冻结正文与历史验证不修改。业务 owner、Contract、SQLite schema、React/A6 不变。
- `Career.app` / `npm start` → macOS launcher → 独立 Node backend → 127.0.0.1 → Chrome。`apps/desktop/node/` 负责装配/启动；`native/launcher.swift` 仅持有启动锁并启动固定 runtime。重复启动核对宿主身份，复用后台；`npm run stop` 等待后台及唯一 writer 退出。
- `apps/desktop/browser/server.ts` 保留 Host/Origin/CSRF/每标签会话与工作区绑定。`frontend/app/browser-bridge.ts` 请求能力只在内存；文件字节通过固定受控上传入口，PDF 下载只能读取正式 ResumeVersion，不能传系统路径/通用 blob ID。
- `capabilities/native-keychain.ts` / `native/keychain.swift` 提供固定 Career slot 的私有加解密。DeepSeek 与 Tavily 真实 Key 已由用户通过正式 UI 重新录入新 Keychain，浏览器只显示配置/可用状态；旧 Electron safeStorage 未读、未删。恢复关闭外部服务绑定，不恢复旧授权。
- `capabilities/headless-pdf.ts` 使用固定 Chromium 153.0.8010.12、固定参数与字体指纹；原冻结 PDF 不重新生成。无效 active pointer 进入独立只读恢复页面，用户明确选备份、验证、确认后才切换。
- `npm run package` 生成 `out/Career-arm64/Career.app`。当前工程不含 Electron/Forge 或旧宿主适配层。E1 回滚点为本地 `e1-pass-before-e2` tag；不删除旧用户凭据，不自动恢复或解密它们。发布签名/公证/x64 仍未验收。执行与测试命令见 README。

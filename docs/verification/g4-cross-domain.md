# G4 跨域事务与真实接缝验收

状态：**PASS，2026-10-03**。任务正本：[umbrella #14](https://github.com/frog-716/Career-Next/issues/14)，S #15、X #16、A #17、D #18、I #19。基线 `e42c922a2b10fdbda8ed73870c95e176ca7e9957`；最终代码和独立审查固定于 `50c384865a1ef4bf941e0f6202cee86e5c41033a`。后续 checkpoint 只保存验收与导航，不进入 G5/G6。

本文件记录实际工程证据，规则以冻结正本为准。所有数据库、材料、PDF 和 Provider 结果均为独立临时测试夹具；没有读取旧 Career，没有调用真实 AI / Search / Feishu。

## 完成的真实接缝

- Submission / Communication 各守自己的合同、表、public 和页面。首次投递至多一次，经 core 公开能力推进 submitted；再次发送是独立沟通。Resume / Greeting 分别表达未使用、内容未知、内容已知但文件缺失、实际材料保留，文件失败不降级为缺失成功。真实候选使用原有文件与独立保留原因，不重生历史 PDF；更正、历史时间、重复 command 与原回执保持可核对。
- Profile 当前身份影响所有当前 Resume 的受管理区，不改正文区块、历史版本、导出 PDF 或 Submission。实际旅程为身份/正文 A → 真 PDF 导出 A → 当前身份/正文 B → 选择 A 首次投递，字节及快照仍是 A。独立编辑会话、IME composition 和未保存正文不因身份同步被重置。
- Project 更换 Employment 保留过去协作语境；新任职同名 Person 不自动迁移；Person 后来角色变化不覆盖过去 Project 职责。组合只调用公开能力。
- Research 是公司/机会研究正文唯一 owner；Wiki 只读引用同一条目。Transcript / Communication 当前文字可更正，旧版不可冒充当前正文；Review / Research / Wiki 支持进入待复核，结论保持原内容。Raw 原件不能普通覆盖。
- Wiki 整理是本轮唯一 TaskPolicy。明确 Materials 与目标 → 本地冻结 Context / 实际外发预览 → 本次 human 授权 → 本地 fake → pending Proposal → accept / edit-accept / reject / ignore。正式 Wiki、Proposal 处理状态和 receipt 在唯一 writer 同一短事务完成，失败无半提交。六种范围绑定真实对象；机会私有知识不混入默认列表，可明确选择所属机会查看。
- Runtime provenance 来自真正使用的全部输入及继承链，模型 citation 不能缩小它。实际 A → Wiki X → 第二任务输入 B 与 X 的 Context → 模型仅引用 B → 采纳 Y → 清除 A，Y 正文保持并待复核。纯手工 Wiki X 无 Raw 时，删除 X 同样使继承它的 Y 待复核；普通 X 编辑不制造全局失效。
- Apply 绑定真实来源/目标局部依赖：R1 → R2 的最终事务拒绝；无关 Y 修改不使 A Proposal 失效。超时为 outcome_unknown，明确重试 B 使用新 operation identity，迟到 A 仍属 A 且不自动采纳。停止/撤销在 utility 控制循环关闭交付，SQLite 留在单一 writer。重启恢复持久任务、提案和回执，不自动请求 Provider、不恢复消费过的执行许可；同一 backend 的单纯 MessagePort 重连保留有效运行任务。

## 备份、恢复、清除

- Managed copies 登记 current / old workspace、backup、failed backup、restore candidate、quarantine、staging、blobs、cache、proposals、summaries；manifest 不保存正文或 Key。备份使用真实 SQLite Backup API、blob 对齐、hash/schema/owner 关系校验；成功完整点发布后才清旧点。周期备份默认关闭，可设置周期与保留数量，仅应用运行时检查。
- 恢复先验证隔离候选，拒绝穿越/symlink、坏 JSON/关系/文件；关闭旧 writer 与生产者后，原子切换唯一 active pointer 并分配新 workspaceInstance。旧库作为 managed copy 保留；Secret/旧 execution capability 不从业务备份复活，pending Proposal 仅供当前 human 重新最终校验。保留备份可能重引入已选范围清除内容时先显示警告。
- 永久清除先披露对象、独立历史、受管理副本和外部不能撤回的范围，再确认。marker / 对象 generation → revoke / drain → owner 正文、历史、receipt、实际衍生内容与所选文件/副本 → WAL checkpoint / VACUUM。留下独立事实或未选副本时仅声明 selected_scope，不声称全清。
- 原影响计划形成后新增或改变独立 Wiki / Research 来源引用，旧计划拒绝；无关知识保存、保持原来源关系的独立正文编辑不产生全库 epoch。
- 清除失败保持 purge_incomplete，正文读写、导入和新备份暂停，页面立即关闭受影响缓存；用户只能查看维护状态或重试已确认原范围。原计划完成后恢复正常读写，不允许改范围偷过失败状态。
- 真实 AI / parser / import / PDF 已读材料后清除：旧结果、patch、摘要和文件写回被 fence 拒绝。已打开、打开中、关闭中 sink 都等待实际排空/关闭；最终发布和业务事务复核同一旧 token。Profile 清除后只有新的明确 human Profile 保存才开放新 generation，新 PDF 成功而旧 PDF 永久拒绝。
- UI 清除受影响 Raw、研究只读引用、知识来源、任务/提案、业务历史和编辑缓存；阻断旧异步响应回填，保留无关草稿。恢复先卸载旧编辑树再接新资料身份，避免旧草稿混入恢复库。

## 最终执行证据

机器为 macOS arm64，Node 24.21.0、Electron 44.5.1、better-sqlite3 13.0.3、SQLite 3.53.4。以下命令均 exit 0，构建和临时测试资料未提交。

| 检查 | 结果 |
| --- | --- |
| npm ci / install:electron / native:rebuild | PASS；npm audit 0 vulnerabilities |
| npm run typecheck | PASS |
| npm test -- --maxWorkers=1 | PASS，35 文件 / 77 项，含真实 Chromium 表单及缓存拒绝测试 |
| npm run test:integration -- --maxWorkers=1 | PASS，47 文件 / 226 项，真实 SQLite / 文件 / writer / 合同 / 恢复候选 |
| npm run build | PASS |
| 开发态 tests/desktop，单 worker | PASS，G1–G4 四文件 / 四旅程 |
| CAREER_PACKAGED=1 tests/desktop，单 worker | PASS，G1–G4 四文件 / 四旅程 |
| npm run build:g0 / test:g0 / smoke:g0 | PASS，3 unit 与实际进程 / SQLite / PDF / Safe Storage / 安全桥 |
| npm run package | PASS，正常 darwin-arm64 App |
| codesign --verify --deep --strict | PASS，本地 ad-hoc 封签，未冒充 Developer ID |
| Standards / Spec / architecture boundaries | PASS / PASS / PASS，各未解决发现 0，固定代码 50c3848 |
| git diff --check | PASS |
| Frozen 全文件 SHA / 原 ZIP 内容 | PASS，产品 12/12、架构 8/8 完全不变 |

正常应用：`out/CareerNext-darwin-arm64/CareerNext.app`。最终 `Contents/Resources/app.asar` SHA256：`71430bb732c2dd862298e11a307b0e64ed51aac4de469bd78255310f286adbf7`。正式包不包含 G0 probe，也没有测试专用通用入口。

打包 G4 旅程通过真实页面和窄 Contract：导入真实 fixture → Profile A / Resume A / 真 PDF → 当前 B → 首次发送 A → 外部实际文件再次发送且首次记录不变 → 明确私有机会 Wiki 范围 → fake 请求预览/授权 → ignore/编辑后采纳 → 备份 → 隔离恢复 → 新唯一 pointer → 打开原件 → 清除原件及副本 → 原文窗口关闭且无关 dirty Wiki 正文保留 → 重启验证 pointer 与结果。G1–G3 各自正常包旅程同步回归，无 renderer pageerror。

独立审查补测证明了真实缺陷后修复：旧计划漏掉新增引用、默认 Wiki 私有内容泄露、AI 继承来源漏待复核、清除失败仍可读写正文、研究引用缓存及迟到响应。去除对应修复时反例实际 RED；修复后 GREEN。清除计划关系回归 5 项，AI 实际链 2 项，失败维护入口 1 项，研究只读 UI 6 场景均已纳入上述总数。

代表性入口：`tests/integration/g4-runtime.test.ts`（真实 worker / utility / 文件 / 备份恢复）、`g4-ai-real-seams.test.ts`（原子 Apply / provenance / unknown / 迟到结果 / 重启）、`g4-purge-plan-review.test.ts`、`g4-purge-incomplete-admission.test.ts`、`g4-wiki-provenance-review.test.ts`、`g4-data-*.test.ts`（真实副本和 sink）、`tests/g4-research-purge-ui.test.ts`、`tests/desktop/g4.electron.test.ts`。其余 S/X owner 与真实升级回归见 integration 目录。

## 保护边界和下一门

版本 4 `004-g4-seams` 追加 owner fragments，已发布 G1–G3 SQL 保持不变。Frozen SHA 清单（完整仓库相对路径排序再取 SHA256）仍为：

- Product Spec：`9dbefa32389beb64165e3295eee14fa55f0b904462a486933c49658089193da5`
- Architecture：`3d87555dbca17b92de34329ac4c35953d005e92eb0b0fda1394577b397dc23f8`

真实 Provider / Search / Feishu：**NOT TESTED**。Developer ID signing / Notarization / x64：**READY**。G2 真人中文 IME 沿用用户 2026-10-03 的 PASS，自动化不冒充新的真人验收。未提交 Secret、数据库、材料、PDF 或真实用户数据，未读取旧 Career。

下一门 **G5，未授权**；本轮停止，不做 G5/G6 或旧系统迁移。

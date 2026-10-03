# G5 final code review

日期：2026-10-03。基线 `66ede4cd2f51787b5375caa8489512972edb28d0`（G4 final）；覆盖 G5 已提交增量、当前工作区及新增源码/测试。Standards 与 Spec 由两个独立 reviewer 只读审查，Architecture 由集成 owner 按 Frozen 正本核对。未读取旧 Career。

## Standards

### 独立 reviewer 原始结论

- 基线：`66ede4cd2f51787b5375caa8489512972edb28d0`（G4 final）；提交增量 `git diff 66ede4cd2f51787b5375caa8489512972edb28d0...HEAD`，另审查相同基线至当前工作区及 untracked 清单中的 G5 源码与测试。
- 标准：项目及全局 AGENTS、MAP、docs/agents/domain.md、issue-tracker.md，冻结 MODULES 与 ARCHITECTURE 的公开接口、owner、安全桥、编辑会话规则；代码 smell 仅作为判断性启发式，不把工具检查重复列为发现。

### Findings

硬违反：**0**。有可复现风险的判断性 smell：**0**。本轮没有需阻断 G5 的 Standards 发现。

实读核对：Resume 在采纳开始同步保护，明确 closeHistory 前后边界，采纳回执在任务视图丢弃过期响应之前完成编辑器更新与 revision 接续；unknown 回执保留原命令与保护路径。独立 Undo 只保存 Resume 当前稿，未修改 accepted Proposal。真实 UI 回归覆盖工具栏及键盘撤销竞态、无关输入、原命令继续与正式 owner 回读。

冻结历史使用独立只读 CareerDocument renderer，保留段落、列表与 bold/italic/strike/link marks；不改 live editor。命名版本回归检查持久 JSON、历史样式、真实 PDF 字体、恢复及重启后的冻结文件，而非仅检查页面字符串。

新增业务写入仍由对应 owner 的公开能力处理，Runtime 管任务/提案与回执，同事务完成采纳；bootstrap 组合公开能力。材料持久化与清除沿用平台 fence/hold/retention，反馈附件不进入职业 Context。新窗口保持 sandbox/contextIsolation、窄 IPC、可信 frame 与 workspace 校验，恢复隔离旧窗口。

审查未读取旧 Career，未修改仓库文件。最终命令执行及 Frozen SHA 校验由 integration owner 汇总；本报告不将 fake 协议证据扩大为真实 Provider/Search/Feishu 或签名/公证/x64 验收。

### Offer 编辑采用补审

已只读实核后续局部修复：ProductProposal 使用 Schema 中可选 `adoptedContent`，Offer policy 经 Content.parse 校验实际采用内容，并返回 AI owner；Runtime 将该内容与 accepted 状态、回执在同一 executeCommand 事务持久化，原始 change 保留。没有修改正式 Offer 条件、接受状态或 Employment。前端采用后按已持久化内容渲染标题和正文，仍使用转义文本节点。

新增回归经公开接口核对编辑稿、原 change、正式 Offer 不变、备份/恢复后保留内容；真实 desktop saga 经编辑控件修改再采用并断言展示。桌面测试的 CAREER_PACKAGED_EXECUTABLE 参数仅选择验收程序路径，不引入业务能力或生产测试后门。

补审硬违反 **0**、实质 smell **0**；没有新增 Standards 阻断。最终回归是否执行通过仍由 integration owner 报告。

补审：Wiki 历史先经公开回读确认更正文已保存，再核对共两条历史及 created 原文 / corrected 更正文，消除保存时序歧义；同会话已验证当前选中知识后直接继续编辑，去掉测试多余的异步 reopen；G3 重启前测试驱动明确丢弃残余测试表单，持久回读与正式关闭保护不改。显式监听关闭 dialog，将决定交给 Electron，避免 CDP 自动 dismiss 竞争；沿用 G2 同一测试做法。Esc 后焦点检查保持同一要求，改有界轮询等待 Modal 的异步 focus restore。独立 reviewer 均确认无新增阻断。

## Spec

### 独立 reviewer 原始结论

基线：66ede4cd2f51787b5375caa8489512972edb28d0；覆盖提交0f8cd65、当前 tracked diff及列明untracked产品/回归文件。未读取旧Career、未改仓库。

(a) 缺失/部分：真实Search仍EXTERNAL_LIVE_PENDING。Frozen JOURNEYS.md:63要求“查看真实 Search 结果”，而search/public.ts:6–12明确受控fixture无HTTP。这是授权范围外待验，不是本轮需补的实现bug。原G5请求§十三明确“如果这使对应 Journey 无法真正完成，G5 必须如实 PARTIAL”。建议 overall G5 PARTIAL（仅外部待验），本轮普通产品链和MANUAL DESKTOP PASS；J-07 PRODUCT FLOW PASS / EXTERNAL_LIVE_PENDING。最新用户已授权关闭本轮Issues、checkpoint，关闭不能表示真实外部已验证。

(b) 越界：未发现明确产品扩展、旧Career引用或真实外发。controlled Search/Feishu在代码和文档都显式标记fixture。

(c) 原finding（已修复）：[P2] Offer编辑后的草稿采用成功但内容消失。product-task.tsx:34为offer-assist提供“编辑草稿后采用”；offer/ai-policy.ts:11的apply忽略edited；product/public.ts:67只记accepted并保留原Proposal；前端随后清空edited、accepted页面重现旧正文。对照Frozen AI.md:29–31“分析或草稿”“采用…当前可编辑内容”。复审：Offer policy现在解析edited/原文，返回adoptedContent；Runtime在原决定事务存入Proposal，原change保留；UI回读展示采用稿。仍owner=ai，不写正式Offer条件。公开API回归已真实红灯，新增接受后/备份恢复后回读和正常desktop编辑采用断言；最终绿色执行由根agent记录。该P2实现finding已解决，未发现新增边界问题。

104审计：104个唯一ID与Frozen ACCEPTANCE集合一致、证据链接存在；初审为38 PASS_ALREADY、28 PASS_G5、28 DEFER_G6、5 DEFER_M、1 EXTERNAL_LIVE_PENDING、1 CONDITIONAL、3待真人；真人PASS后三项归PASS_G5应为31，不扩大外部证据。最终文档/统计仍由根agent更新。

Resume两处修复：独立history group/先reconcile后丢弃过期task响应；history只读renderer保留marks/list，版本测试覆盖JSON、实际PDF字体、恢复/重启。暂无新的明确缺陷。

复审结论：代码Spec轴无未解决具体finding；1项原P2已解决。外部待验为已知授权/证据边界，overall PARTIAL表述保留。

最终 104 审计为 38 PASS_ALREADY、31 PASS_G5、28 DEFER_G6、5 DEFER_M、1 EXTERNAL_LIVE_PENDING、1 CONDITIONAL，合计104；三项真人证据已补齐。整体 G5 PARTIAL 仅真实外部 J-07 待验，本轮普通链与 MANUAL DESKTOP PASS。

## Architecture

核对 Frozen DELIVERY G5、MODULES、AI-RUNTIME、ADR/002 及实际公开接口和 owner：前端仅通过 contracts/公开桥请求，平台文件/恢复能力无领域规则，bootstrap 负责组合。AI Runtime 管任务、提案与同一命令回执，业务变化仍由单一 owner 处理；Offer 编辑采用稿是 AI 草稿，不偷偷修改正式 Offer/接受依据或自动创建 Employment。

Resume 采纳在独立 history group 内完成，并接续正式 revision；Undo 是当前稿编辑，不恢复 accepted Proposal。ResumeVersion 冻结完整 CareerDocument；历史 renderer 只读渲染既有 marks/list，PDF 与冻结文件独立保留，无编辑器重构。备份恢复沿用唯一 active pointer 与验证隔离，旧执行权不因内容恢复重新授权。

正常 arm64 包不带测试桥/生产后门；临时驱动仅在包外。多窗口维持 sandbox、contextIsolation、窄 IPC 和 workspace/frame 验证。没有引入通用 Repository/Event Bus/Plugin Framework、sidecar 或额外数据库；Frozen 文档未变。Architecture 无未解决阻断。

## 回归与证据边界

Offer 编辑采用补充回归先红后绿：原实现 accepted 后 `adoptedContent` 缺失；现公开接口与备份/恢复回读保留编辑稿及原 change，普通桌面也编辑后采用并检查显示。日志 `/tmp/career-g5-final/offer-edited-red.log`；最终绿色见 [执行结果](g5-auto-results.json)。此为 code-review 发现，不计入用户两个人工缺陷。

Resume 两个真人失败及红绿记录见 [Undo](g5-resume-undo-regression.md)、[版本格式](g5-version-format-regression.md)；用户最终复验见 [真人证据](g5-manual-desktop-final.md)。最终命令、包摘要与日志 SHA 见 [执行结果](g5-auto-results.json)，旅程见 [verification](g5-complete-journeys.md)。

代码 review 通过不替代真实服务：REAL PROVIDER / SEARCH / FEISHU 均 NOT TESTED，Developer ID / Notarization / x64 均 READY。不进入 G6。

## 已观察到的基线风险（留 G6，非本轮增量阻断）

独立 Standards reviewer 补充确认 **P2：Wiki 异步重新打开可能覆盖请求期间的新输入**。触发：当前知识已读 → 再点同一或另一知识发起 `read` → 回复到达前编辑正文 → 晚到 `open()` 回读直接 `adopt()`，可能覆盖这段新输入。Frozen MODULES §7.2 要求晚到 query 不覆盖 dirty 值；G4 基线已存在同一实现，本轮 Wiki 产品增量只有 Feedback 定位属性，没有引入或修复该问题。

本轮同会话返回并继续编辑已验证；不声明所有晚到回读保留输入已通过。该具体风险记录到 AC-UX-04-01 的 DEFER_G6，不升级该 AC 状态，不开始 G6。review 对本轮增量无未解决阻断；基线已知待处理风险 **1**。它是工程风险，不与用户三项 UX polish 发现混为一类。

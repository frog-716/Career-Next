# G6 F2：AI 故障、来源与 Resume 连续性

本线实际本地回归 PASS：**16 文件 / 88 测试，exit 0**。基线 `befe2437a9b260237ae5f08a2d11517437a27032`；Issue #28 由集成 owner 结算，本文不宣布全 G6 PASS。全部夹具为临时 SQLite、真实 owner/Runtime、deterministic fake Provider，无真实外发、Secret 或用户资料。

## 真实执行与修复

- unknown A 只能明确准备一份待授权 B；不再允许 B 未发送时暗中生成 C。A/B 回包归各自 operation，共享已用预算；最后一个 unknown 请求阻止 retry/resume。
- 控制器在 handoff 与回写前复查当前 Provider binding/generation；disable 或变更后拒绝旧代次迟到正文。`setProviderBinding` 只提供给可信 Main 配置入口。
- 派生 Context 的实际输入 A 即使不在显式 materials/citation 中，仍需当前 Read/Egress。修复 Wiki 再 prepare 漏查当前 Read，以及 Product dispatch 漏查继承 A 的当前 Egress。真实 Interview session/FinalReview 由其 owner access + dependencies 检查，不冒充 Transcript。
- 真正 SQLite page quota 耗尽时返回 `storage_full`，不伪装 `invalid_output` 或成功。事务无 Proposal/正式领域半提交。
- 控制回包 `execution_blocked` 只说明派发门关闭；`persistencePending:true` 仍须核对原 commandId 收据。两入口不随该回包再等待 list SQL；receipt_missing/读取失败不会丢失原 stop 身份。
- Resume 新测试定位后，现有 protected-block、细粒度 Apply、Undo 边界和比较路径通过，无需改 Resume owner/editor 实现。保留 G5 AI Undo 与命名版本格式两条回归。

## F2 矩阵证据

详细实际测试名、文件、结果、命令、原 red log SHA 在 [机器记录](g6-f2-ai.json)。下面每项 PASS 仅对应已经执行的当前公开路径。

| ID | 实际结果 | 状态 |
| --- | --- | --- |
| F2-01 | unknown A / explicitly authorized B / independent late A; unknown spent budget remains | PASS（本线已执行路径） |
| F2-02 | stop/revoke late response; stop may retain legally scoped pending output, never auto-Apply | PASS（本线已执行路径） |
| F2-03 | actual input pause/purge, read-revoke and egress-revoke; cached body/current dispatch check | PASS（本线已执行路径） |
| F2-04 | controller disable before/after handoff, unknown consumes last budget, resume/retry cannot reset | PASS（本线已执行路径） |
| F2-05 | credential generation changes at actual controller/fake adapter, real SQLite reopen changes backend generation | PASS（本线已执行路径） |
| F2-06 | runtime trusted capability rejects 7 reality-write owners × AI/human-spoof plus self-accept; runtime denies unregistered model subtasks | PASS（本线已执行路径） |
| F2-07 | 9 output drivers: Wiki, Resume, Greeting, Preparation, FinalReview, Research, Offer, Promotion, Simulation; actual owner R1→R2 rejects final Apply atomically | PASS（本线已执行路径） |
| F2-08 | unrelated Wiki item / Resume block preserve applicability | PASS（本线已执行路径） |
| F2-09 | selected Research group one conflict rolls all back with exact proposal ID; independent company group succeeds | PASS（本线已执行路径） |
| F2-10 | actual context A+B, model citation B only; trusted A stays in adopted output and current permissions | PASS（本线已执行路径） |
| F2-11 | actual adopted summary-of-summary and cached task/receipt current-read restriction; unregistered subtask cannot expand authority/budget | PASS（本线已执行路径） |
| F2-12 | actual material Raw overwrite rejected and bytes unchanged; Transcript R1→R2 allowed | PASS（本线已执行路径） |
| F2-13 | actual real FinalReview no Search -> pending Research; Simulation FinalReview cannot enter real Research | PASS（本线已执行路径） |
| F2-14 | real SQLite page quota reaches SQLITE_FULL during Proposal settle; no partial Proposal/owner success | PASS（本线已执行路径） |
| F2-15 | held actual Apply, protected same block, unrelated live input, actual second-owner intent; stale full-document save rejected | PASS（本线已执行路径） |
| F2-16 | adjacent human-before/AI/human-after three Undo groups; history cancel keeps session; G5 prior bold and accepted Proposal regression | PASS（本线已执行路径） |
| F2-17 | stale Resume/Profile revisions reject export; late PDF binds old frozen content and Profile; complete snapshot retains marks | PASS（本线已执行路径） |

## Red → Green

| 缺陷 | 首次真实 red | 原证据 | exit |
| --- | --- | --- | --- |
| pending-retry | second B produced a third operation instead of operation_pending | `/tmp/g6-f2-red.log` | 1 → 0 |
| late-generation | old generation body persisted after fake adapter generation changed | `/tmp/g6-f2-generation-red.log` | 1 → 0 |
| storage-classification | actual SQLITE_FULL reported invalid_output instead of storage_full | `/tmp/g6-f2-quota-red.log` | 1 → 0 |
| inherited-egress | derived A current egress revocation did not block dispatch | `/tmp/g6-f2-egress-red.log` | 1 → 0 |
| inherited-read | summary-of-summary current read revocation still permitted prepare | `/tmp/g6-f2-ai-provenance.log` | 1 → 0 |
| stop-control | 4/4 failed: missing control variant, lost stop ID, both UIs lacked gate/persistence split | `/tmp/g6-f2-control-red.log` | 1 → 0 |

同时最终广回归发现当前 Egress resolver 曾误判无 Transcript 的真实面试准备；窄修正后重建实际 writer，原 G5 policies 回归恢复 PASS。编辑器两窗口测试最初定位器点错空段落，修正夹具定位到真实选中段落，没有为夹具错误修改生产编辑器。

## 最终命令

```sh
npx vitest run tests/g4-ai-controller.test.ts tests/g6-ai-control-ui.test.ts tests/g6-resume-continuity-ui.test.ts tests/g5-resume-ai-undo-ui.test.ts tests/g5-resume-ai-unknown-ui.test.ts tests/resume-session.test.ts tests/integration/g6-ai-failures.test.ts tests/integration/g6-ai-transport.test.ts tests/integration/g4-ai-runtime.test.ts tests/integration/g4-ai-real-seams.test.ts tests/integration/g5-product-controls.test.ts tests/integration/g5-product-policies.test.ts tests/integration/g5-product-resume.test.ts tests/integration/g5-product-edges.test.ts tests/integration/resume.test.ts tests/integration/resume-artifacts.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/g6-f2-final-results.json
npm run typecheck
git diff --check
```

分别 exit 0 / 0 / 0；Vitest JSON `/tmp/g6-f2-final-results.json`、执行日志 `/tmp/g6-f2-regression-final.log`，本文 JSON 内保存 88 项实际结果。额外单跑 F2 runtime 30/30 也 exit 0（`/tmp/g6-f2-ai-additional.log`）。依赖仅本 worktree `npm ci --ignore-scripts` + `npm rebuild node better-sqlite3`，未改根 package/lock，未重建 main native。

## 证据边界与交接

- Provider **真实生产配置生命周期**接线、长 SQL/busy 下 **production runtime 快速 control 回包 + 原 stop 收据**由 root 串行负责；本线测到真实控制器关闭/迟到拒绝和真实浏览器消费受控 transport 回包，不能替代 root 实测。
- 当前没有 public subtask scheduler。已运行“模型 ai.subtask/伪人工/新根任务/授权/自接受全部拒绝”，以及实际 summary-of-summary/cache 权限传播和共享根预算；不声称未来并行子任务 scheduler 已实现或已验收。
- 第二窗口为真实 owner 并发意图，第一窗口为真实 Chrome + ResumePage + utility writer；未在此运行两个 macOS Electron 原生窗口。当前覆盖同块/异块、全稿旧 revision 拒绝、持锁时输入、远端差异保留和人工比较。
- late PDF 测试使用受控 synthetic PDF bytes 验证持久绑定，HTML 打印快照、普通 bold/italic/list 命名版本预览走真实既有回归；最终 packaged Chromium PDF/render smoke 由 root 执行。
- 当前来源权限撤销通过公开 Source authority policy port 收紧，实际正文/版本仍来自 owner SQLite；purge 使用实际 owner purge/fence。没有修改生产表模拟版本或伪造 source snapshot。
- 正常 arm64 package / packaged smoke：本线 NOT RUN，由 root 最终集成执行。REAL PROVIDER / SEARCH / FEISHU：NOT TESTED；Developer ID / Notarization / x64：READY / NOT RUN；Migration M 未进入。
- Frozen Product Spec **12/12 SHA 不变**；Frozen Architecture **8/8 SHA 不变**（相对基线逐文件 SHA256 已存 JSON）。旧 Career NOT READ。


## 补审：revoke 持久化失败仍必须拒绝迟到正文

Root 独立审查发现普通 stop 与 revoke 在控制器上仅共享 closed/AbortSignal；若 revoke 写 worker 失败，旧 owner grant 未持久撤销，忽略 abort 的 Provider 返回仍能走 settle。补测真实红灯：**34 PASS / 2 FAIL，exit 1**，两个 revoke 场景均实际保存了迟到 pending 正文。证据 `/tmp/g6-f2-revoke-persistence-red.log`，SHA 已写 JSON。

最小修复只在 controller 维护同步 revoked task 集合：在调用 writer 前设定；接到结果后在任何 settle 之前拒绝；后续同 task 授权不能重新打开永久 revoke。普通 stop 继续允许原合法保留范围的 pending 迟到结果，不能一刀切丢弃。

- SQLITE_BUSY：第二个真实 SQLite 连接 BEGIN IMMEDIATE 锁定实际 fixture DB；公开 stop owner 事务失败，task 仍 running、原命令 receipt_missing。解除锁后返回 Provider 结果，revoke 不保存正文，普通 stop 保留 pending。
- SQLITE_FULL：注入公开 writer stop Promise adapter 的存储失败、尚未调用 owner；不是填满系统盘。实际 SQLite Proposal page-quota 耗尽测试仍单独保留，不以两种故障互相冒充。
- Source/Egress 活闸：同步 revokeReferences 后，实际 owner metadata 仍 read/egress=true（模拟权限变更尚未持久）；另一次 authorization 也不能让旧实际输入的迟到正文保存。两个控制事件都走该同一可信 reference gate。
- 四个失败持久化场景 + 两个 reference 场景全部通过，且根预算已用次数不释放、无正式 owner 自动修改。

```sh
npx vitest run tests/integration/g6-ai-failures.test.ts tests/g4-ai-controller.test.ts tests/g6-ai-control-ui.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/g6-f2-revoke-persistence-green.json
npx tsc --noEmit
git diff --check
```

分别 exit 0 / 0 / 0；**3 文件 45/45 PASS**（F2 runtime 36 + controller 5 + control UI 4）。日志 `/tmp/g6-f2-revoke-persistence-green.log`，机器补测记录已追加同一 JSON。本补丁没有更改 bootstrap 接线、owner、schema 或 Frozen；Root 继续最终 production runtime/package 集成回归。原 88/88 是先前广回归记录，不冒充本追加补丁的 packaged 回归。

## Root 最终集成结算

本工作线记录保留当时的边界；后续正式接线、最终正常包和真人系统 sleep/wake 的补验已完成，当前结算以 [G6 最终证据](g6-final.md) 和 [逐场景矩阵](g6-failure-matrix.md) 为准。LOCAL G6 PASS；发布条件仍 READY / NOT RUN、真实服务 NOT TESTED。

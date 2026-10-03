# G6 故障、恢复与发布门

状态：LOCAL G6 PASS；63 个本地场景全部实际执行并通过。本矩阵在实施前建立，以下逐项结算；发布环境项单独 READY / NOT RUN。基线 `befe2437a9b260237ae5f08a2d11517437a27032`。冻结正本只读，旧 Career 禁止读取；真实 Provider/Search/Feishu NOT TESTED。G5 总状态仍 PARTIAL，仅真实 J-07 待验。

测试接缝：用户已明确授权的公开 Contract/owner capability、SQLite/file adapter、Runtime dispatcher/control、managed-copy/backup/active-pointer、真实 packaged desktop。故障只作用于隔离夹具与受控失败接缝，不填满系统盘，不添加生产测试后门。

## 28 个 G5 DEFER_G6 分支

| Acceptance | 本轮记录 | G5 待验边界 |
| --- | --- | --- |
| AC-PR-01-01 | F4-01～15 / F1-11～14 | 完整外部恶意请求安全门 G6；已有正常包隔离子证据 |
| AC-DM-23-02 | F1-01～17 | 历史缺失/保存失败普通子证据已测；全部发布切点 G6 |
| AC-DM-38-01 | F3-01～14 | 普通影响确认/purge 子链已测；全部副本/法证与故障 G6 |
| AC-AI-01-01 | F2-01～17 | 已有可信 Actor 普通反例；完整 AI 冒充人工安全门 G6 |
| AC-AI-07-01 | F2-01～17 | 精确预览、Read/Egress 分离、撤销/共享预算普通子证据；完整权限/竞态安全门 G6 |
| AC-AI-07-02 | F2-01～17 | 精确预览、Read/Egress 分离、撤销/共享预算普通子证据；完整权限/竞态安全门 G6 |
| AC-AI-07-03 | F2-01～17 | 精确预览、Read/Egress 分离、撤销/共享预算普通子证据；完整权限/竞态安全门 G6 |
| AC-AI-08-02 | F2-01～17 | 既有资料标识普通子证据；最终门 G6，不要求真实 Search，纠正初始 external 分类 |
| AC-AI-10-01 | F2-01～17 | 同 owner 组选中全成/全不与具体冲突 ID、逐条/整草稿立即生效子链已测；全部事务故障 G6 |
| AC-AI-10-02 | F2-01～17 | 同 owner 组选中全成/全不与具体冲突 ID、逐条/整草稿立即生效子链已测；全部事务故障 G6 |
| AC-AI-11-01 | F2-01～17 | 无关修改不误 stale、相关依赖检查普通子证据；完整细粒度依赖门 G6 |
| AC-AI-12-01 | F2-01～17 | unknown 原命令恢复、锁块/无关输入普通证据；复杂 A/B/late G6 |
| AC-AI-13-01 | F3-01～14 | 恢复不复活 grant/旧窗口隔离子证据；恢复切点与权限完整门 G6 |
| AC-AI-14-01 | F4-05～06 | Safe Storage 使用临时测试 Secret；完整 Key 生命周期/安全失败/回退门 G6 |
| AC-AI-14-02 | F4-05～06 | Safe Storage 使用临时测试 Secret；完整 Key 生命周期/安全失败/回退门 G6 |
| AC-AI-15-01 | F2-01～17 | 默认排除管理身份、Greeting 姓名逐字段确认、Offer 真实内容普通子证据；完整泄漏安全门 G6 |
| AC-AI-15-02 | F2-01～17 | 默认排除管理身份、Greeting 姓名逐字段确认、Offer 真实内容普通子证据；完整泄漏安全门 G6 |
| AC-AI-16-01 | F2-01～17 | 真实来源性质继承普通子证据；对抗指令/扩权完整安全门 G6 |
| AC-AI-17-01 | F2-01～17 | 根预算共享/stop/resume 子证据；完整停用/预算竞态门 G6 |
| AC-AI-18-01 | F2-01～17 | 无效输出、清除闸门子证据；缓存/恢复完整安全门 G6 |
| AC-UX-04-01 | F4-01～15 / F1-11～14 | 普通未知回执/冲突保留和正式比较已测；已观察到基线 Wiki reopen 请求期间输入可被晚到回读覆盖，详情见 [review](g5-final-review.md)，留 G6；不声明全部晚到回读通过 |
| AC-UX-10-01 | F2-01～17 | 普通进度/停止/明确续做/新预览授权 dev 与 packaged 已测；复杂 unknown/new/late 同屏最终门 G6，当前不声称复杂 UI 全过 |
| AC-UX-12-01 | F3-01～14 | 完整/缺失普通备份、隔离验证、真正激活/唯一 pointer/重启已测；恢复故障最终门 G6 |
| AC-UX-13-01 | F4-01～15 / F1-11～14 | 正常进程/信任隔离子证据；恶意网页/端口/退出失败完整门 G6 |
| AC-UX-15-01 | F4-01～15 / F1-11～14 | 同会话 Wiki 范围筛选及当前选中知识返回保留、刷新/重启持久内容；崩溃边缘 G6，不承诺跨重启选区/undo |
| AC-MG-04-01 | F3-01～14 | 缺失/多余文件、副本影响、旧执行权不复活普通子证据；备份/清除故障与 Secret 完整门 G6 |
| AC-MG-04-02 | F3-01～14 | 缺失/多余文件、副本影响、旧执行权不复活普通子证据；备份/清除故障与 Secret 完整门 G6 |
| AC-MG-05-01 | F3-01～14 | 缺失/多余文件、副本影响、旧执行权不复活普通子证据；备份/清除故障与 Secret 完整门 G6 |

## 故障执行记录

每条记录实际结果、原命令、exit code 与证据；未运行不得改为 PASS。多切点测试的证据须分别定位。

| ID | RV | 场景 | 注入点 | 预期 | 实际 | command | exit code | evidence | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F1-01 | RV-P0-02 | staging 前失败 | staging 前失败 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | staging 打开前 SIGKILL；正常重启无 Raw、blob、staging、自动重放 | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-02 | RV-P0-02 | staging 后失败 | staging 后失败 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | staging 写入/sync 后 SIGKILL；另测部分写入 ENOSPC 与已预览字节 hash 损坏；无正式 Raw/假成功，候选可回收 | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-03 | RV-P0-02 | publish hold 后失败 | publish hold 后失败 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | hold 已持久化后 SIGKILL；原 pending intent 终止为 failed；活 producer 的已发布 hold 在并发 GC 中保持 | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-04 | RV-P0-02 | blob rename 前崩溃 | blob rename 前崩溃 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | 已同步候选、原子发布前 SIGKILL；正常重启释放已终止 producer 的 hold，候选清理 | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-05 | RV-P0-02 | blob rename 后崩溃 | blob rename 后崩溃 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | 实际 blob 发布/目录 sync 后 SIGKILL；未提交业务，正常重启将 orphan 回收 | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-06 | RV-P0-02 | DB COMMIT 前崩溃 | DB COMMIT 前崩溃 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | 正式 callback 返回前、COMMIT 前 SIGKILL；owner/retention/receipt 事务整体回滚，无 Raw | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-07 | RV-P0-02 | DB COMMIT 后 response 前断开 | DB COMMIT 后 response 前断开 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | COMMIT 完成后、后端响应前 SIGKILL；原 receipt committed，唯一 Raw 与真实原文字节仍可读；同命令不重复创建 | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-08 | RV-P0-02 | retention handoff 前崩溃 | retention handoff 前崩溃 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | 正式 retention INSERT 前在事务内 SIGKILL；业务不半提交 | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-09 | RV-P0-02 | retention handoff 后崩溃 | retention handoff 后崩溃 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | hold 交接/committed receipt UPDATE 后，但 COMMIT 前 SIGKILL；整个业务事务仍回滚 | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-10 | RV-P0-02 | GC claim 并发与新 incarnation | GC claim 并发与新 incarnation | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | 同一 live publish 中并发 GC 不认领；delete_claimed 旧 ID 拒绝 hold/retain；同内容新 UUID 发布后旧 claim 删除不影响新 incarnation，随后正式 retention 阻止 GC | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-11 | RV-P0-02 | receipt 读取丢失 | receipt 读取丢失 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | 查询 receipt 已返回 worker、尚未交付调用者时 SIGKILL；正常重启仍查同一个 committed receipt | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-12 | RV-P0-02 | response 丢失 | response 丢失 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | 实际 COMMIT 后丢弃响应并制造断连；fail 不覆盖 committed，原 receipt 收敛；重启同 intent 返回原结果，不创建第二条 Raw | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-13 | RV-P0-02 | backend SIGKILL 后重启 | backend SIGKILL 后重启 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | 前述 10 个后端进程切点均实际 SIGKILL；正常 writer 重启，workspaceInstance 保持、backend/connectionGeneration 更新，旧 capability 拒绝，不自动重放 | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-14 | RV-P0-02 | app 异常退出后重启 | app 异常退出后重启 | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | 实际 Main SIGKILL/restart，唯一正式 Wiki 字节保留；无自动 command 重放 | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F1-15 | RV-P0-02 | SQLite ENOSPC | SQLite ENOSPC | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | 真 SQLite page quota 返回 `SQLITE_FULL`；独立 command owner 与真实 Materials confirm 事务均无半写，失败原 receipt 可查，DB integrity `ok` | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-16 | RV-P0-02 | blob publish ENOSPC | blob publish ENOSPC | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | 真候选文件写入经 quota sink 返回 `ENOSPC`；原 receipt `failed/storage_failed`，没有正式 Raw 和 blob | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F1-17 | RV-P0-02 | PDF generation ENOSPC | PDF generation ENOSPC | 无半业务/假成功；持久回执与真实文件一致；原命令核对，不重放 | PDF 候选写了一块后 quota `ENOSPC`；partial staging 清理，冻结 job 原 receipt 明确失败，没有正式命名版本、成功 receipt 或保留 blob | `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | [F1 逐切点 JSON](g6-f1-storage-results.json) | PASS |
| F2-01 | AI-RUNTIME 安全门 | A unknown → B 新 operation → A 迟到 | A unknown → B 新 operation → A 迟到 | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | unknown A / explicitly authorized B / independent late A; unknown spent budget remains | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-02 | AI-RUNTIME 安全门 | stop 后迟到 | stop 后迟到 | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | stop/revoke late response; stop may retain legally scoped pending output, never auto-Apply | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-03 | AI-RUNTIME 安全门 | source revoke / egress revoke 后迟到 | source revoke / egress revoke 后迟到 | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | actual input pause/purge, read-revoke and egress-revoke; cached body/current dispatch check | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-04 | AI-RUNTIME 安全门 | provider disable / budget exhausted | provider disable / budget exhausted | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | controller disable before/after handoff, unknown consumes last budget, resume/retry cannot reset | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-05 | AI-RUNTIME 安全门 | credential generation change / backend restart | credential generation change / backend restart | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | credential generation changes at actual controller/fake adapter, real SQLite reopen changes backend generation | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-06 | AI-RUNTIME 安全门 | AI actor 调 manual / UI / generic save / self accept | AI actor 调 manual / UI / generic save / self accept | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | runtime trusted capability rejects 7 reality-write owners × AI/human-spoof plus self-accept; runtime denies unregistered model subtasks | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-07 | RV-P0-01 | R1 准备 → R2 来源更正 → Apply | R1 准备 → R2 来源更正 → Apply | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | 9 output drivers: Wiki, Resume, Greeting, Preparation, FinalReview, Research, Offer, Promotion, Simulation; actual owner R1→R2 rejects final Apply atomically | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-08 | RV-P0-01 | 无关 Wiki item / Resume block 变化 | 无关 Wiki item / Resume block 变化 | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | unrelated Wiki item / Resume block preserve applicability | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-09 | RV-P0-01 | Research 组选中一条冲突 | Research 组选中一条冲突 | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | selected Research group one conflict rolls all back with exact proposal ID; independent company group succeeds | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-10 | RV-P1-04 | 敏感 A + 公开 B，仅 citation B | 敏感 A + 公开 B，仅 citation B | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | actual context A+B, model citation B only; trusted A stays in adopted output and current permissions | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-11 | RV-P1-04 | summary of summary / subtask / cache | summary of summary / subtask / cache | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | actual adopted summary-of-summary and cached task/receipt current-read restriction; unregistered subtask cannot expand authority/budget | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-12 | RV-P1-07 | Raw 不可覆盖 / Transcript 更正 | Raw 不可覆盖 / Transcript 更正 | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | actual material Raw overwrite rejected and bytes unchanged; Transcript R1→R2 allowed | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-13 | RV-P1-07 | 真实 Review 无 Search / Simulation 虚构 | 真实 Review 无 Search / Simulation 虚构 | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | actual real FinalReview no Search -> pending Research; Simulation FinalReview cannot enter real Research | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-14 | AI-RUNTIME 安全门 | AI/Proposal persistence ENOSPC | AI/Proposal persistence ENOSPC | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | real SQLite page quota reaches SQLITE_FULL during Proposal settle; no partial Proposal/owner success | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-15 | RV-P1-03 | Resume Apply 同块 / 无关块 / 双窗口 | Resume Apply 同块 / 无关块 / 双窗口 | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | 同块/无关块 held Apply、stale full save，及两个正常 arm64 编辑窗口真实并发冲突/Apply/Undo全部通过 | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) / [真实双窗](g6-two-windows-results.json) | PASS |
| F2-16 | RV-P1-03 | AI 独立 Undo / 前后用户 Undo / history cancel | AI 独立 Undo / 前后用户 Undo / history cancel | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | adjacent human-before/AI/human-after three Undo groups; history cancel keeps session; G5 prior bold and accepted Proposal regression | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F2-17 | RV-P1-03 | Profile 同步 / export revision / 晚到 PDF | Profile 同步 / export revision / 晚到 PDF | 当前权限与可信 provenance 约束；owner/Proposal/receipt 原子提交；相关冲突拒绝，无关不误 stale；Undo 与双 revision 快照独立 | stale Resume/Profile revisions reject export; late PDF binds old frozen content and Profile; complete snapshot retains marks | `npm test -- --maxWorkers=1` + `npm run test:integration -- --maxWorkers=1` | 0 | [F2 实际测试 JSON](g6-f2-ai.json) | PASS |
| F3-01 | RV-P0-03 / RV-P1-06 | 全部 managed copies 影响清单 | 全部 managed copies 影响清单 | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | 两种全副本/保留 backup 场景，通过真实目录/DB 字节检查；PASS | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F3-02 | RV-P0-03 / RV-P1-06 | 清除后 AI/parser/import/PDF 多 producer 返回 | 清除后 AI/parser/import/PDF 多 producer 返回 | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | 四 token 与实际 bounded sink 拒绝晚写，closed parser 也清掉，无关 B 保留；G4 real runtime 的 import/PDF 与 AI purge 回归通过；PASS 接缝，root drain 接线待集成复验 | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F3-03 | RV-P0-03 / RV-P1-06 | 保留一个 backup | 保留一个 backup | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | remainingCopyIds 为真实保留点；该备份敏感字节实际仍在，其余批准目录消失；PASS | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F3-04 | RV-P1-06 | backup snapshot / enumerate / copy / hash | backup snapshot / enumerate / copy / hash | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | 四阶段受控失败、实际 blob tamper/hash mismatch；每阶段真实子进程 SIGKILL，最后完整点 verify 仍过，失败点单列；PASS | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F3-05 | RV-P1-06 | filtered publish DB / manifest / atomic publish | filtered publish DB / manifest / atomic publish | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | 三阶段真实子进程 SIGKILL；受控 ENOSPC/发布中断；compact DB 字节不含排除 marker，文件集合仅 DB/blobs/manifest；PASS | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F3-06 | RV-P1-06 | backup missing / extra / hash mismatch / crash / cancel | backup missing / extra / hash mismatch / crash / cancel | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | 8 阶段故障和 7 backup SIGKILL，缺失/篡改源 blob、abort 都无新 ready；实际 backup extra 文件不发布，untrusted extra 文件也拒绝；PASS | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F3-07 | RV-P1-06 | backup ENOSPC / concurrent purge / GC | backup ENOSPC / concurrent purge / GC | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | blob-copy/filtered-publish/manifest ENOSPC；实际 runtime backup 与 GC 同时发起，维护写队列串行；purge 计划含刚完成两个备份，再确认全清；PASS | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F3-08 | RV-P1-02 | restore candidate missing / extra / corrupt DB | restore candidate missing / extra / corrupt DB | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | 三种实际文件攻击拒绝，原事实仍读，无 ready candidate；PASS | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F3-09 | RV-P1-02 | restore symlink / path traversal | restore symlink / path traversal | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | symlink 与 ../ artifact ID 拒绝，原 DB 不变；PASS | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F3-10 | RV-P1-02 | pointer replace 前断电 | pointer replace 前断电 | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | 实际子进程 SIGKILL，旧 UUID/事实保留；PASS | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F3-11 | RV-P1-02 | pointer replace 后断电 | pointer replace 后断电 | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | 精确 rename 后、manifest copy kind 更新前 SIGKILL；新 UUID/事实与 activation 记录保留，启动收敛一个 current；PASS | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F3-12 | RV-P1-02 | pointer 损坏 / target 缺失 | pointer 损坏 / target 缺失 | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | 实际 missing/corrupt/symlink pointer/target 7 项 + 正常包只读 failclosed/明确恢复通过 | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F3-13 | RV-P1-02 | restore 身份 / old capability / pending Proposal | restore 身份 / old capability / pending Proposal | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | 实际 worker restore，三个 ID 都变，旧 session 拒绝，operation authorized=false，pending proposal 可读且当前 human 接受成功；device fake vault 不进包、不进候选；PASS | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F3-14 | RV-P1-02 | restore candidate ENOSPC | restore candidate ENOSPC | 旧生产者关闭并排空；按批准范围清除/诚实报告保留；不发布 incomplete；最后完整点安全；恢复仅唯一已验证 active，新身份无旧授权 | 真实文件 handle.writeFile 受控 ENOSPC；candidate quarantine/failed、原 DB/完整备份可读；PASS | `npm run test:integration -- --maxWorkers=1` | 0 | [F3 实际测试 JSON](g6-f3-recovery-results.json) | PASS |
| F4-01 | RV-P1-01 | Wiki P2 reopen 晚到读覆盖输入 | Wiki P2 reopen 晚到读覆盖输入 | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 真实 Chrome held reopen，输入/add/remove 均保留；生产 red→green | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F4-02 | RV-P1-01 | DB busy / 长 SQL / FTS maintenance / backup 同时 | DB busy / 长 SQL / FTS maintenance / backup 同时 | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 真实 SQLite 读锁/写锁、长原生 SQL、FTS/backup 并发；stop 即时闸门与持久回执分离；实际时间仅为受控样本 | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F4-03 | RV-P1-01 | 中文 1字 / 2字 / 无匹配 / 大正文搜索 | 中文 1字 / 2字 / 无匹配 / 大正文搜索 | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 1/2 字、无匹配、大正文；行/字节/比较预算与 partial 明示，原生 SQL SIGKILL 独立退出 | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F4-04 | RV-P1-01 | 100 Opportunity / 100 Project | 100 Opportunity / 100 Project | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 100/100 正式 owner 数据、3 Employment；真实浏览器过滤、wheel、返回、跨导航草稿保持 | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F4-05 | RV-P1-05 | Secret 新建/保存/失败/替换/取消/删除/停用 | Secret 新建/保存/失败/替换/取消/删除/停用 | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 真实 macOS Safe Storage 加解密，完整生命周期；pending marker启动关闭；两窗口save→disable→restart关闭通过 | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F4-06 | RV-P1-05 | Secret DTO/querycache/recorder/log/backup/args/error | Secret DTO/querycache/recorder/log/backup/args/error | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | write-only/ref/querycache清空，真实业务备份排除vault；DTO/logs/args无虚构值，静态recorder/error路径无Key | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F4-07 | RV-DELIVERY | packaged arm64 sleep/wake / close/reopen | packaged arm64 sleep/wake / close/reopen | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 用户真实系统睡眠140秒，direct正常App同PID95333；ComputerUse同窗口正文/已保存保留，实际知识历史Version1读回；普通close/reopen另由最终包通过 | 直接normal executable；pmset -g log / ps；ComputerUse原生查看+只读历史点击 | pmset/ps 0，App正常关闭0；原生操作完成 | [真人系统sleep + ComputerUse](g6-real-sleep-wake-results.json) | PASS |
| F4-08 | RV-P1-02 / RV-DELIVERY | packaged backend crash / reconnect / duplicate launch | packaged backend crash / reconnect / duplicate launch | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 正常最终包 actual backend/Main SIGKILL、reconnect换代、duplicate launch退出0，已保存资料保留 | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F4-09 | RV-P1-01 / RV-DELIVERY | packaged stop failure / PDF 与 backup 进行时 close | packaged stop failure / PDF 与 backup 进行时 close | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 实际Chromium PDF交付前关闭，无命名版本；真实backup candidate关闭/最后点保持；真实DB锁+backup控制即时回应，原receipt明确重试 | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F4-10 | RV-P1-02 / RV-DELIVERY | packaged restore candidate / app restart | packaged restore candidate / app restart | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 候选验证后正常重启不自动切换；明确激活三身份换代；损坏pointer native选择fixture后真verify/restore/restart | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F4-11 | RV-DELIVERY | 恶意网页/导航/打印/IPC/端口/inspector | 恶意网页/导航/打印/IPC/端口/inspector | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 最终正常包24次foreign Main拒绝、外导航/弹窗阻断、真实print sandbox无能力；raw正常进程无调试开关/TCP监听，无关端口不复用/不误停 | 见 [正常包安全实际命令](g6-security.md) | 0（首跑harness导航事件观察缺口1，纠正后0） | [正常包安全JSON](g6-security-results.json) | PASS |
| F4-12 | RV-MODULE | 模块 import / 表写边界 | 模块 import / 表写边界 | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 公开import/表写边界测试通过；Architecture review无未解决P0/P1 | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F4-13 | RV-DELIVERY | 两 feature Schema/manifest 构建聚合 | 两 feature Schema/manifest 构建聚合 | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 最终typecheck/build按两模块Schema/manifest片段机械生成通过 | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F4-14 | RV-DELIVERY | arm64 正常产物 / 签名 / 公证 / x64 | arm64 正常产物 / 签名 / 公证 / x64 | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 正常arm64包9个artifact均与本次build逐字节一致，无tests/docs/probe/.env/test-support；ad-hoc codesign deep/strict通过，DeveloperID/公证/x64仍READY NOTRUN | 见 [最终命令与逐测试结果](g6-final-results.json) | 0 | [最终证据](g6-final-results.json) | PASS |
| F4-15 | RV-DELIVERY | 最终回归 / diffcheck / Frozen SHA / review | 最终回归 / diffcheck / Frozen SHA / review | dirty 输入保留；独立控制可响应，实际扫描有界且 partial 明示；Secret 只写不降级；唯一写进程与无后门；发布只认真实证据 | 最终117unit/382integration/23normalpackaged通过；首次batch/重跑分别保留；Frozen12+8不变；Standards/Spec/Architecture/Security无未解决P0/P1，diffcheck0 | 见 [最终命令与逐测试结果](g6-final-results.json) | 0（首次桌面 batch 1，修正后复跑 0） | [最终证据](g6-final-results.json) | PASS |

## Reviewer 索引

| RV | 记录 |
| --- | --- |
| RV-P0-01 | F2-07～09 |
| RV-P0-02 | F1-01～17 |
| RV-P0-03 | F3-01～03 |
| RV-P1-01 | F4-02～04 |
| RV-P1-02 | F1-07/11～14；F3-08～14；F4-08/10 |
| RV-P1-03 | F2-15～17；G5 Undo/格式回归 |
| RV-P1-04 | F2-10～11 |
| RV-P1-05 | F4-05～06 |
| RV-P1-06 | F3-01/03～07 |
| RV-P1-07 | F2-12～13 |
| RV-MODULE | F4-12 |
| RV-DELIVERY | F4-13 |

## 状态边界

Developer ID / Notarization / x64：READY / NOT RUN，须真实环境才能升级；Migration M 未授权。物理拔电未执行；pointer 的断电切点以真实 SIGKILL + fsync/atomic rename 注入验证，不写成物理拔电。真实 macOS sleep/wake 已由用户操作 + 同 PID/系统日志/ComputerUse读回实测通过；不承诺跨重启选区或 undo stack。

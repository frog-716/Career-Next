# G6 F3：备份、恢复和永久清除

Issue #29；隔离 worktree `g6-f3-recovery`，基线 `befe2437a9b260237ae5f08a2d11517437a27032`。本线仅用临时 SQLite、真实文件、受控 ENOSPC 和 deterministic fake。未读取旧 Career，未使用用户资料或真实服务。本报告不表示整个 G6 已通过。

## 发现与修复

五个正式红灯（exit 1）保存在 `/tmp/career-g6-f3/`，结果索引见 [JSON](g6-f3-recovery-results.json)：

- `red-sinks.log`：关闭/排空后敏感 staging 仍可读。新增 `gate.drainAndDiscard(refs)`，排空后只删除受影响受控 sink，包含已关闭结果；无关 B 保留。原 `drain` 的关闭语义保留。
- `red-interrupted-backup.log`：中断 backup 仍是候选而非 failed backup。重启把未发布候选明确归入 failed backup，不根据内容或时间猜成功；完整点不变。
- `red-startup-staging.log`：上个 generation 的 staging 残留不在影响计划。只在启动时把残留登记为 quarantine，用户确认后处理；运行中不整目录清掉其他生产者。
- `red-unknown-blobs.log`：未登记 blob 残留不在计划。增加 writer 提供的 `knownBlobIds()` 窄能力，启动只登记 unknown 文件为 quarantine，不碰已登记 incarnation。
- `red-pointer-metadata.log`：真实子进程在 pointer atomic rename 后、辅助清单更新前被 SIGKILL，清单仍称旧库 current。启动按 Main 已验证的 active root 收敛辅助 copy kind；不自行选择库。

备份发布前还同步 copy 根目录，完整点 durable manifest 发布后才置 ready；新完整点成功前不清旧完整点。所有故障 adapter / 子进程仅在 tests，生产包没有故障开关。

## 逐项证据

下表命令统一为下面的 F3 回归命令，exit 0；actual 来自 77 个实际通过断言。每个测试的完整名称和结果在 JSON。被 root 接线/桌面验证的项目单独列出，不用本线证据替代。

| G6 记录 | 注入与预期 | 实际 / 状态 | evidence |
| --- | --- | --- | --- |
| F3-01 | current/old/candidate/quarantine/failed backup/staging/blob/cache/Proposal/summary 都进影响计划；批准范围才删除 | 两种全副本/保留 backup 场景，通过真实目录/DB 字节检查；PASS | g6-f3-recovery.test.ts，all managed copy kinds 两分支 |
| F3-02 | AI/parser/import/PDF 旧 producer 返回正文/summary/patch/file 均拒绝；打开 sink 排空再删除 | 四 token 与实际 bounded sink 拒绝晚写，closed parser 也清掉，无关 B 保留；G4 real runtime 的 import/PDF 与 AI purge 回归通过；PASS 接缝，root drain 接线待集成复验 | g6-f3-recovery.test.ts；g4-data-fence/file-sinks/runtime/ai-real-seams |
| F3-03 | 保留一个 backup，必须说 selected scope，不能说全部清除 | remainingCopyIds 为真实保留点；该备份敏感字节实际仍在，其余批准目录消失；PASS | all managed copy kinds retained backup=true |
| F3-04 | snapshot/enumeration/copy/hash 每阶段失败或 crash，不发布假完整点 | 四阶段受控失败、实际 blob tamper/hash mismatch；每阶段真实子进程 SIGKILL，最后完整点 verify 仍过，失败点单列；PASS | g6-f3-backup-faults + g6-f3-crash |
| F3-05 | filtered DB/manifest/atomic publish 每阶段失败或 crash；排除正文无自由页/WAL残留 | 三阶段真实子进程 SIGKILL；受控 ENOSPC/发布中断；compact DB 字节不含排除 marker，文件集合仅 DB/blobs/manifest；PASS | backup-faults / crash / completed backup publishes only compact filtered SQLite |
| F3-06 | missing/extra/hash mismatch/crash/cancel 保留最后完整点 | 8 阶段故障和 7 backup SIGKILL，缺失/篡改源 blob、abort 都无新 ready；实际 backup extra 文件不发布，untrusted extra 文件也拒绝；PASS | backup-faults / recovery / crash |
| F3-07 | backup ENOSPC/purge/GC 并发不误删、不谎报 | blob-copy/filtered-publish/manifest ENOSPC；实际 runtime backup 与 GC 同时发起，维护写队列串行；purge 计划含刚完成两个备份，再确认全清；PASS | backup-faults；restore-runtime concurrent real backup and GC |
| F3-08 | restore 缺 blob/额外文件/坏 DB，原 active 不变 | 三种实际文件攻击拒绝，原事实仍读，无 ready candidate；PASS | recovery untrusted restore package |
| F3-09 | symlink/path traversal 不能读取包外或覆盖 active | symlink 与 ../ artifact ID 拒绝，原 DB 不变；PASS | recovery untrusted restore package |
| F3-10 | pointer replace 前突停只选旧提交指针 | 实际子进程 SIGKILL，旧 UUID/事实保留；PASS | crash pointer-before |
| F3-11 | pointer atomic rename 后突停只选新验证库 | 精确 rename 后、manifest copy kind 更新前 SIGKILL；新 UUID/事实与 activation 记录保留，启动收敛一个 current；PASS | crash pointer-after |
| F3-12 | pointer 损坏/target 缺失，不猜库，不创建空库 | 由 root/F4 桌面指针 owner 攻击和修复；NOT RUN 本线 | root G6 verification |
| F3-13 | 新 workspace/backend/connection 身份；旧能力无效；pending Proposal 可读，新接受重校验 | 实际 worker restore，三个 ID 都变，旧 session 拒绝，operation authorized=false，pending proposal 可读且当前 human 接受成功；device fake vault 不进包、不进候选；PASS | restore-runtime real restore changes all three identities |
| F3-14 | restore candidate ENOSPC，不损坏 active 或最后完整点 | 真实文件 handle.writeFile 受控 ENOSPC；candidate quarantine/failed、原 DB/完整备份可读；PASS | backup-faults restore candidate controlled ENOSPC |

SIGKILL 是真实进程突停和 fsync/atomic pointer 切点验证；没有物理拔电测试，不能把证据描述成实际断电。

## 命令与结果

```sh
npm run typecheck
npm run build
npx vitest run tests/integration/g6-f3-recovery.test.ts tests/integration/g6-f3-backup-faults.test.ts tests/integration/g6-f3-crash.test.ts tests/integration/g6-f3-restore-runtime.test.ts tests/integration/g4-data-backup.test.ts tests/integration/g4-data-lifecycle.test.ts tests/integration/g4-data-fence.test.ts tests/integration/g4-data-file-sinks.test.ts tests/integration/g4-runtime.test.ts tests/integration/g4-owner-purge.test.ts tests/integration/g4-purge-excerpt.test.ts tests/integration/g4-purge-incomplete-admission.test.ts tests/integration/g4-ai-real-seams.test.ts tests/integration/g4-purge-plan-review.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/career-g6-f3/final-results.json
git diff --check
```

均 exit 0。最终 14 files / 77 tests PASS（本轮新增 4 files / 37 tests；子进程共 10 个实际 SIGKILL 场景）。日志 `/tmp/career-g6-f3/{typecheck,build,final-tests}.log`。build 仅当前 worktree 常规产物，没有 packaging。Frozen Product 12/12、Architecture 8/8 对 befe 基线 SHA256 不变，JSON 记录逐文件 hash。

## 集成 owner 需要接线与复验

- runtime `drain(refs)` 调 `gate.drainAndDiscard(refs)`；只用原 `drain` 仍会留下关闭结果。
- lifecycle composition 提供实际 writer-owned `knownBlobIds: () => db.prepare('SELECT id FROM platform_blobs').all().map(row => row.id)`；所有已登记 incarnation 都排除在 unknown 隔离之外。
- root 新增 derived search chunks/FTS 的 purge、过滤备份和恢复重建需在新 release 后复验；本线没有修改 migration ordering。
- corrupt/missing pointer、正常 packaged desktop、sleep/wake/close/restart 属 root/F4；没有以这些单元/集成证据代替桌面证据。

REAL PROVIDER / SEARCH / FEISHU = NOT TESTED。Developer ID / Notarization / x64 未执行。没有关 Issue、push main 或进入 Migration M。

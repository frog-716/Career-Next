# G6 F1：本地提交、文件、回执与崩溃

Issue #27；基线 `befe2437a9b260237ae5f08a2d11517437a27032`。本线新增 20 个测试，未发现需要修改生产实现的缺陷。这里只记录 F1 实测，不能据此宣布整个 G6 PASS。

## 接缝与隔离

测试通过 Materials 的公开 backend、正式 writer/owner capability、SQLite adapter、不可变文件 broker 和 Resume frozen job 入口观察行为。所有资料都是固定的隔离夹具，不读取真实用户资料、旧 Career 或外部服务。

`tests/fixtures/g6-storage-driver.ts` 是独立后端测试进程。`g6-storage-writer.ts` 使用实际 `openWorkspace`、发布 migrations 和 `createWriterCommands`，只在测试 adapter 内暂停指定文件/事务切点；父进程随后发送 **真实 SIGKILL**。恢复由未改动的正式 `dist/application/writer.cjs` 执行。测试夹具不属于应用 build entry，也不进入发布包。

当前不可变文件 broker 用 `link` 原子发布，而不是覆盖已有路径的 rename。矩阵中的「blob rename 前/后」对应实际发布动作：候选已经同步但尚未 link，以及 link/目录同步完成后。retention handoff 前/后都仍在正式事务内；此时 SIGKILL 后必须整笔回滚。

SQLite 磁盘不足采用真正的 `max_page_count` 配额，实际 SQLite 引擎返回 `SQLITE_FULL`；Materials 测试用隔离 trigger 请求额外页分配，并未用 `RAISE` 模拟错误。文件/PDF 用用户已授权的受控 quota sink：实际创建、写入、同步和关闭候选文件，超过累计字节配额返回 `ENOSPC`。不填满系统盘。

PDF 故障覆盖被冻结的 owner job、publish hold、候选写入失败、原失败 receipt 和无命名版本。候选字节为受控 PDF-shaped 夹具；这不是打印 renderer 字体/排版验收。正常打印/真实 packaged 桌面由 integration owner 的最终回归另行记录。

## 命令与结果

| 命令 | exit | 结果 / 证据 |
| --- | --- | --- |
| `npx vitest run tests/integration/g6-storage-failures.test.ts --maxWorkers=1` | 0 | 新增 20 tests PASS；`/tmp/g6-f1-checkpoint.log` |
| `node_modules/node/bin/node scripts/g1-integration-build.mjs` | 0 | 原 G1 crash fixture 正式构建；`/tmp/g6-f1-integration-build.log` |
| `npx vitest run tests/integration/g6-storage-failures.test.ts tests/integration/materials.test.ts tests/integration/artifact-files.test.ts tests/integration/g4-data-file-sinks.test.ts tests/integration/g4-x-materials-import-purge.test.ts tests/integration/resume-artifacts.test.ts --maxWorkers=1` | 0 | 6 files / 42 tests PASS；`/tmp/g6-f1-final-integration.log` |
| `npx vitest run tests/commands.test.ts tests/materials-state.test.ts tests/materials-boundaries.test.ts --maxWorkers=1` | 0 | 3 files / 6 tests PASS；`/tmp/g6-f1-final-unit.log` |
| `npm run typecheck` | 0 | `/tmp/g6-f1-checkpoint-typecheck.log` |
| `git diff --cached --check` | 0 | checkpoint 前执行 |

最初一次运行仅因测试 driver 未创建目录而失败；相关原 G1 crash 测试首次回归也因其 build fixture 尚未生成而退出。补齐夹具准备后回归通过。这两次是 harness 问题，不计作生产缺陷的 red-green 证据。F1 没有伪造待修缺陷或改动生产代码。

## 逐切点结算

下面每个 PASS 都由首行 20-test 命令执行，exit code 0；详细原 command ID、临时 workspace、SIGKILL signal、原 receipt 与实际文件数保存在 [JSON 证据](g6-f1-storage-results.json)。

| ID | 实际注入与观察 | 状态 |
| --- | --- | --- |
| F1-01 | staging 打开前 SIGKILL；正常重启无 Raw、blob、staging、自动重放 | PASS |
| F1-02 | staging 写入/sync 后 SIGKILL；另测部分写入 ENOSPC 与已预览字节 hash 损坏；无正式 Raw/假成功，候选可回收 | PASS |
| F1-03 | hold 已持久化后 SIGKILL；原 pending intent 终止为 failed；活 producer 的已发布 hold 在并发 GC 中保持 | PASS |
| F1-04 | 已同步候选、原子发布前 SIGKILL；正常重启释放已终止 producer 的 hold，候选清理 | PASS |
| F1-05 | 实际 blob 发布/目录 sync 后 SIGKILL；未提交业务，正常重启将 orphan 回收 | PASS |
| F1-06 | 正式 callback 返回前、COMMIT 前 SIGKILL；owner/retention/receipt 事务整体回滚，无 Raw | PASS |
| F1-07 | COMMIT 完成后、后端响应前 SIGKILL；原 receipt committed，唯一 Raw 与真实原文字节仍可读；同命令不重复创建 | PASS |
| F1-08 | 正式 retention INSERT 前在事务内 SIGKILL；业务不半提交 | PASS |
| F1-09 | hold 交接/committed receipt UPDATE 后，但 COMMIT 前 SIGKILL；整个业务事务仍回滚 | PASS |
| F1-10 | 同一 live publish 中并发 GC 不认领；delete_claimed 旧 ID 拒绝 hold/retain；同内容新 UUID 发布后旧 claim 删除不影响新 incarnation，随后正式 retention 阻止 GC | PASS |
| F1-11 | 查询 receipt 已返回 worker、尚未交付调用者时 SIGKILL；正常重启仍查同一个 committed receipt | PASS |
| F1-12 | 实际 COMMIT 后丢弃响应并制造断连；fail 不覆盖 committed，原 receipt 收敛；重启同 intent 返回原结果，不创建第二条 Raw | PASS |
| F1-13 | 前述 10 个后端进程切点均实际 SIGKILL；正常 writer 重启，workspaceInstance 保持、backend/connectionGeneration 更新，旧 capability 拒绝，不自动重放 | PASS |
| F1-14 | 本线不执行 packaged app 异常退出；由 F4 的真实正常 arm64 产物覆盖 | NOT RUN（F4 owner） |
| F1-15 | 真 SQLite page quota 返回 `SQLITE_FULL`；独立 command owner 与真实 Materials confirm 事务均无半写，失败原 receipt 可查，DB integrity `ok` | PASS |
| F1-16 | 真候选文件写入经 quota sink 返回 `ENOSPC`；原 receipt `failed/storage_failed`，没有正式 Raw 和 blob | PASS |
| F1-17 | PDF 候选写了一块后 quota `ENOSPC`；partial staging 清理，冻结 job 原 receipt 明确失败，没有正式命名版本、成功 receipt 或保留 blob | PASS |

成功分支均在恢复后通过公开 `read` 读取实际文件字节，而非只检查 SQL 状态；失败分支没有用「历史原件丢失」替代当前保存失败。GC 的持久 claim 与 UUID incarnation 由唯一实际写入口排序，测试不依赖 TTL 判断生产者已退出。

## 边界

Frozen Product Spec / Architecture、根依赖、lockfile、发布迁移、bootstrap、packaging 和其他工作线均未修改。真实 AI / Search / Feishu 未测试。Developer ID / Notarization / x64 状态由 integration owner 保持诚实结算。本线不关闭 Issue、不 push main、不进入 Migration M。

# G6 正常打包应用：在途关闭与恢复

2026-10-03，在正常 arm64 `CareerNext.app` 实际执行。只新增测试与本证据，不修改生产代码、打包配置或 native build。所有资料均为隔离临时 profile 中的合成夹具，无真实网络、Secret、用户资料或旧 Career；结束后应用均关闭、profile 删除。

## 实际结果

| 场景 | 真实边界与观察 | 结果 |
| --- | --- | --- |
| PDF 在途关闭 | 正式 renderer 的 Chromium printToPDF 已实际产出 23485 字节、%PDF-/EOF 正确；测试暂停返回这些实际字节。正常可见窗口关闭后重启，原 command receipt 为 pdf-failed，命名版本列表为空。不是 fake PDF，也不是源代码字符串检查。 | PASS |
| backup 在途关闭 | 24 个合成大正文通过真实 Wiki owner 保存；第二次备份的受管理登记确实为 candidate 时关闭窗口。实际 graceful shutdown 等待其完成，重启登记 ready；原最后完整点保留，新旧两点都通过真实 restore.prepare 全校验。 | PASS |
| stop failure + backup/DB busy | 实际 backup candidate 与第二个 SQLite 连接 BEGIN IMMEDIATE 重叠。公开 product.stop(revoke) 在 3ms 返回 dispatchBlocked=true/persistencePending=true；锁保持超过真实 busy timeout，原命令 receipt_missing。解除锁后只明确重试同一 command ID，收据收敛到 revoked、usedRequests=0。即时闸门与持久收据分别观察，没有实际外发。 | PASS |
| candidate open → reopen → activate | 真实 restore.prepare 登记验证成功的 restore_candidate；正常关窗重启候选仍 ready，active pointer 不自动改变。公开 confirmed activation 后三身份均改变；再重启维持新 workspace 身份。 | PASS |
| 损坏 pointer + 明确选择完整 backup | 在正常应用中先安装原生 showMessageBox 的明确测试选择，再损坏 pointer 并触发真实 reconnect，避免启动弹窗时序竞赛。旧后台退出后选“验证并恢复备份”；真实 verify/activation 无 stub，旧窗口要求 reload，新三身份生效，原 Wiki 内容保留，再重启维持新 pointer。 | PASS（测试明确选择，非真人） |

PDF 故障切点在真实渲染完成、正式交付前，不声称覆盖所有 print 前期切点。备份关闭场景实测为正常等待完成，不伪称 SIGKILL 或半完成点安全发布。坏指针选择走正式 Main reconnect 的同一恢复流程，不声称真人点击或重新启动时选窗的操作证据。

**真实 physical sleep/wake = NOT RUN；真人原生恢复选择 = NOT RUN。** 系统 safeStorage 由另一验证线持有，不由此套替代。无真实 Provider/Search/Feishu 测试。

## 命令与证据

```sh
CAREER_PACKAGED_EXECUTABLE='/Users/frog/Projects/Career-Next/out/g6-final/CareerNext-darwin-arm64/CareerNext.app/Contents/MacOS/CareerNext' npx vitest run tests/desktop/g6-continuity.electron.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/career-g6-continuity/final-results.json
npm run typecheck
```

实际 4/4 PASS、0 skipped，exit 0，测试耗时 20.493s；typecheck exit 0。运行日志 `/tmp/g6-continuity-final.log`，逐项实际观察 `/tmp/career-g6-continuity/observations.json`。持久观察、日志 SHA、实际 executable/app.asar SHA 见 [结果 JSON](g6-desktop-continuity-results.json)。此前旧 F4 包仅预跑 PDF/backup 两项 2/2（另两项 skip）；本表仅根据 root 正常包完整四项结果。

此包含本轮相关 Main/runtime/pointer 接缝；integration owner 将为后续安全补丁再次串行打包并复跑必要测试。本证据不是整个 G6 或真实发布签名通过声明；Developer ID / Notarization / x64 继续 READY。

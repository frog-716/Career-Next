# G6 最终集成验证

基线 `befe2437a9b260237ae5f08a2d11517437a27032`；正常应用生产源码 `e70f4de6574604a27ea94111af99cedb5d80e172`。本轮仅隔离资料、deterministic fake、虚构 Secret。未读取旧 Career、未进入 Migration M；Product Frozen R3 和 Architecture V2 保持唯一正本。

当前结算：**LOCAL G6 PASS，63 个本地故障/恢复场景全部实际通过；G6 本地验收门完成，不声明完整发布验收**。G5 总状态仍 PARTIAL，仅真实 J-07 待验；Developer ID / Notarization / x64 为 READY / NOT RUN，真实 Provider / Search / Feishu 为 NOT TESTED。

## 实际命令与结果

全部实际测试名、结果、命令、exit、包 artifact / 原日志 SHA、冻结逐文件 SHA 见 [机器记录](g6-final-results.json)。同一测试重复执行只统计最后一次有效结果，不把初次失败改成成功。

| 检查 | 实际结果 | exit |
| --- | --- | --- |
| `npm run typecheck` | 当前全部合同、Main、owner、测试类型检查通过 | 0 |
| `npm run build` | 正式 6 个进程/桥 artifact + renderer 3 文件；模块 Schema/manifest 机械聚合 | 0 |
| `npm test -- --maxWorkers=1 …` | 47 文件 / 117 项，全部通过 | 0 |
| `npm run test:integration -- --maxWorkers=1 …` | 75 文件 / 382 项，全部通过 | 0 |
| Forge API `api.package({arch:'arm64',platform:'darwin',outDir:'out/g6-final'})` | 正常 arm64 App，原生 SQLite 重建、prune、asar、local ad-hoc seal | 0 |
| 正常包 desktop batch（排除独立双窗文件） | 首次 14 文件 / 19 项：17 PASS / 2 FAIL；另有由失败 G5 关闭清理产生的 dialog-session 错误，原始 JSON 保留 | 1 |
| 原 G5 完整旅程 + 新 Main credential gates 定向复跑 | 2 文件 / 3 项全部 PASS，无未处理错误 | 0 |
| 正常包双窗口 Resume 独立测试 | 1 文件 / 2 项全部 PASS | 0 |
| 正常包 foreign/print/导航 + 无驱动进程端口检查 | 1 文件 / 2 项全部 PASS | 0 |
| 正常包不同案例最终有效集合 | **16 文件 / 23 项全部 PASS**，含 G1–G5 原桌面回归 | 各成功运行 0 |
| G0 unit / build / Electron probe 回归 | 3 unit + 1 Electron PASS；不把 probe 的安全攻击替代最终包 | 0 |
| `codesign --verify --deep --strict --verbose=2` | valid on disk / Designated Requirement；仅 ad-hoc，不声称 Developer ID | 0 |
| 最终 ASAR audit | 9 个实际 application artifact 与本次 build 逐字节一致；无本仓库 tests/docs/probe/.agents/.env/test-support/故障 CLI 入口 | 0 |

桌面首批两失败没有生产缺陷：旧 G5 脚本没有按新诚实控制协议核对原 stop receipt，点击仍 disabled 的续做按钮；新 native credential 脚本的默认 5 秒观察超时不足以涵盖实际 Safe Storage 加密。分别补显式 UI 原回执核对、90 秒 native-operation 观察期限，使用同一个最终包复跑通过，没有削弱产品断言或修改生产实现。ASAR audit 的最初脚本尝试查找被构建器删除的注释/重命名函数，也已改用实际 artifact 字节比较与协议常量；不是应用失败。

## 故障与真实桌面接缝

[故障矩阵](g6-failure-matrix.md) 保留全部 28 G5 DEFER_G6 映射和全部 RV。F1 实际 SIGKILL、SQLite quota FULL、file/PDF quota ENOSPC；F3 每阶段 backup、restore、purge/producer、副本和 atomic pointer 的真实切点；F2 公开 owner 原子 Apply、unknown A/B/late、actor spoof、预算/权限/代次与回执均由对应逐项 JSON 定位。

- 有界搜索实测返回行/UTF-8 payload bytes/精确比较次数，dirty/超限明确 partial。原生长 SQL 在独立只读进程真实执行并被 SIGKILL；父死亡 watchdog 也实际验证。不虚构 SQLite 内部磁盘/B-tree 指令计量。
- 100 Opportunity / 100 Project / 3 Employment 通过公开 owner 建立；真实浏览器中文 1/2 字、英文、结束状态、长标题、wheel/返回位置/跨导航草稿保持通过。这不是生产吞吐 benchmark。
- [正常连续性](g6-desktop-continuity.md)：真实 Chromium PDF 在交付前关窗、真实 backup candidate 关闭、DB 锁与 backup 并发时快速 stop/原收据收敛、candidate 重开不自动激活、明确恢复后新三身份。实际 Main/backend SIGKILL、duplicate launch、close/reopen、损坏 pointer 只读页也由最终包通过。
- [真实双窗口](g6-two-windows.md)：真实编辑器并发冲突保留；Apply/Undo 保留对窗无关正文，accepted 不回退；相关变更按钮与公开命令均拒绝。保留 G5 真人发现的 Undo/marks 两项实际 packaged 回归。
- Main 系统 Safe Storage 实际加密/解密仅虚构值；输入清空、失败不降级、替换/取消/删除/停用、备份/DTO/logs/CLI 排除通过。两项 P1 先红后绿，再由最终正常包证明 pending-without-binding 启动关闭以及两真实窗口 save→disable→restart 不复活。
- [正常包安全](g6-security.md)：24 次 foreign bridge 实际拒绝；真实 print window 无业务/Secret/Node、外导航/弹窗阻断；另起无 Playwright 的正常进程验证无调试开关/TCP LISTEN，旁端口不被复用/终止。驱动进程本身的调试能力没有冒充生产安全证据。
- 候选恢复先比对受信完整 SQLite schema 再做关系读取；实际恶意 Proposal trigger、view、FTS/shadow/quoted literal 等 11 反例拒绝，3 合法 v5/v6 兼容例通过，不能靠包内自报 digest/migration 放行 executable schema。

真实物理拔电未执行；pointer 掉电边界通过真实 SIGKILL + fsync/atomic rename 切点验证。原生恢复选择由测试给 dialog 明确响应，不冒称真人点击。无 public subtask scheduler，已验证模型不能注册任意 subtask/重置根权限预算；不声称未来 scheduler 已验收。跨重启不承诺 caret/selection/undo stack。

## 真实系统 sleep/wake

用户第二次执行苹果菜单系统睡眠；`pmset` 确认 20:29:59 Entering Sleep → 20:32:19 Wake from Deep Idle/HID，实际 **140 秒**。直接启动的正常 executable 没有 Playwright/debug flags；同 Main PID **95333** 在唤醒后仍存活。Computer Use 读取同一窗口，标题与正文完全一致，状态“已保存”；真实点击“查看知识修订历史”，版本 1 正文读回正确，证明窗口/后端仍可操作。最终正常关闭 exit 0。见 [逐项证据](g6-real-sleep-wake-results.json)。

首次睡眠虽然有系统事件，但测试驱动目标关闭，观察脚本退出后应用重开，因此该次连续性明确未验证，没有拿重开冒称唤醒。第二次改直接运行并使用 Computer Use 后才标 PASS。`Wake Requests` 属预约信息，不算实际唤醒事件。没有要求或声称跨重启恢复 caret/selection/undo stack。

## 独立 Review 与状态边界

Standards、Spec、Architecture/Security 由独立 Agent 只读审查。正式两次凭据 P1（启动绕过 pending marker、旧 save 重开新 disable）与 ACK 逆序的持久化反例均已修复并通过真实 Main/owner 回归。完整 schema 恶意触发器的红灯保留并修复。最终无未解决已确认 P0/P1；独立结论见 [最终 review](g6-final-review.md)。

Frozen Product Spec **12/12 SHA 不变**；Frozen Architecture **8/8 SHA 不变**（原 baseline 和当前逐文件 hash 见 JSON）。既有 G1–G5 migration SQL 未改，v6 仅追加可信 fragment 与派生索引通知。根依赖/lock 未变；测试接缝不进入正式应用。

G5 104 分类保持历史事实：PASS_ALREADY 38 / PASS_G5 31 / DEFER_G6 28 / DEFER_M 5 / EXTERNAL_LIVE_PENDING 1 / CONDITIONAL 1；G6 的实测矩阵不改写旧分类为 G5 已测，也不代替真实 J-07。UX polish backlog 不扩成本轮普通产品功能。下一门仅在本轮结束后按用户独立授权；本轮不启动 Migration M 或真实外部服务。

## 本轮 GitHub 收尾

Umbrella [#26](https://github.com/frog-716/Career-Next/issues/26) 与 F1–F4 [#27](https://github.com/frog-716/Career-Next/issues/27) / [#28](https://github.com/frog-716/Career-Next/issues/28) / [#29](https://github.com/frog-716/Career-Next/issues/29) / [#30](https://github.com/frog-716/Career-Next/issues/30) 已更新并关闭，关闭的是本轮已完成的本地工程门。发布环境 READY / NOT RUN、真实外部 NOT TESTED 和 G5 PARTIAL 明确写入每条 Issue，不把这些状态改成 PASS。

最终 checkpoint 仅追加后续测试/证据/导航，正常应用生产文件仍与 `e70f4de` 完全相同；不需要为文档重新打包。最终 HEAD / origin 和 clean 状态由提交推送后的实际 Git 检查回报。

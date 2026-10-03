# G3 人工强子模块验收

范围以 [umbrella #10](https://github.com/frog-716/Career-Next/issues/10)、[Research #11](https://github.com/frog-716/Career-Next/issues/11)、[Interview #12](https://github.com/frog-716/Career-Next/issues/12)、[Offer #13](https://github.com/frog-716/Career-Next/issues/13) 为准。基线 `e3fd0e1c53db170a847e93a5d9c3f4faead99b2e`；冻结 DELIVERY G3，仅人工能力。不表示全产品完成，不启动 AI，不进入 G4。

当前状态：**PASS，2026-10-03**。业务代码与两轴审查固定于 `47911abda70b5bdd820160a397cb9c37fb405e7a`；后续 checkpoint 仅保存此验收记录和状态导航。

## 真实业务与边界

- Research：公司与机会各自维护当前研究文档；条目稳定身份，人工改写清除旧确认/核验，补证、撤回/恢复及明确提升均保留必要历史。提升后公司拥有唯一正文，原机会仅引用；私有来源摘录和旧机会历史不会一起共享。Wiki 经公开查询只读显示同一条目并导航回所属机会，不保存研究副本。
- Interview：真实轮次支持未知日期、排期、改期、待重约、完成、多轮和历史晚录；手工 Preparation / Transcript / Final Review 属于本轮次。练习只关联本机会的真实轮次，不改变真实面试状态或 core 阶段。确认时间纠错通过公开能力修正原事件；预约和完成时间独立，未知不补今天/午夜。
- Offer：没有投递/面试也能记录现实 Offer。条件、未知字段、真实原件状态及条件历史由 Offer 拥有；接受冻结当时条件与原件依据，正式新条件使旧接受不适用于当前条件。误接受/误撤回明确纠正原事件；已纠错的事实和被污染的旧快照不会影响恢复结果。后来真实变化继续保留。
- core 只拥有公司/机会身份、phase、result 与自己的历史。子模块通过公开能力在同一 SQLite writer 的短事务组合；失败整体回滚。原件校验严格最多读取声明尺寸加一字节，并独立登记 Offer 条件/接受依据的保留原因。没有自动 Submission、Employment 或 AI 决策。

## 最终验证

全部数据库和材料均为独立临时测试资料。最终命令使用同一审查后代码；测试的 browser fixtures 独立缓存，完整 unit 以一个 worker 串行运行，避免与原生打包/桌面进程争用机器。

| 检查 | 结果 |
| --- | --- |
| npm ci、install:electron、native:rebuild | PASS，依赖 lock 未变 |
| npm run typecheck | PASS |
| npm test -- --maxWorkers=1 | PASS，30 文件 / 63 项，含真实浏览器表单 |
| npm run test:integration | PASS，23 文件 / 101 项，真实 SQLite / writer / 原件 / 升级 |
| npm run build | PASS |
| smoke:g3 / smoke:g3:packaged | PASS / PASS，正常开发和 arm64 打包完整旅程及重启 |
| G1 smoke:dev / smoke:packaged | PASS / PASS |
| G2 smoke:g2 / smoke:g2:packaged | PASS / PASS，六个原 owner 及实际 PDF 回归 |
| G0 build:g0 / test:g0 / smoke:g0 | PASS，3 项 unit 与真实进程 / SQLite / PDF / Safe Storage 安全桥 |
| npm run package、codesign --verify --deep --strict | PASS，正常 arm64，本地 ad-hoc 封签 |
| RV-MODULE / Standards / Spec | PASS / PASS / PASS，未解决发现各 0 |
| git diff --check、冻结 ZIP / 基线逐字节核对 | PASS |

正常 App 位于 `out/CareerNext-darwin-arm64/CareerNext.app`；构建不提交。实际 `Contents/Resources/app.asar` SHA256：`e44523d66be55f5352858e037487244d0b3b66d4591a42f3bf3ea3308619aab8`。

打包旅程经真实页面操作：公司研究与机会研究→改写→撤回/恢复→明确提升→Wiki 同条目只读；未知日期轮次→排期→改期→待重约→重约→未知日期完成→原确认日期纠错→历史轮次；另一机会直接 Offer→绑定真实受保护原件→明确接受30k→正式新条件25k→旧30k接受依据仍在→误撤回与明确纠错。最后重启，25k当前条件和原接受历史保持一致。公开 owner 复查没有伪造 Submission 或自动 Employment，renderer 无页面错误。

## 独立审查与纠错证据

Standards / Spec 最终均 PASS，未解决发现各 0；固定 SHA 同上。Standards 独立复测 5 文件 / 23 项；Spec 独立复测 3 文件 / 29 项。

发现和修复均有实际 RED → GREEN：文件检查后增长 8 MiB 的读取上限；兼容旧 G2 无 previousResult 的真实继续；Offer 误撤回纠错；正式换条件后不得恢复旧 accepted；面试确认日期同轮次纠错；两个误撤回以两种顺序纠正；通用机会结束纠错不得误标旧真实事件。标准审查未发现跨 owner 私有访问、重复状态正本或额外框架。

RV-MODULE 同时检查三个模块的 import 声明与真实 SQLite 写入轨迹，运行时记录 core 公开能力边界，验证兄弟私有表不被写入；伪造操作、跨 owner 故障、冲突和未知回执另有真实 Contract → owner → SQLite → Frontend 测试。

## 迁移与冻结输入

版本 3 `003-g3-submodules` 追加三个 owner fragment 及 Offer 独立 retention；已发布 G1/G2 SQL 不变。实际 G1/G2 Git checkpoint 的 writer 创建工作区，再升级至新版；原件字节、SourceRef、workspaceInstance 和回执不变，重启不重复升级。新增批次失败整体回滚；篡改批次/未来版本拒绝，受保护文件缺失/损坏不能形成可用恢复点。这是技术恢复机制，未建设完整 Backup / Restore 产品。

产品规格 12/12、架构 8/8 个文件与原 ZIP 逐字节一致，也与 G2 基线一致。对按完整仓库相对路径排序的 `SHA256  path` 清单再取 SHA256：

- Product Spec：`9dbefa32389beb64165e3295eee14fa55f0b904462a486933c49658089193da5`
- Architecture：`3d87555dbca17b92de34329ac4c35953d005e92eb0b0fda1394577b397dc23f8`

未读取旧 Career；未提交数据库、原件、Secret 或真实用户数据。G2 真实 macOS 简体拼音验收沿用用户 2026-10-03 的 PASS，见 [G2 人工 IME 证据](g2-first-batch.md)；本轮自动化不冒充新的真人 IME 验收。

Developer ID signing、Notarization、x64 保持 **READY**。下一门 G4 未授权，本轮停止。

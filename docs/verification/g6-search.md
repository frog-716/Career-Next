# G6 受控本地搜索能力验证

日期：2026-10-03。独立工作范围：Platform Search、公开搜索 DTO、定向测试。仅隔离 SQLite 和合成正文，无真实网络、Secret 或用户资料。正常 Runtime/Main/UI、release6 迁移注册、owner dirty 通知、真实停止控制和最终打包门由 G6 主线接入验证；本报告不单独宣告 G6 PASS。

## 最小能力与边界

- `platform/search/public.ts` 暴露 `createLocalSearch`、`createLocalSearchIndex` 和 `localSearchMigration`。固定 owner 为 Wiki / Opportunity / Project；Renderer 仅提交查询、已注册范围和主键游标，不能提供 SQL、表名、文件路径、执行预算或脚本。
- 唯一 writer 从公开 owner DTO 建立可重建投影，dirty queue 只记录 owner / ID。维护每批最多 8 个 DTO，单个正文 UTF-8 上限 768000 bytes，chunk 上限 4096 bytes；固定 63 字符重叠保留所有支持的跨块查询。增量 FTS merge 限为 2 pages。维护失败不得改变正式业务 receipt；组合层负责独立调度及重新检查正式 owner 的范围 / revision。
- 候选使用 owner / scope / scopeId / active 索引和 UUID 主键范围游标；chunk 使用 owner / ID / ordinal 范围。中文 1、2 字使用有界 chunk 比较，3 字及以上使用真实 trigram FTS 后精确比较。不会查询 `json_extract` 或扫描整个 owner JSON 正文。
- 固定只读子进程打开 `readonly:true`、`query_only=ON` 的连接，不成为新 writer。最多 2 个并发查询；超时 / 取消 / close 发送 SIGKILL，等待实际 exit 才释放查询槽并返回。`ReadProcessSpawner` 允许可信 Main 换成固定 utilityProcess launcher，无任意执行接口。
- 当前 Forge RunAsNode fuse 基线开启；真实 Electron 44.5.1 Main → utility → 固定 helper 启动已验证，继承的 `process.execPath` 是 Electron Helper。生产打包行为仍由主线 packaged smoke 确认。
- 默认预算：256 返回投影行、262144 UTF-8 payload bytes、500000 次精确字符比较、50 个结果、1500ms。超预算、dirty 投影、读锁或超时均显示“结果未完整检索”，不能把不完整空结果写成全库无匹配。

## 先红后绿

1. 原生 SQLite 长读：隔离 readonly worker 真实执行 10000000 次递归 CTE。原先 Node Worker thread 在请求 terminate 后仍等待原生 SQL，`close()` 实测 **943.579959ms**，违反 `<500ms`，测试 exit 1。改为专用子进程 SIGKILL 后相同真实 SQL 提前终止，等待实际退出，再 `close()` 无 SQL 等待，测试 exit 0。启动 marker 证明 SQL 已实际开始，未以抛 Error 模拟卡顿。
2. 文档间预算边界：5 个 Project 投影、每页 4 行预算，真实查询返回 partial 却缺 cursor，续查测试 exit 1。修复为已完成文档记录最大 ordinal；确认完整结束才清除 cursor。测试续查取得全部 5 个 ID，exit 0。

两次红灯原始输出及最终命令 / exit 保存在 [g6-search-results.json](g6-search-results.json)；本机原始日志为 `/tmp/g6-search-native-sql-red.log` 和 `/tmp/g6-search-cursor-red.log`。

## 自动回归证据

4 个测试文件，11 项 PASS，最终命令 exit 0；`npm run typecheck` exit 0。测试使用实际 SQLite 文件、实际 FTS、实际子进程和实际 SQLite Backup API。

- 中文“蛙 / 牛蛙 / 蒸牛蛙”、英文大小写、真正无匹配、scope / scopeId / active 边界、拒绝额外 SQL 字段：PASS。
- 8 个各 64000 字中文正文的行 / UTF-8 字节 / 比较预算：PASS；实际返回行与 payload bytes、实际执行比较数逐项记录，超限显示 incomplete 并提供 chunk 游标。
- 4096-byte 边界 trigram 命中，修改后旧词消失，永久删除后旧片段消失：PASS。dirty 未索引明确 incomplete。候选和 chunk `EXPLAIN QUERY PLAN` 为 indexed SEARCH，非全表 SCAN。
- dirty 每批最多 8 个、取消中止维护、错误 owner DTO 留 dirty 待重试：PASS。真实 chunk insert/delete 触发 FTS 更新。
- 受控 `journal_mode=DELETE` + `BEGIN EXCLUSIVE` 产生实际读锁失败；独立本地控制 callback 继续响应；ROLLBACK 后重新查到真实命中：PASS。此 callback 仅是独立事件循环响应证据，正常应用 revoke/stop 验收见主线报告。
- 真实 WAL fixture、64 个大正文投影、原生长读 + SQLite backup（每次 1 page）+ dirty batch 8 / FTS merge 2 同时运行；backup 尚未完成时 AbortController 取消实际读进程，等待其 exit，backup 最终 `integrity_check=ok`：PASS。
- 独立实际 Electron utility execPath 固定 helper 启动：PASS；未触碰应用用户数据、钥匙串或 UI。

最新实测数值、fixture 路径、query plans、完整结果和命令输出见 JSON。时间只是本机受控样本，不作为吞吐量承诺。

## 计量与验收限制

`rows` / `bytes` 是实际返回给搜索算法的有界投影 metadata / chunk 行及 UTF-8 payload；`comparisons` 是精确比较实际次数。它们不是 SQLite 内部 B-tree 访问次数、物理磁盘 I/O 或原生 FTS 指令计数。原生 FTS 内部执行时间由独立进程超时并 SIGKILL 约束，不虚构不可观察的内部读取数字。

本报告不证明真实外部 Search 服务，也不替代主线的正常 packaged App 搜索、业务 receipt 与真实控制并行、备份排除派生缓存、恢复重建和 purge 接缝测试。跨模块集成由 root / F3 持有，搜索模块没有新增事实 owner、后台服务或第三方框架。

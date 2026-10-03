# G6 integration

基线 `befe2437a9b260237ae5f08a2d11517437a27032`。用户已授权 G6；[故障矩阵](../verification/g6-failure-matrix.md) 在实施前建立，全部 28 DEFER_G6 和 Reviewer 项已映射。

| Owner | Issue | 允许修改 | 独立 worktree |
| --- | --- | --- | --- |
| F1 | #27 | platform/files、platform/commands、platform/database 的本地提交故障修复与 F1 测试；Materials 最小修复需先协调 | g6-f1-storage |
| F2 | #28 | ai-runtime、AI controller/product/search、相应 F2 测试；owner Apply 最小修复需先协调 | g6-f2-ai |
| F3 | #29 | platform/backup、platform/persistence、data lifecycle/purge workflows 与 F3 测试 | g6-f3-recovery |
| F4 / integration | #30 / #26 | Wiki dirty-read 修复、受控搜索、Secret、桌面与规模测试；根依赖、迁移排序、bootstrap、packaging 和最后集成仅 root 串行管理 | g6-f4-desktop / main |

各线不得改冻结正本、全局规则、其他线文件、根依赖或发布迁移历史。接口/范围冲突先发给 integration owner；不复制外域实现。每线只用独立临时数据库、blobs、cache、userData 和虚构 Secret，禁止真实外发或旧 Career。失败先保留 red 证据再最小修复，测试走公开能力/实际 adapter；不在生产包添加故障后门。

每线提交独立 commit 和实际 command/exit code/evidence 报告；root 串行合入、重新回归并结算矩阵。G5 PARTIAL/真实 J-07 和 Developer ID/Notarization/x64 READY 继续保持各自边界。全部本地切点实际通过才可写 LOCAL G6 PASS；未执行写 NOT RUN。

# Career-Next

- J-07 三个真实分支已使用隔离 TEST DATA 验收 PASS，G5 总状态 PASS。真实发送仍须最终预览与明确授权；飞书仅可只读，本次为 user CLI 读取指定文档后由正式 Materials 保存缓存。见 `docs/verification/j07-real-external.md`；不进入 Migration M。

- 从 [MAP.md](MAP.md) 开始阅读，它是项目地图和文档导航入口。
- Product Spec Frozen R3 位于 `docs/product-spec/`，是产品规则唯一正本；未经明确授权不得修改。
- Architecture V2 Frozen 位于 `docs/architecture/`，是冻结架构唯一正本；未经明确授权不得修改。
- 旧 Career 不得作为新实现参考；只有未来明确授权的独立审计任务可以按其范围读取，不能据此导入旧实现。
- G0–G4 已 PASS；G5 产品、真人桌面及真实外部 J-07 已 PASS。G6 本地故障/恢复门已 PASS，发布环境项仍 READY / NOT RUN；入口见 `docs/verification/g6-failure-matrix.md`，并行边界见 `docs/agents/g6-integration.md`。回归只用隔离夹具和 deterministic fake；不得继承已消费的 J-07 发送授权重复调用真实服务，不进入 Migration M。`probe/` 仅为 G0 实验。

## Agent skills

Matt Skills 位于 `.agents/skills/`，来源记录在 `skills-lock.json`。详细项目协作配置见 `docs/agents/`，此处不复制 Skill 流程。

### Issue tracker

GitHub Issues（`frog-716/Career-Next`）是开发需求和任务管理正本。见 [issue-tracker.md](docs/agents/issue-tracker.md)。

### Domain docs

采用 Single-context，全项目共用术语体系；glossary 和后续 ADR 仅补充术语与新增工程决策，不复制或替代冻结正本。见 [domain.md](docs/agents/domain.md)。

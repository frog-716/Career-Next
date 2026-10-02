# Career-Next

- 从 [MAP.md](MAP.md) 开始阅读，它是项目地图和文档导航入口。
- Product Spec Frozen R3 位于 `docs/product-spec/`，是产品规则唯一正本；未经明确授权不得修改。
- Architecture V2 Frozen 位于 `docs/architecture/`，是冻结架构唯一正本；未经明确授权不得修改。
- 旧 Career 不得作为新实现参考；只有未来明确授权的独立审计任务可以按其范围读取，不能据此导入旧实现。
- G0 技术验证已 PASS；证据见 MAP 引用的 Issue #1。`probe/` 代码只服务于可行性实验，不能直接充当正式平台。尚未进入 G1；后续开发需另行明确授权。

## Agent skills

Matt Skills 位于 `.agents/skills/`，来源记录在 `skills-lock.json`。详细项目协作配置见 `docs/agents/`，此处不复制 Skill 流程。

### Issue tracker

GitHub Issues（`frog-716/Career-Next`）是开发需求和任务管理正本。见 [issue-tracker.md](docs/agents/issue-tracker.md)。

### Domain docs

采用 Single-context，全项目共用术语体系；glossary 和后续 ADR 仅补充术语与新增工程决策，不复制或替代冻结正本。见 [domain.md](docs/agents/domain.md)。

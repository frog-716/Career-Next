# Domain Docs

## Single-context

Career-Next 是一个产品，共用一套项目级术语。四个 workspace 表达业务与技术边界，不是四套独立产品语义；不为 Wiki、Opportunity、Project、Employment 分别建立重复的术语正本。

## 阅读入口与权威

- 从根目录 `MAP.md` 和 `AGENTS.md` 开始，按任务范围阅读冻结产品正文与架构正文。
- `docs/product-spec/` 是 Product Spec Frozen R3 唯一正本，`docs/architecture/` 是 Architecture V2 Frozen 唯一正本；两者未经明确授权不得修改。
- 冻结 ADR 位于 `docs/architecture/ADR/`；涉及对应架构决定时读取，不另建副本。

## 按需维护的补充文档

- 根目录 `GLOSSARY.md`：全项目唯一补充术语表，只在真实术语问题得到澄清时创建或更新；引用冻结正文，不复制完整产品语义。
- `docs/adr/`：只记录后续新增工程决策，引用相关冻结依据。不得用新 ADR 静默覆盖冻结规则；发生冲突时先明确指出冲突并交由用户裁决。
- 当前没有 glossary 或后续 ADR 时继续工作，不提前生成空文档或按领域批量创建目录。
- 使用已定义的术语；缺失的术语按实际问题澄清，不能另造会与冻结规格竞争的概念。

只有出现真实独立变化压力并经用户确认，才考虑升级为 Multi-context；workspace 数量本身不是升级理由。

## Skill 对接

`domain-modeling` / `grill-with-docs` 及其他消费领域文档的 Matt Skills 按以上入口和边界读取、维护补充文档。新文档形成长期入口时同步 MAP。

本配置可以直接编辑；不复制用户级全局规则、architecture Skill 或 Matt Skills 的完整操作流程。

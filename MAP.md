# Career-Next 项目地图

## 目标与当前阶段

Career 是本地优先的长期职业工作台，覆盖求职、真实工作记录和职业积累。四个一级入口是 Wiki、机会、项目、任职。

本仓库是从零全量重写的唯一开发仓库。当前仅完成开发环境初始化；未进入 G0，尚无应用实现或运行入口。旧 Career 仅属历史证据，本轮未读取或导入。

## 冻结输入与阅读入口

1. 先读本 MAP，再读 [Product Spec 入口](docs/product-spec/rebuild-spec/README.md) 和 [PRODUCT](docs/product-spec/rebuild-spec/PRODUCT.md)。产品正文位于 `docs/product-spec/rebuild-spec/`；`audit/` 仅保留决策追溯，校验清单位于 `docs/product-spec/SHA256SUMS.txt`。
2. 再读 [ARCHITECTURE](docs/architecture/ARCHITECTURE.md)、[MODULES](docs/architecture/MODULES.md)，按需查看 [DATA](docs/architecture/DATA.md)、[AI-RUNTIME](docs/architecture/AI-RUNTIME.md) 与 `ADR/`。
3. [DELIVERY](docs/architecture/DELIVERY.md) 是后续开发顺序和验收门的导航，本轮不执行其中的 G0 或后续计划。

状态以用户于 2026-10-02 确认为准：Product Spec = Frozen R3，Architecture V2 = Frozen。两个 ZIP 的全部文件已原样保存，仅移除各自外层目录；正文中的 R2 标题、待审查状态和历史阶段指令保留原文，不覆盖当前状态或本轮授权范围。

## 顶层模块

| 位置 | 未来职责 |
| --- | --- |
| `apps/desktop/` | 桌面窗口、后端生命周期监督、受限能力桥与打包 |
| `packages/contracts/` | 前后端查询与命令合同；领域合同由对应模块维护 |
| `packages/frontend/` | Shell、设计系统、业务视图和编辑会话 |
| `packages/backend/` | 业务 owner、跨域用例、AI Runtime、平台能力 |
| `tests/` | 后续合同、跨域集成、旅程与真实桌面验证 |

上述四个 package 均为私有 npm workspace，当前仅有清单，无依赖或业务模块样板。顶层名称对应冻结架构的 desktop / contracts / frontend / backend。

## 依赖方向与 owner 原则

- 前端通过 Contract 查询和提交命令；不导入后端实现，不直接访问数据库、文件或 Provider。合同不依赖前后端实现。
- Desktop 负责桥接与进程监督，不持有业务真相；正式状态由后端对应 owner 裁决。
- 各领域及 Opportunity 子模块只经公开能力组合，不能直接写其他 owner 的数据。跨域事务不放宽私有实现访问边界。
- Profile 拥有当前本人身份；Research 拥有研究正文，Wiki 仅引用；Opportunity core 拥有阶段与结果；Resume 与实际发送历史各守自己的正本。详细归属以 MODULES 为准。
- AI Runtime 管任务、权限和提案，目标业务 owner 负责正式写入；关联与来源引用不自动授予读取、外发或修改权。
- 根依赖、lockfile、bootstrap 与未来迁移发布顺序由集成 owner 串行管理；公共合同和模块边界变化时同步本 MAP。

全局操作规则来自 `/Users/frog/.codex/AGENTS.md`，已确认可读取。

项目工程协作入口见 [AGENTS.md](AGENTS.md)；Matt setup 配置位于 `docs/agents/`：[GitHub Issues](docs/agents/issue-tracker.md) 与 [Single-context 文档约定](docs/agents/domain.md)。

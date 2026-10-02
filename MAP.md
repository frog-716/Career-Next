# Career-Next 项目地图

## 目标与当前阶段

Career 是本地优先的长期职业工作台，覆盖求职、真实工作记录和职业积累。四个一级入口是 Wiki、机会、项目、任职。

本仓库是从零全量重写的唯一开发仓库。G0 技术可行性验证已 PASS，真实 macOS 中文 IME 已由用户人工验收；G1 已 PASS，G1 已建立个人独立 Raw 的本地选择、预览、确认保存和回读；当前开展 G2 第一批 W/E/P/O/R/U 人工业务切片，不启动 AI Runtime、不进入 G3。Developer ID signing、公证、x64 保持 READY，尚未实际验收。旧 Career 仅属历史证据，本轮未读取或导入。

## 冻结输入与阅读入口

1. 先读本 MAP，再读 [Product Spec 入口](docs/product-spec/rebuild-spec/README.md) 和 [PRODUCT](docs/product-spec/rebuild-spec/PRODUCT.md)。产品正文位于 `docs/product-spec/rebuild-spec/`；`audit/` 仅保留决策追溯，校验清单位于 `docs/product-spec/SHA256SUMS.txt`。
2. 再读 [ARCHITECTURE](docs/architecture/ARCHITECTURE.md)、[MODULES](docs/architecture/MODULES.md)，按需查看 [DATA](docs/architecture/DATA.md)、[AI-RUNTIME](docs/architecture/AI-RUNTIME.md) 与 `ADR/`。
3. [DELIVERY](docs/architecture/DELIVERY.md) 是开发顺序和验收门的导航。当前 G1 范围、验收和命令证据见 [G1 Issue #2](https://github.com/frog-716/Career-Next/issues/2)；历史技术验证见 [G0 Issue #1](https://github.com/frog-716/Career-Next/issues/1)。

状态以用户于 2026-10-02 确认为准：Product Spec = Frozen R3，Architecture V2 = Frozen。两个 ZIP 的全部文件已原样保存，仅移除各自外层目录；正文中的 R2 标题、待审查状态和历史阶段指令保留原文，不覆盖当前状态或本轮授权范围。

## 顶层模块

| 位置 | 未来职责 |
| --- | --- |
| `apps/desktop/` | 桌面窗口、后端生命周期监督、受限能力桥与打包 |
| `packages/contracts/` | 前后端查询与命令合同；领域合同由对应模块维护 |
| `packages/frontend/` | Shell、设计系统、业务视图和编辑会话 |
| `packages/backend/` | 业务 owner、跨域用例、AI Runtime、平台能力 |
| `tests/` | 后续合同、跨域集成、旅程与真实桌面验证 |

上述四个 package 均为私有 npm workspace。顶层名称对应冻结架构的 desktop / contracts / frontend / backend；各自的 `probe/` 仍仅用于 G0，不是正式工程基础层。

## G1 正式入口

- `frontend/features/materials/`：选择、预览、明确确认、取消、回执核对和正式回读；合同正本在 `contracts/materials/`。构建按模块生成 JSON Schema 和操作清单到 `dist/contracts/materials/`。
- `apps/desktop/main/`、`preload/`、`capabilities/`：安全窗口、原生文件选择、窄能力桥与 backend 监督；不拥有业务正本。
- `backend/bootstrap/`：utilityProcess 和唯一 SQLite 写 worker 的装配；`domains/materials/`：个人独立 Raw 的身份、SourceRef、证据原件生命周期与业务裁决。
- `backend/platform/database/`：真实写锁、最小迁移、receipt / hold / retention；`platform/files/`：有界文本 staging 与不可覆盖的 UUID blob，不裁决业务语义。
- 工作区身份持久化，backend 和 MessagePort 每次启动/重连换代；可信 human 由接入端建立。正式提交在同一短事务内完成 Materials、retention 与 receipt；文件发布在事务外，GC 由同一 writer 排序。
- 开发与验收命令见 README；`tests/integration/` 使用真实 SQLite 和文件，`tests/desktop/` 验证真实开发态和 arm64 包。测试资料与构建产物不进入 Git。

## G0 运行入口

- `apps/desktop/probe/`：窗口、安全桥、临时 Secret 与受限 PDF；`packages/backend/probe/`：utilityProcess、单一 SQLite 写线程与可停止的慢查询线程。
- `packages/contracts/probe/`：最小受检合同；`packages/frontend/probe/`：React 技术测试界面。
- `scripts/g0-build.mjs`：独立历史探针构建；`tests/g0*.test.ts`：独立后端和真实 Electron 验证。
- 可复现命令和边界说明见 [README](README.md)。临时数据库、Secret 密文、PDF 与构建产物不进入 Git；关闭探针后清理本次临时数据。

## 依赖方向与 owner 原则

- 前端通过 Contract 查询和提交命令；不导入后端实现，不直接访问数据库、文件或 Provider。合同不依赖前后端实现。
- Desktop 负责桥接与进程监督，不持有业务真相；正式状态由后端对应 owner 裁决。
- 各领域及 Opportunity 子模块只经公开能力组合，不能直接写其他 owner 的数据。跨域事务不放宽私有实现访问边界。
- Profile 拥有当前本人身份；Research 拥有研究正文，Wiki 仅引用；Opportunity core 拥有阶段与结果；Resume 与实际发送历史各守自己的正本。详细归属以 MODULES 为准。
- AI Runtime 管任务、权限和提案，目标业务 owner 负责正式写入；关联与来源引用不自动授予读取、外发或修改权。
- 根依赖、lockfile、bootstrap 与未来迁移发布顺序由集成 owner 串行管理；公共合同和模块边界变化时同步本 MAP。

全局操作规则来自 `/Users/frog/.codex/AGENTS.md`，已确认可读取。

项目工程协作入口见 [AGENTS.md](AGENTS.md)；Matt setup 配置位于 `docs/agents/`：[GitHub Issues](docs/agents/issue-tracker.md) 与 [Single-context 文档约定](docs/agents/domain.md)。

## G2 协作入口

任务和验收以 GitHub G2 umbrella / 六个业务 Issue 为正本；接口与并行边界见 [G2 集成约定](docs/agents/g2-integration.md)，统一术语见 [GLOSSARY](GLOSSARY.md)。根依赖、迁移批次和运行装配由 integration owner 串行维护。

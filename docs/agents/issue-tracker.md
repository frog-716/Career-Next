# Issue tracker: GitHub

Career-Next 的开发需求、增量实现规格和任务以 [frog-716/Career-Next 的 GitHub Issues](https://github.com/frog-716/Career-Next/issues) 为管理正本。通过 `gh` CLI 操作，仓库由 `origin` 确定。

Frozen Product Spec 和 Frozen Architecture 仍分别以 `docs/product-spec/`、`docs/architecture/` 为唯一正本；Issue 通过路径和 Requirement / Acceptance ID 引用，不复制完整正文，不借任务描述改写冻结规则。

## 操作约定

- 查询任务使用 `gh issue view <number> --comments`；查询队列使用 `gh issue list`，保留标签、负责人和依赖信息。
- 创建、评论、标签、认领与关闭任务使用对应的 `gh issue` 命令。多行正文写入临时文件，通过 `--body-file` 提交。
- ticket dependency 优先使用 GitHub 原生 issue dependencies。原生依赖不可用时，才在任务正文明确记录 `Blocked by: #<number>`；阻断任务关闭后才视为解除。
- PR 用于提交和评审代码变更，引用对应 Issue；不把 PR 当作另一份任务正本。

## Pull requests as a triage surface

**PRs as a request surface: no.**

当前未安装 `triage` Skill，setup 不配置 triage 标签，也不创建 GitHub 标签或 Issue。本文件记录后续工作方式，不构成启动任务拆分或业务实现的授权。

## Skill 对接

`to-spec` / `to-tickets` 的“publish to the issue tracker”指写入 GitHub Issues；`implement` / `implement-spec` 等读取任务时从 GitHub 获取相关 Issue 和评论。

这些配置可以直接编辑；只有切换任务管理方式或重新初始化时才需要重跑 setup。

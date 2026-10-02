# G2 第一批的集成约定

任务正本是 GitHub G2 umbrella 与 W/E/P/O/R/U 六个子 Issue。冻结产品与架构仍是唯一规则正本。本轮不进入 G3，不读取旧 Career。

## 模块接口

各业务线维护 `contracts/<module>/schema.ts` 的 `Request`、`Result`（Zod 严格对象）及 `manifest.ts`。manifest 导出 `<module>Manifest`，含 module、schemas、operations；operation 名来自本模块 Request。各线不要维护根聚合清单。

后端公共入口 `domains/<module>/public.ts` 导出 `create<Module>Domain(db, dependencies?)`，返回 `handle(input: unknown)`，先按 Request 校验，再以 Result 校验返回值。业务写入由唯一 writer 调用；模块不创建第二个正式连接。公共关系 resolver 仅返回业务 DTO，不暴露 db、SQL 或 repository。模块 migration 导出 `<module>Migration`（SQL 片段）；发布顺序和 checksum 由集成 owner 管理。

可信 human session 在接入处创建、在 writer 校验；不在 JSON DTO 接受 actor。公共技术回执是 `platform/commands/receipts.ts` 的 `executeCommand` / `commandReceipt`；每个模块用 own Result 解析回执，改写和成功回执同事务。命令使用 UUID、更新带 expectedRevision，错误不冒充保存成功；断线后核对原 commandId，不能盲目重发。BusinessTime 位于 `contracts/common/business-time.ts`，不是录入时间。

前端公共入口 `features/<module>/index.tsx` 导出 `<Module>Page`，接收 `request: (input: Request) => Promise<Result>`。跨模块关系以注入的公开查询或 public contract 组合，不导入他域实现。ResumePage 还接收 opportunityId 和独立 profileRequest；OpportunityPage 的 onOpenResume 回调只负责导航。模块页面使用 React Query 缓存、RHF 普通表单；缓存不是业务正本，mutation 不自动重试。Tiptap 仅在 R 内做文档适配。

Shell 的公共入口接受四个一级页面及嵌套对象视图；四入口固定，Resume 在 Opportunity 下。路由清单仅做机械聚合。根 app、preload、utility、writer、build、package、迁移批次由集成 owner 编辑。

## 并行文件边界

W：wiki 的合同/后端/前端及就近测试，Materials 仍独立；E：employment（含 Person）；P：project；O：opportunity（含 Company）；R：resume 与独立 profile owner；U：frontend shell / design-system。每条线独立 branch/worktree/commit。根依赖、lock、bootstrap、生成脚本、Forge 和本导航文档由集成 owner 串行管理。

每条线在自己 worktree 运行 typecheck、unit / 真 SQLite integration、build 和边界检查。需要根依赖向集成 owner 提出；不在工作线安装。测试使用独立临时数据库和 userData，测试夹具不进入正式资料。integration owner 为每条线执行 code-review 的 Standards 与 Spec 双轴独立 Agent 评审，再串行合入并完成真实桌面、包与 G0/G1 回归。

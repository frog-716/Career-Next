# G3 人工强子模块集成

本轮授权 Research / Interview / Offer；Frozen 正本只读，不进入 G4，不启动 AI 或外部接入。三张子 Issue 是完整纵向切片，均依赖已 PASS 的 G2 Opportunity core，不互相阻塞。

## 接口与事务

三条线各自维护 `contracts/opportunity/<module>/schema.ts`、`manifest.ts`、`backend/domains/opportunity/<module>/public.ts`、`migration.ts` 和 `frontend/features/opportunity/<module>/index.tsx`。合同导出 Request / Result 和对应类型，manifest 导出 researchManifest / interviewManifest / offerManifest，module 分别为 research / interview / offer。backend 导出 createResearchDomain / createInterviewDomain / createOfferDomain(db, dependencies)，返回 handle(input: unknown)。所有正式写入同一 writer、同一 SQLite 连接，使用模块自己的 executeCommand owner 与 receipt。

dependencies.core 使用 `contracts/opportunity/capabilities.ts` 的 OpportunityCapabilities；Research 只读公司/机会，不修改阶段。Interview 确认真实轮次调用 recordStage；Offer 实际收到调用 recordStage，接受/正式替换/撤回/纠错调用 recordOfferEvent。组合调用必须包在同一个短事务，失败整体回滚；不能把 failure DTO 当提交成功。子模块不执行 core SQL，不直接 import core 或兄弟实现。公开能力只能在 backend 装配中注入，不暴露为通用 renderer 写状态入口。

recordStage 返回 core eventId，供历史辨认；expectedRevision 校验同一正式机会基线。recordOfferEvent 保持 core 唯一结果 owner：accepted 绑定 basisId；conditions_replaced 仅把 accepted 改为 active；历史晚录保留后来的当前结果；acceptance_corrected 指定 correctedEventId，不能抹掉后来真实变化。core 由 integration owner 实现和测试。

Research dependencies 还可注入 Materials 的只读来源解析；公司提升在 Research 自身事务中保留稳定 item 身份与机会引用，不提升私有来源读取权限。Research 返回公开只读条目解析，Wiki 仅存引用，由 integration owner 接入其查询/导航，不复制研究正文。Offer 原件使用已有受保护 Raw SourceRef；没有原件、历史丢失与此次保存失败分开。

三条公开页面接收 opportunityId、workspaceInstance、request，以及可选 onChanged 回调；Research 另需 companyId。前端 app composition 注入子模块视图；不由兄弟 feature 互相 import。保存后只提示重读，不能发前端状态裁决。保护 dirty / pending、冲突比较、保存成功但回读失败、A/B 迟到响应；未知业务时间不补今天或午夜。

## 文件边界与验收接缝

各线仅写自己的三个模块目录，以及独立的 tests/<module>-*.test.ts 和 tests/integration/<module>.test.ts。根依赖/lock、generator、bootstrap、core public capability、正式迁移批次、app composition、Wiki 引用由 integration owner 串行维护。每条线独立 branch/worktree、临时 SQLite 和测试资料。

用户已指定测试接缝：Contract → owner public → 真实 SQLite → Frontend；公开跨 owner 事务；正常 arm64 App。每条线逐个行为执行 RED → GREEN，保留实际失败证据。RV-MODULE 同时检查 imports 与真实运行行为：不能私有互访/跨表写，伪造操作不能越权；注入失败时子模块与 core 同时回滚。核心规则通过真实 core 公开能力最终复测，不能以 mock 宣称集成通过。

integration owner 串行新增版本 3 migration release，G1/G2 已发布 SQL/批次不改；完成空库、G2 升级、失败/不兼容检查，再双轴独立 review 和 G0/G1/G2 回归、G3 正常 arm64 旅程。Developer ID / Notarization / x64 继续 READY。

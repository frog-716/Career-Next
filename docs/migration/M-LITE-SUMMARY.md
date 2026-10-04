# M-Lite：当前有价值资料迁入

用户于 2026-10-04 明确授权以当前资料轻量迁移取代重型 M2/M3 历史迁移。Issue [#35](https://github.com/frog-716/Career-Next/issues/35)。来源仅 Primary 当前主库；按 M05-01 / M05-02 / M05-04 已确认的稳定身份读取，不读取旧实现、配置正文、Secret、Secondary 或备份正文。

## 范围与结果

| 项目 | 正式工作区数量 / 状态 |
| --- | --- |
| Profile | 1，Primary 当前值；姓名、联系方式和 links 归 Profile |
| Company | 2，独立身份，不按名称合并 |
| Opportunity | 3，公司与岗位关系正确；保留当前 JD，缺失保持缺失；未知日期保持 unknown |
| 当前 ResumeDocument | 2，分别归属正确机会；正文、顺序、支持的格式及对齐保持 |
| Research / Legacy Proposal / 当前 Proposal | 0 |
| AI Task / Operation 迁入 | 0 |
| ResumeUse / 旧共享关系 / ResumeVersion / 历史 PDF | 0 |
| Submission / Communication / Interview / Offer / Feedback | 0 |
| Raw / Wiki / 退役对象 | 0 |
| TEST / UNKNOWN / backup-only | 0 |
| fake event / duplicate / Apply replay | 0 |

旧 resume/active 在当前合法语义下为 preparation/active，未创建投递、面试、Offer 或状态事件。当前新 Opportunity 合同无独立招聘 URL 字段，该旧字段未映射；不改写 JD 或猜造其他字段。不恢复旧身份缓存，Resume managed identity 从当前 Primary Profile 显示。

## 校验与启用

- 显式路径、只读 current 查询；仅8个批准身份解码正文。固定源 digest / schema / 分类 / 映射 / target identity。所有正文只在源库、隔离 staging 及本地正式业务库中，操作元数据与日志无私人正文。
- 通过正式 owner 的私有 staging 能力，8个快照与迁移回执同事务提交。同一计划第二次执行一致，无重复。没有 Legacy archive 或执行能力恢复。
- 当前 Resume A 原 identity center 保留；Resume B 原空正文保持空，不补造经历。源当前可见字段逐项核对、Career 文档/Tiptap 往返及保存后原文稿 hash 均一致。测试编辑及撤销完成后恢复到迁入的完整基线文档。
- staging 的 arm64 打包版及正式启用后的正常 arm64 打包版均通过自动真实桌面检查：Profile、3机会/2公司关系、2简历、可见正文/中文/对齐、编辑保存、关闭重开。**本轮真人操作未执行；未以自动化冒充真人或新增 IME 人工验收。**
- 先创建完整本地 rollback 副本，验证原默认工作区确为空白初始库，再持 active/staging 写锁切换。锁内拒绝非空 WAL，复核已验收数据库 hash、workspace identity、迁移回执、数量及排除历史，active pointer 原子替换。新正式工作区只有一个 writer；原工作区与 rollback 均保留。
- 正式资料回读：核心数量1/2/3/2，排除表均0，数据库 integrity=ok；两份 Resume 完整文档 hash 等于迁入基线。源文件 SHA256 未变；rollback 数据库 hash 校验通过。旧 Career 与旧备份无修改、无删除。
- 实际 AI/Search/Feishu 请求=0；未迁旧凭据或授权；无真实正文/联系方式/文件/Key 提交到 Git、Issue 或验证文档。Frozen Product Spec12/12、Architecture8/8 SHA256 不变。

## 回归与审查

typecheck、build、arm64 package 通过；unit172/172；最终串行 integration85文件、447/447；当前源/格式/启用 guard 专项6/6。末轮并行回归曾有2项超时，6条相关测试单独重跑全部通过，最终串行全套通过；未修改测试阈值。Standards / Spec 最终审查无未解决项，已修复候选切换时机、WAL、富文本核对及测试分类边界；Architecture / migration safety / privacy 保持 owner 与数据边界。

只提交通用 current-only adapter、启用保护、synthetic 测试、本文和 MAP 导航；不提交 runtime DB、staging、正文、PDF 或备份。M-Lite 已启用；不继续重型 M2/M3。

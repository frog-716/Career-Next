# G4 集成约定

基线：`e42c922a2b10fdbda8ed73870c95e176ca7e9957`。这是工程分工与接口约定，不是产品或架构的第二正本。按 Frozen DELIVERY G4 / MODULES / DATA / AI-RUNTIME 及对应 Requirement / Acceptance 实施。

## Owner 与工作线

- S：Opportunity Submission / Communication 的合同、后端 public、界面与真实 SQLite 测试；首次投递唯一，后续发送独立；所有实际文件独立 retention，不重生历史 PDF。
- X：已有 Profile / Resume、Project / Employment / Person、Research / Wiki、Interview Transcript 的公开接缝。原件不普通覆盖，可更正来源旧版不可读、当前支持待复核。集成 owner 承担此线。
- A：AI Runtime、Wiki 整理 TaskPolicy、fake Provider adapter 与 AI 功能 UI。仅依赖注入的 source / target / persistence 公共能力；只有人工 Apply 可请求 Wiki 正式写入。
- D：Platform 的受管理副本、持久化 fence、备份/恢复/清除协调与设置 UI。领域清除经实际 owner 的公共能力执行，不由平台直接写外域私有表。
- I：集成 owner 串行处理根依赖、公共协议、bootstrap、装配、迁移版本 4、Desktop 原生边界、跨线接缝与最终回归。

## 公开接口与事务

Opportunity core 的 `recordStage` 增加真实 submitted 事件，并标识 Submission owner；S 只能经公开能力推进阶段。Resume 公开提供冻结版本/导出物候选，保存时验证真实 blob 并独立保留。外部实际发送文件通过原生选择、受控 staging、hold 和发布，不能由 renderer 指定任意路径。

来源 Contract 在 common 中增加可更正 Interview Transcript / Communication 的版本引用；Materials 原件合同保持原含义。源目录仅登记 owner resolver，不复制正文。Wiki / Research 的支持可根据公开当前版本重算待复核。

AI Apply 在唯一 writer 的同一短事务内校验当前 human、Proposal、目标、实际输入、权限、局部依赖和清除代次；经 Wiki 公共能力写正式内容，并同步 Proposal 与 receipt。provider handoff 和 stop/revoke 在 utility 控制循环处理，同步 SQL 留在 writer。后台恢复只显示持久事实，不恢复已消费执行许可。

D 提供按对象的 persistence fence 和 producer lease：读取前捕获 workspace / backend / 输入 / 目标代次，每次 sink 写入及最终事务复核；清除先 marker、撤销写回并 drain，再删除。所有 producer 使用同一闸门，不能保留直接写 FD。受管理副本在复制前登记；backup 使用 SQLite Backup API，恢复验证隔离候选后原子切唯一 active pointer。

## 实施与验证

用户已指定本轮测试接缝：真实 Contract → owner → SQLite / 文件 → UI / 正常 arm64 包。TDD 逐条覆盖 RV-P0-01、RV-P0-03、RV-P1-03/04/06/07。局部依赖不使用全库 epoch。每工作线独立 branch / 测试目录；仅集成 owner 合入共享装配。

四一级入口不变，辅助设置与进度不升为业务模块。Frozen 12 个产品文件和 8 个架构文件只读；旧 Career 不读取。真实 Provider / Search / Feishu 为 NOT TESTED；Developer ID / Notarization / x64 保持 READY。G4 完成后停在 G5 之前。

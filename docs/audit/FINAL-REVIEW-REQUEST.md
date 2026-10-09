# 独立网页审计交接

状态：PREPARED / NOT REVIEWED。此文件不是 Codex 自评通过证明。请在全新的网页 GPT-6 Pro thread 审查；不提供此前聊天作为先验答案。

## 固定输入

- Career-Next：以交接包中明确标注的最终 commit 为准，不以浮动 main 为准。提交完成后生成的本地 `out/audit/FINAL-GPT6-PRO-REQUEST.md` 包含精确 GitHub 链接。
- 旧 Career：`https://github.com/frog-716/Career/tree/0f8eb154798ef5220f0c5f13d00894e1c1c8a041`。仅作为独立差异取证；不能替代新产品规格，不能把旧实现重新导入新仓库。准备此包时 Codex 只查询了旧仓库 HEAD 元数据，未读取旧实现。
- 产品规则：`docs/product-spec/rebuild-spec/{PRODUCT,DOMAIN,UX,AI,JOURNEYS,ACCEPTANCE,MIGRATION}.md`，Frozen R3；整个冻结目录 12 个跟踪文件逐项 SHA 校验。
- 架构：`docs/architecture/` 的 8 个冻结文件，以及已批准 `docs/adr/004-BROWSER-FIRST-LOCAL-ENTRY.md`、`005-ELECTRON-RETIREMENT-E1.md`。修订只替代宿主，不重新划分业务 owner。
- 使用入口：README、MAP、`docs/ux/USER-GUIDE.md`。
- 本轮证据：`docs/verification/continuous-delivery.md`。当前环境、模拟与真实边界、未完成门必须与实现一起审查。

## 请独立走查

首次启动 → 四入口 → Wiki 添加本地/飞书资料 → 预览/取消/明确保存 → Raw 回读及来源 → 人工整理 Wiki → 项目 → 任职与人物/项目关系 → 机会 → 简历身份/正文/格式/对齐 → 保存/历史/PDF → 沟通/面试/Offer → AI 的本地读取、最终外发、采纳各自授权 → 设置/帮助/反馈 → 备份/恢复 → 重启继续使用。

特别检查：刷新、返回、未保存草稿、中文输入、600px、两标签冲突、唯一 writer、失联、撤销、保存结果未知、备份缺失及来源变更。模拟外部验收不能被写成真实外部 PASS。

## 审查目标与回执

请找出：遗漏的真实用户价值、冻结规则冲突、名义存在但实际不可用的功能、主链断点，以及安全/隐私/恢复缺口。每项给 severity、固定 commit 的文件/行、可复现路径、用户影响与最小修正建议。区分明确缺陷和需要产品裁决的建议。

禁止把 AI 提案或用户采纳当独立事实核验；不得为了审查调用真实飞书/模型/搜索，读取真实用户数据库、Secret 或备份。需要新的真实访问时另行明确范围与授权。

最终给出独立结论及剩余阻断项。Codex 只负责交接材料，不能代替此独立审查。

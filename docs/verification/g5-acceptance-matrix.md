# G5｜104 分支验收矩阵

初始登记基线：`66ede4cd2f51787b5375caa8489512972edb28d0`，与已推送 G4 checkpoint 相同且工作树干净。本表建立于 G5 产品开发之前。

G5 当前为 PARTIAL。PASS_ALREADY 引用该精确基线的既有验证记录，后续修改后的回归必须复核；PASS_G5 只在本轮实际执行通过后填写。真人 Desktop Gate 尚未执行；不得以旧 IME 证据替代本轮完整人工验收。真实 Provider/Search/Feishu 均 NOT TESTED。

一个原始 AC 一行、一个分类。混合分支按未完成的整体要求分类，在原因中说明已执行的普通子分支；普通产品能力仍须实现，不能因最终故障收口属于 G6 而跳过 G5 旅程。冻结 ACCEPTANCE 状态不修改。

| Acceptance ID | Journey | 当前分类 | 证据位置 | 未执行原因 / 正确 Gate |
| --- | --- | --- | --- | --- |
| AC-PR-01-01 | J-01～J-09 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-PR-02-01 | J-01～J-09 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-PR-03-01 | J-01～J-09 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | Shell 尚无持久置顶首页；G5 补齐。 |
| AC-PR-04-01 | J-01～J-09 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-PR-05-01 | J-01～J-09 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-PR-06-01 | J-01～J-09 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-01-01 | J-01/J-04 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-01-02 | J-01/J-04 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-02-01 | J-01/J-03 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | 公司/岗位创建已有证据；尚无 JD 后补及缺项提示，G5 补齐完整分支。 |
| AC-DM-02-02 | J-01/J-03 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | 公司/岗位创建已有证据；尚无 JD 后补及缺项提示，G5 补齐完整分支。 |
| AC-DM-03-01 | J-03/J-04/J-06 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-04-01 | J-03/J-06 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-04-02 | J-03/J-06 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-05-01 | J-03 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-06-01 | J-03/J-06 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-07-01 | J-02/J-03 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-08-01 | J-07 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-08-02 | J-07 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-09-01 | J-07 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-10-01 | J-07 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-10-02 | J-07 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-11-01 | J-02/J-07 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-12-01 | J-02/J-05/J-06 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-13-01 | J-02/J-05 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-14-01 | J-02 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-15-01 | J-02 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-16-01 | J-02 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-17-01 | J-02 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-18-01 | J-02 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-19-01 | J-02 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-20-01 | J-02 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-21-01 | J-04 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-22-01 | J-04 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | 导出冻结已有证据；尚无跨机会命名版本内容复制，G5 补齐。 |
| AC-DM-23-01 | J-04 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-23-02 | J-04 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 真实历史文件缺失已有 G4 证据；发布保存失败全切点留 G6，G5 继续真实发送与缺失区分。 |
| AC-DM-24-01 | J-04 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-25-01 | J-03/J-04 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-26-01 | J-05 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-27-01 | J-05 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-28-01 | J-05 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-29-01 | J-05 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-30-01 | J-05 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | Simulation 原文已有；尚无主动选段+现实含义确认的受限回流，G5 补齐。 |
| AC-DM-30-02 | J-05 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | Simulation 原文已有；尚无主动选段+现实含义确认的受限回流，G5 补齐。 |
| AC-DM-31-01 | J-06 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-32-01 | J-06 | CONDITIONAL | DOMAIN DM-32（建议） | 冻结建议未采纳为必需能力，不新增薪酬计算器；将来采纳后执行条件性 G5。 |
| AC-DM-33-01 | J-03/J-05 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-34-01 | J-02 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-35-01 | J-03/J-06 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-36-01 | J-02 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-37-01 | J-05 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-38-01 | J-02/J-08/J-09 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | G4 普通 purge 已测；全部副本/法证与清除故障最终收口 G6，G5 继续普通 J-02/J-09。 |
| AC-DM-38-02 | J-02/J-08/J-09 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-39-01 | J-03/J-06 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-DM-40-01 | J-03/J-05/J-06 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-AI-01-01 | J-02/J-05/J-07 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-AI-02-01 | J-04/J-05/J-06/J-07 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | 目前只有 Wiki 整理；其余冻结任务的 Context/草稿/正式 owner 采用需 G5 补齐。 |
| AC-AI-03-01 | J-02/J-04/J-07 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | Wiki 可读取真实 Raw；Resume 优化尚无渐进依据流程，G5 补齐。 |
| AC-AI-04-01 | J-02 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-AI-05-01 | J-05 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | 真实 Interview/无投递已实现；AI 准备的无投递明确标注尚未实现，G5 补齐。 |
| AC-AI-06-01 | J-05/J-07 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-AI-07-01 | J-02/J-04/J-05/J-06/J-07 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-AI-07-02 | J-02/J-04/J-05/J-06/J-07 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-AI-07-03 | J-02/J-04/J-05/J-06/J-07 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-AI-08-01 | J-07 | EXTERNAL_LIVE_PENDING | 待 G5 controlled adapter 证据；REAL SEARCH NOT TESTED | G5 实现受控 Search 产品链；本轮没有真实 Search 授权，真实本轮来源与服务不能报 PASS。 |
| AC-AI-08-02 | J-07 | EXTERNAL_LIVE_PENDING | 待 G5 controlled adapter 证据；REAL SEARCH NOT TESTED | G5 实现受控 Search 产品链；本轮没有真实 Search 授权，真实本轮来源与服务不能报 PASS。 |
| AC-AI-09-01 | J-07 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | 个人本地导入已有；明确对象范围及受控 Feishu-shaped candidate/body 链尚缺，G5 补齐产品合同，真实飞书未测。 |
| AC-AI-10-01 | J-04/J-05/J-07 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | Wiki 逐条已实现；Research 分组原子处理及 Resume/整份草稿采用尚缺，普通分支 G5，复杂冲突故障 G6。 |
| AC-AI-10-02 | J-04/J-05/J-07 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | Wiki 逐条已实现；Research 分组原子处理及 Resume/整份草稿采用尚缺，普通分支 G5，复杂冲突故障 G6。 |
| AC-AI-10-03 | J-04/J-05/J-07 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | Wiki 逐条已实现；Research 分组原子处理及 Resume/整份草稿采用尚缺，普通分支 G5，复杂冲突故障 G6。 |
| AC-AI-11-01 | J-02/J-04/J-07 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-AI-12-01 | J-02/J-07 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-AI-13-01 | J-09 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-AI-14-01 | J-01/J-09 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-AI-14-02 | J-01/J-09 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-AI-15-01 | J-04/J-06 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | Resume/Greeting/Offer 新任务尚缺身份最小外发预览，普通分支 G5；完整泄漏防护收口 G6。 |
| AC-AI-15-02 | J-04/J-06 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | Resume/Greeting/Offer 新任务尚缺身份最小外发预览，普通分支 G5；完整泄漏防护收口 G6。 |
| AC-AI-16-01 | J-02/J-05/J-07 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-AI-17-01 | J-02/J-07 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-AI-18-01 | J-02/J-09 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-UX-01-01 | J-01 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-UX-02-01 | J-01 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | 尚无唯一持久置顶首页，G5 补齐。 |
| AC-UX-03-01 | J-04 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-UX-04-01 | J-02/J-04/J-08 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-UX-05-01 | J-01/J-04 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-UX-06-01 | J-04 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | Profile 同步已有；Resume AI 修改独立 undo 尚缺，G5 补齐。 |
| AC-UX-06-02 | J-04 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | Profile 同步已有；Resume AI 修改独立 undo 尚缺，G5 补齐。 |
| AC-UX-07-01 | J-04 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-UX-08-01 | J-04 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-UX-09-01 | J-02/J-07 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-UX-10-01 | J-02/J-07 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-UX-11-01 | J-08 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | 尚无 Feedback owner、overlay 和同 receipt 恢复，G5 补齐。 |
| AC-UX-12-01 | J-09 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-UX-13-01 | J-01 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-UX-14-01 | J-01～J-09 | MISSING_IMPLEMENTATION | 当前代码盘点（尚无本分支完整通过证据） | 中文已有 G0/G2 人工证据；缩放/完整弹窗焦点/窄窗口新整合仍需 G5 实现及真人门。 |
| AC-UX-15-01 | J-01～J-09 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-UX-16-01 | J-03/J-05/J-06 | PASS_ALREADY | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 精确 G4 基线未发生代码变化；可复用既有真实 owner / 桌面测试。G5 最终回归后复核。 |
| AC-MG-01-01 | J-09 | DEFER_M | DELIVERY §11 / 用户 G5 迁移边界 | 正式旧 Career 迁移未经授权；MG-07 普通 Restore 子链 G5 独立验收，不代表迁移通过。 |
| AC-MG-02-01 | J-09 | DEFER_M | DELIVERY §11 / 用户 G5 迁移边界 | 正式旧 Career 迁移未经授权；MG-07 普通 Restore 子链 G5 独立验收，不代表迁移通过。 |
| AC-MG-03-01 | J-09 | DEFER_M | DELIVERY §11 / 用户 G5 迁移边界 | 正式旧 Career 迁移未经授权；MG-07 普通 Restore 子链 G5 独立验收，不代表迁移通过。 |
| AC-MG-04-01 | J-09 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-MG-04-02 | J-09 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-MG-05-01 | J-09 | DEFER_G6 | [G4](g4-cross-domain.md)、[G3](g3-manual-submodules.md)、[G2](g2-first-batch.md) | 既有局部证据可复用；完整安全/故障/恢复边缘分支按 DELIVERY §11 留 G6。G5 仍验证普通路径。 |
| AC-MG-06-01 | J-09 | DEFER_M | DELIVERY §11 / 用户 G5 迁移边界 | 正式旧 Career 迁移未经授权；MG-07 普通 Restore 子链 G5 独立验收，不代表迁移通过。 |
| AC-MG-07-01 | J-09 | DEFER_M | DELIVERY §11 / 用户 G5 迁移边界 | 正式旧 Career 迁移未经授权；MG-07 普通 Restore 子链 G5 独立验收，不代表迁移通过。 |

## 初始统计

PASS_ALREADY=59, PASS_G5=0, MISSING_IMPLEMENTATION=20, DEFER_G6=17, DEFER_M=5, EXTERNAL_LIVE_PENDING=2, CONDITIONAL=1；合计 104。

## 后续证据规则

新产品合同需真实 owner + SQLite 的集成证据及正常 arm64 packaged 连续旅程。自动化通过后暂停真人 Desktop Gate；此时 Issue 保持打开、不创建最终 checkpoint。

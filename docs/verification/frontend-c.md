# ⑩-C Remaining Product UX / Full Baseline Closeout

状态：⑩ PASS。FRONTEND FUNCTIONALITY = COMPLETE BASELINE；UX BASELINE = IMPLEMENTED。2026-10-05。Issue [#38](https://github.com/frog-716/Career-Next/issues/38)；基线 `4c9b8b248a6e799e529af339eff34767ad047c90`。

本轮完成已审批UX baseline最后切片，不新增产品能力，不进入⑪，不使用Gemini或高级Motion。四入口、Resume归属机会、领域owner、外发授权及冻结正本保留。详细用户操作入口以 [USER-GUIDE](../ux/USER-GUIDE.md) 为准。

## 实施

- Wiki先列表/筛选/阅读；新建和编辑明确打开，原始材料导入与情报引用按需打开。收起草稿有继续入口，原件选择→预览→确认保存保持，取消不创建，保存后可查看或手工用于知识，不能自动生成Wiki。
- 项目先列表→详情→编辑，个人项目不需任职。状态/关联/参与关系降到更多，历史和纠错保留。任职按概览/人物/项目分区；人物先读再编辑，既有同名身份不合并，公开Project查询提供任职/人物相关项目和定位。
- AI从业务任务进入。正常真实DeepSeek目前仅支持Research整理，其他不支持任务没有可执行按钮。预览显示真实接收方、模型、完整指令与正文、预算和授权；摘要从冻结manifest计算。建议显示内容/理由/来源/未知项，ID/JSON折叠，采纳仍不等于独立核验。两种Research owner缓存各自AI会话；Apply刷新正式列表而不覆盖草稿。
- 结果未知先检查，确认尚未记录后才继续同一次操作；不自动重发、重建对象或扣费。Resume正文、Profile、命名版本/导出和恢复同样保持这个边界。
- 设置五组：基础资料、AI/Search连接、备份恢复、导航、高级维护。基础资料保存全量网页、支持冲突/回执并同步当前简历；晚到读取/写回不能覆盖新输入或复活清除内容。Secret仍专用write-only接口，本机检查不联网，不把本地演示凭据显示为真实DeepSeek连接。
- 普通备份显示时间/状态/用途，路径与copy/state在技术详情；永久清除在高级维护。旧AI建议只读历史与当前建议分开。显式 `--career-development-diagnostics` 且独立 `--user-data-dir` 才展示验收控件；这个标记只决定界面，不增加协议权限或外发授权。
- Resume命名/PDF保持直接入口，其余工具折叠。现有marks、alignment、autosave、IME、AI独立Undo/Redo、深链接及会话缓存不换正本。辅助面板不卸载原任务。

## TDD与回归

公开UI行为先红后绿：阅读优先/显式编辑/草稿、支持的AI入口、Profile晚到刷新、Resume同一保存结果未知、Research Apply后刷新、切owner保留未决AI、任职生命周期折叠和真实Provider身份。先前测试只适配显式入口/人话定位，不移除领域和安全断言。初期失败包含旧按钮定位和无效fixture，只有有效公开行为复现才计作红灯证据。最后桌面检查补充了已完成AI请求授权文案的真实红灯，再修正为“再次发送需重新预览和授权”；600px表单标签改为单列。

| 检查 | 结果 |
| --- | --- |
| typecheck / build | PASS；原有非阻断构建提示保留 |
| 全部 unit / UI | 64文件 / 188测试 PASS |
| 全部 integration | 85文件 / 447测试 PASS |
| packaged arm64 | 7文件 / 11测试 PASS（最终包） |
| Computer Use | PASS；正常包完整旅程 + 1280/600px核心路径 + 显式诊断本地fake AI |
| 最后局部UI回归 | 7文件 / 19测试 PASS（含AI/Secret/unknown） |

覆盖G5旅程、机会子模块、Wiki/项目/任职/人物、Resume rich version/PDF/alignment/AI独立Undo、AI runtime/UI/auth/unknown、Secret安全与等待、backup/restore/purge、跨窗口、深链接和会话连续性。回归全为mock/fixture/TEST DATA；真实中文IME沿用此前真人PASS并跑自动composition回归，本轮不声称重新完成真人输入法验收。

本机详细日志、运行库、测试材料和包都在ignored `out/verification/frontend-c/`、`out/frontend-c-package/`，不提交。

## Computer Use 桌面证据

通过原生Computer Use操作正常arm64包的隔离TEST workspace：欢迎区→四步教程→Wiki→机会列表/六分区详情→Resume→情报→沟通→面试→Offer→项目→任职/人物/项目→设置→帮助→反馈。观察应用用途、四个名称、求职起点、简历归属、项目与任职区别、主操作、帮助和设置入口。600px下四名称常显，主动作和表单可用、没有横向溢出；1280px常规窗口同样通过。

- Wiki草稿经帮助往返、Project草稿经帮助往返、Employment草稿经帮助往返保留；Resume正文经设置往返仍在并已自动保存。Feedback返回/重新打开保留草稿，辅助面板不替换业务编辑会话。
- 人物保持在任职内，概览/人物/项目分区可达。个人项目无需任职；TEST任职空项目关系有明确管理入口，正式关联查询另由自动打包测试验证。
- 正常设置仅五类；基础资料和Secret状态可理解，没有固定J-07/fake/fixture验收控制台。只读观察未配置连接；不输入真实Key、不访问系统授权。TEST备份创建、恢复候选校验、取消恢复通过，真实恢复切换由打包回归验证。
- 单独启动显式开发诊断隔离TEST profile，原生操作Research任务入口→完整本地fake预览→授权→两条建议→接受一条/拒绝另一条。正式Research列表即时出现一条推断，仍未独立核验。此流程不验证真实模型质量，不发送网络请求。
- 原生截图在Computer Use工具记录中检查；结构化本机证据在ignored `out/verification/frontend-c/computer-use.json`。测试写入不涉及迁入REAL资料。

## Standards

独立Standards reviewer最后复查PASS，无剩余实质问题。4个问题已修：冻结预览摘要不读后改的选择、Profile异步刷新防覆盖、Resume Profile恢复入口、Research owner切换保留AI会话。人物相关项目改为首次打开才查询。跨模块仅公开UI/Contract装配，未穿透私有owner或引入竞争正本、通用凭据访问、授权旁路。

## Spec

独立Spec reviewer最后静态复查PASS。7个问题已修：Wiki继续草稿、冻结预览摘要、版本/PDF直接入口、Profile恢复入口、Research owner会话、结束任职折叠、真实Provider身份。无新增业务能力或产品规则变化。

## Architecture / 隐私

Architecture review PASS。只调整前端分层与公开装配，CareerDocument/业务owner/正式AI authorization与Proposal路径保留。Main只传递显式诊断显示标记，Renderer不得回读Key；没有真实外部请求。

Product Spec 12/12、Architecture 8/8 SHA与起点相同。真实迁入资料库69张表的行数/内容hash与起点相同，REAL DATA CHANGED = NO；没有旧Career读取。所有写入仅隔离TEST DATA，Git无Key、数据库、PDF或运行缓存。验证只保存数量/哈希，不复制真实正文。

## 完成边界

全部通过后固化：FRONTEND FUNCTIONALITY = COMPLETE BASELINE；UX BASELINE = IMPLEMENTED。这表示冻结范围内既有能力具备可找到、可理解、可使用的入口，不表示最终视觉或更多真实Provider能力已完成。⑪仍未开始。

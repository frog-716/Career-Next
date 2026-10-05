# ⑩-A Shell / Home / Onboarding / Help 验收

状态：PASS。2026-10-05。Issue [#36](https://github.com/frog-716/Career-Next/issues/36)，审批基线 `fc075abf5a7cf6e69ccd0bfe10649b050f234b0f`。

仅实施已审批 [UX baseline](../ux/UX-BASELINE.md) 的第一切片；[用户指南](../ux/USER-GUIDE.md)通过构建时 Markdown 导入成为产品内帮助内容来源。没有新业务能力、Home domain、独立 Resume workspace、机会六分区重构、Gemini 或视觉精修。

## 实施与范围

- 四入口图标与名称常显，包括56px收起栏；当前入口高亮。设置/帮助/反馈在底部独立分组，置顶及排序移入设置，仍使用原 preferences owner。
- 默认/置顶模块显示欢迎区：两个主动作，项目/任职/Wiki为次级动作；简历先选择机会，无机会时明确引导创建。读取失败只刷新，不能冒充空列表。
- 4步教程可前后移动、跳过、完成、重看。首次只在默认首页内联出现；对象深链接直接进入对象。完成及欢迎区折叠记录在本机 UI localStorage，不生成业务资料，不存储外发授权。
- 设置与帮助使用保持挂载的独立辅助面板，关闭恢复原焦点/选区；原反馈草稿规则保留。未提交的密钥输入关闭时清空。恢复业务备份仍按原安全流程切换 workspace、重新建立客户端与编辑会话；不把恢复当作保留未保存输入。
- 全局导航、凭据、备份/恢复、反馈状态使用普通用户语言；技术错误、路径、内部副本细节按需展开。未保存、恢复覆盖风险、结果未知、凭据状态、费用和外发预览规则保持可见。AI高级辅助的详细页面及业务页旧文案仍属后续切片，未声称全部清理。

## TDD 与自动验证

首次新增 Shell 名称/辅助区断言以及桌面帮助流程先失败，再实现通过。辅助面板关闭仍保留未提交密钥输入的失败也先记录、后修复。日志仅留本地 ignored `out/verification/frontend-a/`。

| 检查 | 结果 |
| --- | --- |
| typecheck / build | PASS；build仅已有动态导入/指令类非阻断提示 |
| unit | 58文件 / 173测试 PASS |
| integration | 85文件 / 447测试 PASS；正式 owner/事务/授权/恢复边界回归 |
| focused Shell/维护/反馈/凭据 UI | 5文件 / 10测试 PASS |
| packaged arm64 | 4文件 / 5测试 PASS |

打包回归命令：

```sh
CAREER_PACKAGED=1 CAREER_PACKAGED_EXECUTABLE="$PWD/out/frontend-a-package/CareerNext-darwin-arm64/CareerNext.app/Contents/MacOS/CareerNext" npx vitest run tests/desktop/frontend-a.electron.test.ts tests/desktop/resume-alignment.electron.test.ts tests/desktop/g5-resume-undo.electron.test.ts tests/desktop/g5-resume-version-format.electron.test.ts --maxWorkers=1
```

`frontend-a.electron.test.ts`覆盖首次引导/完成/跳过/重看、不生成业务对象、帮助指南、600×820及1280×850窗口、当前高亮、底部反馈、导航偏好、简历选择、编辑选区、辅助面板关闭、反馈草稿、Undo/Redo、保存重开、深链接不被教程遮挡、正式设置备份→确认恢复→重新打开已保存测试简历。

其余3文件覆盖正文/identity对齐、bold/italic、历史预览、命名版本冻结、真实PDF文本与坐标、AI修改保留布局、独立Undo/Redo、accepted不回到pending。composition事件仅证明自动保存闸门，不能代替真人输入法。本轮未再次要求真人IME输入；之前alignment/G5真人验收PASS继续作为历史证据，未冒充本轮真人复测。

## Computer Use

使用正常打包 app `out/frontend-a-package/CareerNext-darwin-arm64/CareerNext.app`，通过原 `--user-data-dir`隔离测试，不新增产品测试能力。空测试资料与自动回归生成的TEST DATA工作区均在 ignored `out/verification/frontend-a/`。

真实桌面操作确认：欢迎页文案与主次操作、4步教程完成、问题式帮助展开、设置内导航设置、收起栏四名称/当前高亮/底部辅助入口、反馈测试草稿关闭并重新打开仍在、无机会简历引导回到机会、已有测试机会选择进入所属简历、选区打开/关闭帮助与设置后仍在且正文保持。

Computer Use窗口为850×720逻辑尺寸；600与1280尺寸由同一正式arm64包自动回归精确设置并通过。Computer Use拖拽缩放遭遇工具 `noWindowsAvailable`，未声称人工精确600px；该工具限制不影响自动600px验收。桌面过程中仅编辑本地测试反馈草稿，没有保存真实资料。

## Review 与隐私

两轴并行 code-review 已按Skill发起，但两个Agent均因额度限制未能运行，不能算作独立审查PASS。主Agent分别完成 Standards、Spec、Architecture复核：

- Standards：实现聚合在experience局部模块；Shell装配视图，不读backend/storage，不新增通用框架。未发现剩余阻断项。
- Spec：对应审批范围逐项核对，四入口、机会归属简历、非模态首次引导、辅助会话保持、用户语言、安全可见信息均实现；⑩-B/⑪未启动。
- Architecture：正式owner与contract未改；教程为本机展示状态，导航偏好仍由原owner保存；UI不获得密钥回读能力，不绕过AI授权/Proposal。
- 复核修正：机会读取失败不显示“先创建”；维护结果不确定提供只读“刷新备份状态”。

所有交互测试仅用隔离TEST DATA，不调用真实DeepSeek/Tavily/Feishu，不读取旧Career。正式迁入工作区的Profile/Company/Opportunity/Resume四组表数量/hash与审计前一致（只输出比较结果，不输出正文）。Frozen Product Spec 12/12、Architecture 8/8 SHA与冻结基线相同。Git仅前端、测试、审批/导航/验证文档；无runtime DB、测试userData、用户正文、真实凭据或build输出。

本轮完成后停止；⑩-B仍需独立授权。

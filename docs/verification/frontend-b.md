# ⑩-B 机会列表 / 详情 / 六分区验收

状态：PASS。2026-10-05。Issue [#37](https://github.com/frog-716/Career-Next/issues/37)，代码基线 `e08173b14e3d84536bfd01897005d68dfdfecc30`。

本轮仅实施已审批 [UX baseline](../ux/UX-BASELINE.md) 的机会切片。四个一级业务入口不变，Resume 仍属于具体机会；不新增业务能力，不修改领域 owner、契约或 Frozen 正本，不进入⑩-C或Gemini。

## 实施范围

- 机会默认是搜索、结果筛选、新建入口与卡片列表。卡片展示公司、岗位、阶段和结果；维护与子模块表单不在列表首屏。
- 新建是公司+岗位的独立流程。已有公司与新公司明确选择；Company 和 Opportunity 分别调用正式 owner。公司已保存但机会失败时保留公司与输入，先检查已保存结果，避免重复建公司；同名公司通过可读关联岗位区分。
- 详情头部固定业务身份与真实阶段/结果，分区为概览、简历、情报、沟通、面试、Offer，只有当前分区可见。概览提供JD、日期、当前简历与最近记录入口；公司/岗位维护、改名、历史、结束和纠错放在“更多”。危险动作仍需确认。
- 情报、沟通、面试、Offer先阅读，通过明确主动作打开记录表单。公司情报与岗位情报保持独立正本；来源、promotion和历史按需展开。首次投递与后续沟通/发送材料保持分别记录。面试练习只在对应真实轮次内，明确标为练习；Offer优先呈现现实条件、原件与接受状态。
- 对象/分区链接、Wiki研究引用、本地搜索、简历返回均定位所属机会。已访问的局部会话保持挂载，切换分区及辅助面板保留草稿。Resume编辑器/持久正本不重构；只接入机会头部与所属导航。
- 返回列表、离开机会入口及数据清除时作废旧读取；晚到的成功/失败不能重新打开详情或覆盖新分区。被清除对象的隐藏会话和简历头部缓存同步失效；其他机会草稿保留。
- 普通机会首屏不展示UUID/JSON/内部命令状态；技术详情、历史与恢复功能按需展开。未保存、结果未知、真实状态和安全授权事实仍显示。

## TDD与回归

先新增列表/显式录入/单分区断言，原界面红灯后实现。再补新公司部分成功与响应丢失、同名公司选择、缓存清除、迟到读取成功/失败的回归。测试均通过正式公共owner或隔离TEST DATA，日志仅保存在本机ignored `out/verification/frontend-b/`。

| 检查 | 结果 |
| --- | --- |
| typecheck / build | PASS；构建保留已有非阻断动态导入提示 |
| unit | 59文件 / 176测试 PASS |
| integration | 85文件 / 447测试 PASS |
| 最终定向回归 | 面试状态与迟到读取/缓存清除2测试 PASS；新建与部分成功等另外4项回归PASS |
| packaged arm64最终源代码 | 6文件 / 9测试 PASS |

打包回归使用独立目录，不覆盖正在使用的正式应用：

```sh
CAREER_PACKAGED=1 CAREER_PACKAGED_EXECUTABLE="$PWD/out/frontend-b-package/CareerNext-darwin-arm64/CareerNext.app/Contents/MacOS/CareerNext" npx vitest run tests/desktop/frontend-b.electron.test.ts tests/desktop/frontend-a.electron.test.ts tests/desktop/resume-alignment.electron.test.ts tests/desktop/g5-resume-undo.electron.test.ts tests/desktop/g5-resume-version-format.electron.test.ts tests/desktop/g5.electron.test.ts --maxWorkers=1
```

六文件/九测试覆盖机会新建、列表详情往返、六分区显式录入与草稿、Wiki/搜索对象链接、帮助/设置往返、600与1280逻辑宽度、低频纠错、首次投递、G5旅程、Resume对齐/版本/PDF/AI独立Undo。既有测试只调整新入口与定位器，保留领域与安全断言。

最终桌面检查补充修正面试空列表状态：已读取记录与未保存输入分开提示，先红灯再通过。既有对齐测试在段落左侧空白点选可能落到邻段caret；改为点击实际文字，并增加右对齐段落/居中列表项的当前与冻结snapshot断言，未放宽PDF坐标检验。

自动composition事件回归仅证明保存闸门；本轮未再次要求真人中文IME输入。之前alignment/G5真人IME PASS保留为历史证据，不冒充本轮真人复测。

## Computer Use

使用正常arm64包 `out/frontend-b-package/CareerNext-darwin-arm64/CareerNext.app`，独立 `--user-data-dir`指向 ignored `out/verification/frontend-b/COMPUTER-USE-TEST-DATA`。资料只复制自本轮合成测试工作区，不复制安全存储、正式资料或旧Career。

Computer Use实际操作确认：进入机会默认列表→选择已有测试机会→概览/简历/情报/沟通/面试/Offer逐个进入→返回列表→重新打开→简历→返回同一机会→打开/关闭帮助。另输入未保存TEST情报草稿，帮助/设置往返及跨分区切换后正文与原分区保留，确认取消后回到阅读列表。面试空列表显示“面试记录已读取”，填写TEST输入后显示未保存，明确取消不创建轮次。“更多”内公司维护/历史入口可达，未执行现实状态变更。

1280×850和600×820逻辑尺寸由测试启动器只设置窗口几何，导航/输入/确认/滚动全部通过Computer Use完成。600px实见单列列表与详情、六个次级入口/高亮及四个一级中文名称，主动作可点击，长内容可滚动。工具记录保留TEST窗口截图；Git不保存用户截图或runtime资料。

首次检查的调试观察连接曾自动取消浏览器confirm，不能作为取消行为证据。启动器随后关闭这项自动处理，保留原生确认给Computer Use，再次确认研究与面试TEST草稿取消通过。正式应用逻辑不因此增加测试分支。

## Standards

独立审查PASS，无剩余阻断。补齐名称草稿保留、同名公司可读选择、隐藏会话清除、简历头部失效、旧读取成功/失败隔离。最后返回列表及离开机会入口会取消旧读取的显示资格；不是取消已提交正式写入或重试命令。

## Spec

独立审查通过；只实施⑩-B，六分区、所属简历、阅读优先、首次投递与后续发送分离、真实轮次与练习分离、公司维护次级、对象链接与会话连续性均按审批范围实现。

## Architecture与隐私

Shell与app只装配前端公共入口，正式owner/事务/Proposal/外发授权不变；不引入通用缓存框架、一级Resume或新的业务domain。子模块仍走原公共契约，Tiptap不成为正本，清除通知会使局部展示缓存失效。

本轮不读取旧Career、不调用真实DeepSeek/Tavily/Feishu。正式工作区Profile/Company/Opportunity/Resume表数量与hash在测试前与只读审计基线一致；Computer Use结束后再次核对仍一致。Frozen Product Spec 12/12、Architecture 8/8 SHA保持不变。Git只提交前端、回归和导航/验证文档；不提交测试数据库、userData、缓存、输出或真实职业正文。

结算：Standards 0剩余发现，Spec 0剩余发现；本轮完成后停止。⑩-C与Gemini未开始。

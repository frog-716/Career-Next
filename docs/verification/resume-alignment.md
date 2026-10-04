# Resume alignment capability｜Issue #32

状态：PASS。实现、自动回归、真人 macOS 输入法与 packaged arm64 Computer Use 桌面验收完成。不是 Migration M；未读取旧 Career 私人正文，未执行迁移或编写迁移脚本。

任务：[Resume: preserve paragraph and identity alignment end-to-end](https://github.com/frog-716/Career-Next/issues/32)。审查基线：`8394f8e23cf86613d34f8800edb9a8bcdd722cdb`。

## 正式语义与兼容

- Career-owned `schemaVersion=1` 增加可选 `alignment: left | center | right`（正文 paragraph、列表项内 paragraph）和 `layout.identityNameAlignment`。列表项目符号的既有缩进不变，对齐每项文字；姓名对齐属于当前文稿布局，姓名值仍由 Profile 单一 owner 管理。
- 缺字段沿用既有左对齐；解析时不补字段，不改变旧 JSON 顺序/内容或旧 snapshot hash。`career-print-1` 历史继续可读，新冻结材料记录 `career-print-2`，原 PDF 不覆盖。
- Tiptap 是编辑适配器，文稿正文/布局持久化为 Career JSON。受管理姓名布局编码为编辑会话 doc 属性，使手工布局操作进入既有 ProseMirror Undo/Redo，不产生第二份身份正本。
- 正式 AI Proposal 没有布局修改授权。rewrite 保持目标段落原 alignment（包括原字段缺失）；列表按原 item/paragraph 身份保留；若换节点身份/类型会导致已知非左布局无法保留，明确拒绝，不静默改成左对齐。新增正文沿用 anchor 布局，不采用模型自行指定的布局；不改变非目标布局。Undo AI 不恢复 Proposal pending。
- 前端当前/历史和可信 PDF renderer 均读取 Career 属性，只输出白名单对齐；不接受任意 CSS/HTML。保存、命名版本冻结、恢复、PDF 文件发布仍经原正式 owner/事务和可信打印路径。

## TDD 与证据

1. 文稿合同/adapter：先复现拒绝 alignment/identityNameAlignment 的红灯，再实现可选 enum、无默认字段注入与双向转换；left/center/right、列表、bold/italic 及旧 snapshot 兼容测试通过。
2. 正式 AI Apply：先复现提案 after.right 覆盖当前 center 的红灯，修复成正式 owner 保留原布局；insert 同样先红后绿。
3. PDF renderer：先复现 HTML 未承载正式 alignment 的红灯，再补白名单输出；真实 Electron PDF 不依赖屏幕截图，使用 PDF.js 提取可选择中文和文本坐标。
4. 审查发现跨窗口身份布局回读风险：移除修复时回归明确复现 AI Undo 后 right 变 left；修复后 AI Apply/Undo/后续输入保持已正式保存的远端 right。

| 验证 | 自动结果 | 证据入口 |
| --- | --- | --- |
| 合同、adapter、旧 snapshot 内容/hash兼容 | PASS | `tests/resume-alignment.test.ts`、`tests/integration/resume-alignment.test.ts` |
| 保存重开、命名版本及历史冻结 | PASS | `tests/desktop/resume-alignment.electron.test.ts` |
| paragraph/list/identity 对齐、marks共存 | PASS | 同上及合同测试 |
| AI正式Apply保持对齐/不得隐式改布局 | PASS | `tests/integration/resume-alignment.test.ts`、`tests/integration/g5-product-resume.test.ts` |
| 手工/AI独立Undo/Redo、accepted保持 | PASS | `tests/desktop/resume-alignment.electron.test.ts` |
| 远端姓名布局、AI回读/Undo及再保存 | PASS | `tests/resume-alignment-remote-ui.test.ts` |
| 中文 composition 保存闸门 | PASS（synthetic） | 同上桌面测试及现有Resume session回归；不冒充真实输入法 |
| packaged arm64真实PDF | PASS | 同上；本地ignored `out/verification/resume-alignment/results.json` / `test.pdf` |
| 真人macOS简体拼音/候选/连续输入 | PASS（用户确认） | 用户本人输入 TEST DATA，明确回复“中文输入 PASS”；同时确认选区⌘B加粗/撤回测试PASS |
| center保存/重开、版本/PDF视觉、fake Apply/Undo/Redo | PASS（Computer Use） | 真实native UI操作/截图观察；PDF由真实打印路径生成后视觉检查，不冒充所有步骤均由用户亲手操作 |

全量 unit/UI：56文件/167测试 PASS。完整相关Resume回归13文件/33测试 PASS；字体最终修复后打印/版本相关回归7文件/20测试 PASS。最终arm64打包后alignment + G5 ResumeVersion格式 + G5 AI Apply/Undo，3文件/4测试 PASS。typecheck/build PASS。实际构建沿用已有非阻断 bundler warnings。

2026-10-04真实桌面验收：用户完成系统简体拼音输入及⌘B测试；随后Computer Use设置正文/姓名center，验证姓名对齐Undo/Redo、页面关闭重开仍center、命名版本冻结、当前改left而历史保持center、取消历史查看。只调用`local://career-wiki-fake`，接受单个rewrite；Apply后文字改变但center/bold保留，Undo原文和center/bold保留，Redo恢复AI文字和center/bold。Proposal在Undo/Redo后仍accepted。最后完全退出应用，使用最终arm64包和同一隔离profile重启，通过正式机会入口重开，已保存正文/格式/center均保留。

最终从真实桌面创建 `Alignment HUMAN center FINAL`，冻结PDF为1页、118,537 bytes，SHA256 `ab7266aa0562bb2d888a522dd308788ea04872bac0e022290acc3fd9bd1e4126`。Career snapshot中正文和姓名均center；PDF视觉显示姓名/中文正文居中、选区加粗保留；PDF.js精确提取原始中文，无NFKC转换。PDF与运行库仅存ignored本地TEST DATA目录，不提交。

真实PDF测量（TEST DATA）：A4宽594.96pt；中文center文字左右180.74/414.74pt，中点297.74pt；姓名左右239.74/355.75pt，中点297.74pt；left起点51.00pt；right终点544.50pt。18mm页边距内左/右位置与页面中心误差均小于3pt。中文原始码点精确提取；格式冻结基线回归同时检查bold/italic/list的实际PDF字体。

附加PDF失败/修复：最初真实TEST PDF视觉正常，但PingFang将“齐”复制为部首U+2EEC；Hiragino仍将部分字符变为Kangxi兼容部首。先增加完整中文原码点packaged红灯，再在新print-2优先使用本机既有Arial Unicode MS，保留Latin Arial和本地fallback；printing-metadata记录真实有序字体指纹。print-1继续旧栈，旧已保存PDF不覆盖。最终完整“蒸牛蛙，这是对齐测试 中文”提取、对齐/格式/Undo回归全绿；未安装或分发新字体，未扩展为PDF框架重构。

## Review 与边界

Standards 独立审查 PASS：无剩余硬规则违反或需处理的启发式问题。Spec / Architecture / Resume regression 独立审查：无剩余代码阻断；审查时指出的人工验收待办现已由上述独立证据完成。跨窗口姓名布局问题已用红绿测试修复。Frozen依据：DOMAIN DM-01、DM-21–22，AI-10–11，Architecture DATA §4.1–4.2 与既有单一 owner/写入/PDF边界。不复制冻结正文，不改产品语义或架构，不引入新编辑器/任意布局框架/数据库表。Frozen SHA最终检查：Product Spec 12/12、Architecture 8/8与审查基线完全一致。

所有应用验收使用隔离虚构 TEST DATA 与 deterministic fake。没有真实 DeepSeek/Tavily/Feishu 调用，没有读取秘密、真实职业资料或迁移数据。build/runtime DB/PDF/截图/真人测试profile均在ignored目录，不提交。

Issue #32可按验收结果收尾。未进入M1-B或执行迁移；本轮能力补齐不会自动导入任何旧资料或解除迁移授权边界。

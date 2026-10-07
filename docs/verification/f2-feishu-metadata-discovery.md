# F2 飞书资料发现：仅元数据

状态：PASS（2026-10-07）。用户已主动完成1次真实标题元数据搜索，返回5条候选，当前已选择第一条多维表格。真实证据来自该次既有搜索、Computer Use核对和用户本轮确认；收口不再次联网、不读取正文，未进入F3。

## 入口与动作

Wiki → 添加资料 → 飞书。只有点击“搜索”才执行查询；输入、回车、切换来源、应用启动、重启、页面刷新均不自动搜索。未连接或授权失效会提示到设置检查连接。

结果采用紧凑行列表：标题、类型、更新时间；点击仅设置当前页面的已选择元数据。读取按钮禁用，没有正文、Raw、Wiki写入或AI调用能力。选择不持久化，不添加一级导航。本地文件导入保留原能力，测试仅使用隔离TEST工作区。

## 搜索合同与后端边界

- `platform/connectors/feishu/discovery.ts` 仅提供标题元数据发现，不访问业务DB。浏览器通过固定 `feishu/search` 路由传递本次query与随机searchId，所有额外字段均拒绝。
- query必须非空、最多30个Unicode字符，不自动改写。现有lark-cli user身份，固定 `drive +search --only-title --page-size 20 --as user`，对应唯一 `POST /open-apis/search/v2/doc_wiki/search`；doc_filter / wiki_filter均only_title=true。
- 不翻页、不自动重试、不fallback、不调用inspect/meta/body/评论/附件/用户或部门接口。相同searchId在当前进程的有界100次窗口内复用原结果，包括失败；重启不会重放查询。
- CLI stdout投影只保留必要文档引用、title、type、updatedAt、url，服务端搜索可能附带的摘要、作者、联系人、分页token等均丢弃，不展示、不记录，不调用文档正文接口。官方Search API会返回摘要字段；不声称服务端原始搜索响应绝对没有额外字段。
- Browser只得到 `{ref,title,type,updatedAt,url}` 加结果状态/hasMore。ref为本次候选的随机opaque ID，不是可调用Feishu原始token的能力；F2没有正文resolver。URL只接受HTTPS Feishu/Lark域名，标题作为文本显示；缺失或无法解析时间显示未知，不另发请求补齐。
- 保留loopback、Origin、session/CSRF capability和workspace绑定；无通用Feishu代理，无Key/token/原始响应/open_id进入Browser。F1 identity缓存与Profile仍隔离。

## 权限与真实验收状态

本机local auth status与auth check确认当前user ready/valid、已有 `search:docs:read`。新增权限0；无需重新OAuth。检查未使用verify、未读取凭据配置正文。

| 项目 | 当前结果 |
| --- | --- |
| 真实Feishu metadata search | 1；用户主动点击搜索，query=`Image`；无重试、自动搜索或额外搜索 |
| 真实候选 / 选择 | 5条；已选择第一条 `Image Factory V2 · 阶段0`，类型bitable |
| Feishu正文 / 文档列表额外读取 | 0 / 0 |
| 飞书写入 / AI读取 | 0 / 0 |
| 正式Raw / Wiki创建 | 0 / 0 |
| REAL业务内容变化 | 0；业务owner内容与搜索前本地摘要比较，工作区身份不变；界面导航偏好不属于职业业务资料 |
| F1 identity真实重新读取 | 0；正式后台重启复用缓存，头像/名称正常 |

正式arm64 Career.app → Node → Chrome通过Wiki → 添加资料 → 飞书进入。Computer Use已核对当前页面5条元数据及第一条选中状态，页面明确显示“尚未读取正文，也没有保存到 Career”，读取按钮禁用。Computer Use既有600px检查及本轮合成Chrome回归均验证无横向溢出。截图、本地资料摘要和外部源码核对材料仅在Git ignored的 `out/f2-validation/`。

## 唯一真实搜索与已选候选

以下只记录用户确认的标题/类型/更新时间，不保存原始响应、文档token、URL或正文。

| 候选标题 | 类型 | 更新时间 | 选择 |
| --- | --- | --- | --- |
| Image Factory V2 · 阶段0 | 多维表格 / bitable | 2026/10/6 | 当前已选 |
| Image-Factory | 多维表格 / bitable | 2026/9/28 | 未选 |
| Image Factory V1 | 多维表格 / bitable | 2026/9/21 | 未选 |
| AI Smart Image Generation | 多维表格 / bitable | 2025/12/9 | 未选 |
| Image Creation Request | 云文档 / docx | 2026/1/7 | 未选 |

F2只证明“飞书资料发现 + 元数据查看 + 选择”。它不证明正文读取、多维表格记录读取、Raw导入、AI Context或自动同步。当前真实选中资料是多维表格 / Bitable；F3必须根据资料类型选择reader，不能把所有飞书资料当普通云文档正文。本轮没有实现任何F3 reader或导入路径。

## 自动回归

- TDD红→绿：metadata adapter缺失；实际安装CLI的离线合成投影曾把官方字符串doc_types取成首字母，已按官方SDK字段修正。该测试严格使用dry-run合成响应，不向飞书发真实搜索。
- F2 adapter/discovery6项、UI3项、Node集成5项：最终14项通过。覆盖显式点击、空/多结果、类型/更新时间、选中、失效、无重试、opaque字段、拒绝正文/额外参数、Origin/会话保护、Profile/Raw/Wiki不变和F1重启不重复读取。
- 独立正式React构建的Chrome TEST旅程1项通过：四入口、Wiki资料来源、搜索选择、600px、无正式对象生成、刷新不搜索。
- 相关范围31项回归通过（包括F1、Browser安全和隔离TEST的本地Raw既有能力）；最后投影修正后又执行上述最终14项。
- Typecheck、build、arm64 package通过；Frozen Product Spec 12/12、Architecture 8/8与HEAD相同；Git候选文件扫描未发现真实Key/token/私钥。

### 2026-10-07 最终收口回归

- Typecheck与build重新通过；既有构建warning不改变本轮结果。
- 9个测试文件、47项全部通过：F2 metadata adapter/UI/Node集成/正式构建Chrome旅程，F1身份与CLI回归、Browser安全、Node宿主与既有Materials集成。全部使用合成夹具；CLI测试只执行offline dry-run，真实搜索总数仍为1。
- 600px合成Chrome旅程再次通过：四入口、显式搜索、元数据选择、禁用正文按钮、无横向溢出、刷新不重新搜索。F1后台重启测试复用缓存，不增加真实身份读取。
- REAL库只读比较覆盖69张表；所有职业业务owner表数量/内容摘要一致。3张非业务表有变化：application_preferences（用户导航偏好）、platform_commands（导航命令记录）、platform_local_search_fts_data（本地索引缓存）；不把这些变化冒充职业业务资料修改。比较结果仅保留于Git ignored的本地证据。

## 依据

只读参考官方实现，不使用旧Career代码：

- [Lark CLI v1.0.96标题搜索与最小scope](https://github.com/larksuite/cli/blob/v1.0.96/shortcuts/drive/drive_search.go)
- [官方Go SDK v3.7.2 Search字段](https://github.com/larksuite/oapi-sdk-go/blob/v3.7.2/service/search/v2/model.go)：DocMeta.doc_types是string；update_time为秒；DocResUnit的摘要不进入元数据合同。

停止点：F2 PASS，停在已选择元数据。提交仅包含F2 connector/合同/来源选择UI、相关测试及verification/navigation，不包含设置页、Sidebar、Gemini建议、F3 reader或Raw导入。后续F3需独立授权；本轮不读取选中资料。

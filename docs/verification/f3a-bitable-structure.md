# F3-A 飞书多维表格结构发现

状态：PASS（2026-10-07）。真实结构查询已完成，6张表、7个视图、65个字段已展示；用户已确认选择表“生图任务”、视图“① 从这里开始｜准备生图”，页面选择状态已核对。不进入F3-B或记录读取。

## 验收范围

仅证明 Bitable → tables → views → field names/types，以及当前会话内一个table、可选一个view的选择能力。不证明records/cell values、公式计算结果、关联记录内容、附件、评论、普通文档正文、Raw导入或AI Context。

入口仍为Wiki → 添加资料 → 飞书 → 已选择多维表格 → 查看表格结构。点击结构按钮才外发结构请求；初始化、选择表/视图、切换模块和刷新均不会自动读取结构或records。非Bitable资料不会进入此读取器。结构采用紧凑行列表，不修改Settings、Sidebar或其他UX。

## 边界与实现

- `platform/connectors/feishu/discovery.ts`仅在当前进程中保留F2候选与Bitable来源的对应。必须是真实bitable类型、受控HTTPS `/base/` 来源；浏览器不能传app token/table id或原始API路径。
- `platform/connectors/feishu/bitable.ts`仅暴露`listBitableTables(selectedRef)`、`listBitableViews(tableRef)`、`listBitableFields(tableRef)`。table/view refs为随机opaque引用；不存在records/body/write/rawApi能力，也不访问业务数据库。引用重启后失效，不凭原始ID重建或fallback。
- `contracts/platform/feishu-bitable.ts`是严格合同；普通Browser得到名称、类型和opaque引用，不得到token/open_id/原始响应。额外record参数被拒绝，未知records/rawApi路由不存在；保留Origin/session/CSRF/workspace边界。
- 固定user身份CLI三个只读shortcut；只保留table id/name、view id/name/type、field name/type。字段属性中的公式表达式、选项、关联目标与原始上下文在CLI stdout产生前丢弃；附件字段只显示字段名/类型，没有下载附件。
- 每类查询有界一页并保留`hasMore`，有剩余时显示未列全，不冒充完整；同一引用的成功与失败均复用，不自动retry。某表视图/字段失败后停止后续读取，不转向记录或其他身份。

## 权限与官方依据

本机已授权的user scopes包含`base:table:read`、`base:view:read`、`base:field:read`；本轮新增权限0，OAuth reauth 0。现有账号原先还拥有其他scope；Career本轮能力只使用这三种结构查询，不使用既有写/record权限。

已核对当前安装CLI v1.0.96的help、离线dry-run和官方源码：

- [table-list](https://github.com/larksuite/cli/blob/v1.0.96/shortcuts/base/table_list.go)：`GET /open-apis/base/v3/bases/<base>/tables`
- [view-list](https://github.com/larksuite/cli/blob/v1.0.96/shortcuts/base/view_list.go)：`GET /open-apis/base/v3/bases/<base>/tables/<table>/views`
- [field-list](https://github.com/larksuite/cli/blob/v1.0.96/shortcuts/base/field_list.go)：`GET /open-apis/base/v3/bases/<base>/tables/<table>/fields`

## 唯一真实目标与本地证据

目标仍是用户在F2选定的`Image Factory V2 · 阶段0`。F2会话在本轮之前已刷新、原临时引用丢失；用户单独提供了同一Bitable链接，未再次搜索。链接的非table子资源参数被忽略，未读取其工作流。

真实查询使用隔离TEST profile、正式React构建、正式Node host与真实lark-cli user adapter。已确认的来源通过可信宿主装配参数恢复，不建立Browser任意URL/token注册接口，也不注入假的结构结果。正式launcher无需该临时装配参数；以后新F2候选直接走进程内映射。此TEST会话同时阻止新的F2搜索及F1身份刷新。

只将原F1名称/头像的非敏感显示缓存复制到TEST profile，复制凭据0。真实结构及截图仅保存在Git ignored的`out/f3a-validation/`；完整名称/类型列表见LOCAL-ONLY `STRUCTURE-REVIEW.md`，不把私有结构或真实来源URL提交到Git。

| 项目 | 真实结果 |
| --- | --- |
| table / view / field CLI结构调用 | 1 / 6 / 6 |
| 返回table / view / field | 6 / 7 / 65，未出现hasMore |
| 新F2搜索 / F1真实身份读取 | 0 / 0 |
| records / cell values读取 | 0 |
| Raw / Wiki创建 | 0 / 0 |
| AI读取 / 飞书写入 | 0 / 0 |
| 用户选择table / view | 生图任务 / ① 从这里开始｜准备生图 |
| REAL职业业务数据 | 38张业务owner表数量和内容摘要未变 |
| F1显示缓存 | 名称metadata及头像字节SHA未变 |
| 600px | 真实Chrome和合成Chrome均无横向溢出 |

用户通过本轮明确指令确认上述table/view。Computer Use核对表已选中，并按该指令落实视图选择；页面显示完整已选状态。此次选择没有新增外部请求，仅保留在当前UI会话。选择截图保存在Git ignored的`out/f3a-validation/selection-confirmed.png`，不提交真实结构缓存或截图。

## 回归

先复现模块缺失、固定adapter缺失和UI未恢复选中项的红灯，再接通对应能力。最终Typecheck、build通过；12个测试文件的46项回归通过，另补1项非Bitable/无效连接边界验证，总计47项唯一测试通过，覆盖Bitable引用、table/view/field、0/多表、权限不足、连接失效、会话过期、无任意ID/records/API代理、F1缓存、F2和Browser安全。UI收紧为紧凑列表后重新执行2项UI回归；用户完成选择后的最终收口再次运行上述12个文件，47/47通过。全部回归只用mock/fixture或offline dry-run，不重复真实结构请求。

Frozen Product Spec 12/12、Architecture 8/8保持不变。未修改业务schema/owner或Settings/Sidebar，没有创建业务对象。本收口仅提交F3-A实现、测试及必要导航/验收文档。停在当前已选table/view，F3-B尚未开始；后续读取records必须另行明确授权。

# F1 飞书连接身份验收

状态：PASS（2026-10-07）。用户明确确认使用官方 Contact User API 的 `nickname`，不再追查其他名称；本阶段收口，未进入 F2。

## 正式能力与边界

- Owner：`platform/connectors/feishu`，复用本机 lark-cli 的 user 授权，不使用 bot。当前连接身份是资料扩展源的展示信息，不是第二套 Career 用户系统。
- 唯一身份读取路径：`GET /open-apis/contact/v3/users/{CURRENT_USER_OPEN_ID}?user_id_type=open_id`。目标来自本机当前 user 授权元数据；浏览器不能提供 user ID。没有通讯录搜索、列表、部门、文档或通用 API proxy。
- 新增且仅新增 user 只读权限 `contact:contact.base:readonly`；既有 `contact:user.base:readonly` 不重复申请。平台范围跟随用户自己的通讯录可见范围，不能限制为 self-only；用户已明确接受。Career 实际能力只查询当前用户。
- 显示名只取该用户的 `nickname`；缺失或为空立即失败，不 fallback 到 `name` / `en_name`。用户已确认本次官方返回值可用于显示；代码不硬编码真实名称。
- 未连接显示中性头像、无姓名；已连接显示真实缓存头像和官方昵称。Profile 名称不用于连接显示，昵称与头像不写入 Profile、Resume、Person、联系方式或其他业务表。
- 连接状态区分未连接、已连接、连接失效、需要重新授权。刷新失败不再被旧缓存冒充成功；旧的通用名称缓存缺少 `displayNameSource: nickname` 时失效。

## 浏览器与本地缓存

身份响应严格只有 `{ connected: true, displayName, avatar, provider: feishu }`。`avatar` 为固定本地资源标记或 null；实际图片通过同源 POST `/api/feishu/avatar` 获取，再作为浏览器临时 blob 展示。连接状态单独返回非敏感状态。

固定资源路由仍检查 loopback、Origin、session cookie、request capability 和 workspace binding；没有任意文件或任意通讯录查询入口。身份合同拒绝额外字段，token、open_id、Authorization、原始 API 响应和远程头像地址均不进入 Browser。

昵称与头像只缓存在 profile 的 `connectors/feishu/`，与业务 workspace 分离：目录0700、文件0600，头像最大2 MiB并核对SHA256。缓存不含凭据、联系方式或原始响应；本轮复用已经验收的真实头像与已经读取、用户确认的昵称，没有重新获取身份或头像。缓存及真实截图不进入Git。

## 真实验证与请求计数

历史诊断计数保留，不把未确认请求冒充成功读取：

| 操作 | 累计结果 |
| --- | --- |
| authen/v1/user_info | 3 次；已停止使用该身份来源 |
| Contact User attempts | 3 次；首轮是否到达服务器未知 |
| confirmed Contact HTTP responses | 2 次：一次权限拒绝、一次成功可解析响应 |
| 本次 F1 收口新增 Feishu identity / avatar 请求 | 0 / 0 |
| 文档列表 / 搜索 / 正文读取 | 0 / 0 / 0 |
| Drive search | 0 |
| Feishu write / Career → Feishu write | 0 / 0 |
| AI / Search 请求 | 0 |

成功响应的 CLI exit code 为0、`ok=true`；CLI没有提供数值HTTP状态，不补写200。上一轮诊断脚本把成功误分类为HTTP_ERROR，本轮以失败测试修正为SUCCESS；未为了修正分类再次请求。

## 最终运行验收

- 正式 arm64 Career.app → Node → Chrome：左下角真实头像已加载、官方昵称正确，头像菜单的更新日志/设置/帮助/反馈可用。
- 正式 backend 重启后缓存可用、工作区身份不变；唯一进程持有 SQLite，未出现第二个 writer。
- 两个独立 Google Chrome 验收实例分别启动、完整关闭进程、再次启动后身份与菜单正常；使用当前正式 REAL workspace 只读。用户日常 Chrome 未被退出。页面无身份刷新请求、无外部网络请求；并非退出用户所有 Chrome 窗口的冷启动验证。
- 真实 Chrome 600px：头像、昵称、连接设置和菜单可用，无横向溢出；截图仅保存在Git ignored的 `out/f1-closeout/`。
- 重启前后全部69张业务表的行数与排序内容摘要一致，Profile、Resume及全部REAL业务内容不变；不把业务正文复制进验收文档。

## 自动回归

- TDD已复现并修绿：固定当前用户Contact路径、缺失nickname不fallback、嵌套成功响应解析、旧名称缓存失效、身份响应字段收窄、诊断SUCCESS分类、刷新失败不冒充成功。
- 全量unit/UI基线：73个文件、231项通过；最后局部修正后定向最终回归：6个文件、40项通过，其中Feishu/诊断21、A6 UI9、Browser security6、Node integration4。
- Typecheck、正式build和arm64 package通过。最终包重新启动后再次验证Chrome显示；重启检查不调用真实Feishu。
- Node integration使用TEST workspace：拒绝任意用户ID、只开放3条identity/status/connect路由、Profile隔离、重启不重复读取；实际生成的业务备份只含数据库、backup manifest和blobs，不包含connector cache。

## 安全审计与限制

- Git候选文件、验收日志、业务SQLite与后台CLI参数扫描未发现真实Key、token或私钥；合成测试中的凭据标签明确为fake。
- 本机当前受管理的完整业务backup数量为0；不把“扫描了真实backup”写成证据。备份排除能力以代码路径与上述TEST实际备份回归确认。connector只写本地非敏感metadata，不接入业务备份。
- 本轮没有读取Keychain、旧Electron safeStorage或其他凭据正文，也未删除旧Secret。
- Spec、Architecture正文不变。Standards/Spec/owner与privacy边界检查通过；没有新增权限、任意用户查询、name fallback或Feishu写入路径。

F1 PASS只表示连接身份已完成，不代表文档发现、读取、Raw导入或AI上下文通过；F2须另获授权。

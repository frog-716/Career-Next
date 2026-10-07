# S1：真实凭据重新录入与 Chrome 冷启动

状态：**PASS**（2026-10-07）。本阶段未开始飞书连接。

## 新 Keychain 与真实连接检查

- 用户通过 Career 正式 Secret UI 分别录入 DeepSeek 与 Tavily Key。两项状态均进入新 native-v1 Keychain；界面只显示配置与本机可用状态，不提供明文回读。
- DeepSeek V4.1-Flash（API identifier `deepseek-flash`，non-thinking）执行一次固定内容的连接检查：HTTP 200。总请求数为 1。
- Tavily 执行一次固定公开查询 `OpenAI official website`：HTTP 200，返回 1 条结果。总请求数为 1。
- 两次均未发送 Career 资料，无自动重试、跳转或备用服务。Chrome 冷启动 Gate 未再次调用 Provider。
- 旧 Electron safeStorage 未读取、未删除；没有迁移旧密文。

## Chrome 冷启动

- 用户先用 ⌘Q 完全退出 Chrome，再从 arm64 `Career.app` 启动。Career 自动打开 Chrome 到本地 `127.0.0.1` 页面，机会列表正常加载；四个一级入口与 A6 管线布局可见。
- Career.app 复用了既有正式 Node backend 与该 REAL workspace 的单一 SQLite writer。启动前后 REAL 数据库 SHA-256 相同；本 Gate 未修改 REAL 业务数据。
- 重启后的 AI / Search 设置显示 DeepSeek 与 Tavily 均已配置且本机可用。页面不显示密码框或 Key 明文。
- Career.app 本次启动没有打开 Electron 窗口。一个独立的旧 A6 review app 进程和一个使用隔离 E1 TEST workspace 的 backend 在 Gate 前已存在；未由本次启动创建，也未被本次检查操作。

## 回归与边界

- 最小回归：TypeScript typecheck、生产 build、连接预览/单次请求 UI 回归通过；先前 S1 provider、integration 与 secret UI 测试通过。实际连接总次数仍为 DeepSeek 1、Tavily 1。
- 浏览器仅得到固定 slot 的配置/可用状态和连接结果；测试覆盖普通 UI / bridge 无 Key 回读路径。Key 未写入 URL、日志、业务数据库、命令参数或业务备份。
- S1 不授权或执行飞书连接；下一阶段须按其单独授权流程进行。

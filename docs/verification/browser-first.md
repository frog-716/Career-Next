# Browser-first 运行入口验证

日期：2026-10-06。状态：实现、自动回归和 Computer Use 运行验收 PASS；这是可审阅的本地 checkpoint，尚未 push。A6 的人工视觉复审仍由用户决定，Issue #39 不关闭。

用户明确将 Chrome 本地 Web UI 设为正式默认入口。最小差异和与 Frozen Architecture 的显式差异见 [ADR 004](../adr/004-BROWSER-FIRST-LOCAL-ENTRY.md)。本轮没有修改冻结正本、业务 Contract / owner / SQLite schema，没有读取旧 Career，没有执行迁移或真实外部请求。

## 实现与边界

- 正常 arm64 包和 `npm start` 默认启动系统宿主、唯一工作区 writer 和生产 loopback 服务，准备好才打开 Chrome。不开业务 Electron 窗口；不可见 PDF 打印窗口保留。
- 监听 127.0.0.1；准确 Host / Origin、同源请求、HttpOnly / SameSite=Strict cookie、每标签内存 request capability。无 CORS、无通用 IPC/RPC、无任意路径/SQL/执行能力。请求合同仍在 Main 和 owner 检查。
- 多标签绑定单一 workspace。恢复会隔离旧标签，慢请求在正文到达后再次核对原工作区，防止切换期间跨库写入。关标签撤销对应能力，不关闭后台。
- Key 从原 Secret UI 只写到同源 Main、保留 safeStorage / Keychain、独立 Provider slots 和原授权等待。没有读取真实 Key，没有新增 Key 回读接口；凭证不进 URL / localStorage / 业务 DB / backup / CLI args。
- 原生文件选择在 Main，浏览器不能传任意本地路径；取消不建 Raw。PDF 来自 owner 冻结快照，继续由无业务权限的不可见打印 renderer 生成并保留真实文件。
- 备份 / 验证恢复由原 owner 完成。后台退出与重启不依赖 Chrome 生命周期；断开时页面和草稿保留，手动重连不重放命令、AI 或 Search。

## 回归证据

全部写入只用独立 TEST workspace。以下本地证据在 `out/implementation/browser-first/`，保持 Git ignored。

| 范围 | 结果 | 证据 |
| --- | --- | --- |
| typecheck | PASS | `typecheck-verified.txt` |
| production build / normal arm64 package | PASS | `build-verified.txt` / `package-verified.txt` |
| 全量 unit / UI | 69 files / 201 PASS | `unit-last.txt` |
| 全量 integration | 85 files / 447 PASS | `integration-serial.txt` |
| loopback / Origin / CSRF / tab / workspace / slow-body / 中文多字节兼容 安全 | 4 PASS（包含在 unit） | `security-verified.txt` |
| 正常 arm64 宿主 + Chrome 旅程、PDF、恢复、多标签、重启 | PASS | `packaged-verified.txt` 第1项 |
| Main 文件选择 / 取消、浏览器 Secret 状态与拒绝回读 | PASS | `packaged-verified.txt` 第2项 |
| 原 Secret 加密、保存失败、授权等待、取消 / 拒绝及 >60秒等待 | PASS（mock 系统边界） | 全量 unit 原相关用例；未打开真实 Key |

先保留失败证据，再修正：新增 Web 接入初始 red 见 `security-red.txt`；旧资料库慢请求的工作区隔离失败后补强；自动旅程补反馈的原有关闭确认。列表滚动回归的36px差异来自测试点击前自动滚动，已改为先聚焦再测量/键盘激活，严格保留原位置断言；临时界面改动已撤回。拖拽测试等待旧排序动画结束后再测量坐标。

额外 native 加密可用性探测所在用例曾超时，保留 `packaged-last.txt`；没有获得该次探测完成或系统授权结果，未据此推定具体失败阶段。它不属于业务 Secret status。本轮没有打开真实 Key，最终 Secret 验收走安全状态 / 非回读 API，原加密与等待行为使用既有 mock 回归；不将该次探测写成真实 Keychain 授权 PASS。

## 真实 Chrome Computer Use

- 正常启动自动新增 Chrome 标签；重复启动新增标签但仍是同一宿主 PID / instance，没有第二个 writer。
- Wiki、项目、任职列表和机会四列表格可达；详情六分区存在，简历只属于具体机会。Settings 五分类、Help、Feedback、更新日志经头像菜单可达。
- 在 TEST 简历用实际 Chrome 键盘输入，保存后刷新仍保留，居中正文保持。Settings / Help 返回仍保留正文；自动旅程验证反馈草稿保留。
- 正常 arm64 + Chrome 自动旅程实际关闭/重开标签、第二标签及 restore / 后台重启均 PASS。Computer Use 另实际退出 TEST 后台，Chrome 保留正文并显示断开；重启后点击“重新连接”继续同一任务。
- Chrome 对目标标签临时设为600px，实测 `innerWidth=600` / `scrollWidth=600`，四个名称常显；已撤销尺寸覆盖。截图 `chrome-review.png` / `chrome-review-600.png` 只含 TEST DATA。
- 真人中文 IME 沿用先前验收，不宣称本轮又做了一次真人输入法验收。mock composition / Resume 相关回归在全量 unit 中通过。

## 正式资料与安全核对

正式迁入工作区只读核对：Profile1、Company2、Opportunity3、Resume2。操作前后的业务内容 hash / 数量相同，没有业务写入。证据 `real-before.json` / `real-readonly-audit.json` 仅在本地；Git 文档不复制真实姓名、公司、简历或联系人。

冻结产品文件12/12 SHA不变；冻结架构8/8 SHA不变。A6 原批准 CSS SHA256仍为 `2c1372d5dac812c98a352c8ebb73c9cf9367daa80aa58347520f6ef7a9ec4251`。四入口、无 Home、豹头和方案3动效、表格、头像菜单、版本/更新日志保留；没有重新设计 IA。

变更文件扫描未发现真实 Tavily / DeepSeek Key 或私钥字面值；Git 不含 runtime DB、userData、backup、PDF、截图或 build 输出。没有使用真实 Key、读取 Keychain Secret 或重复消耗已用的真实外发授权。

## 自查

Standards：前端仍依赖 contracts，不导入 backend；平台宿主桥接不拥有业务规则。Spec：Chrome 是默认入口，旧资料不改；只在系统能力确有需要时保留 Electron。Architecture：以用户明确决策记录新增 authenticated loopback transport，冻结文档原样保留。安全：列举接口、两次工作区核对、仅内存的标签能力、密文槽与原 Proposal/外发授权路径保持。

这是 Codex 自查，未冒充独立 agent review。Developer ID / Notarization / x64 继续 READY / NOT RUN。

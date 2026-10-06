# Browser-first 本地运行入口

状态：用户于 2026-10-06 明确决定；实现与验收见 [运行入口验证](../verification/browser-first.md)。

Frozen Architecture V2 的 §2.3 原先禁止正式 HTTP 监听器、采用 Electron 窗口作为默认 UI。这次用户明确要求 Chrome 成为正式入口，授权增加经过认证的 loopback transport。冻结文件保留原文；本决策只调整运行入口及接入端，不改产品语义、业务 owner 或资料格式。

## 最小差异审查

| 现有依赖 | 性质 | Browser-first 处理 |
| --- | --- | --- |
| React renderer / A6 | 产品界面 | 原页面、样式和编辑会话复用，Chrome 加载同一生产构建 |
| preload / IPC | 桌面接入端 | 默认用同 Contract 的浏览器桥；IPC 只用于显式桌面兼容模式 |
| BrowserWindow / 菜单 / 关闭窗口退出 | 窗口壳 | 默认不创建业务窗口，关闭 Chrome 标签不退出后台 |
| file picker | 平台能力 | Electron Main 原生选择，路径仅留在可信平台/后台，不接收 Web 任意路径 |
| PDF | 平台能力 | 后台只读冻结快照，隔离且不可见的打印 renderer；保留版本/原件保留规则 |
| safeStorage / Keychain | 平台能力 | 原异步加密库与分离 credential slot；Web 仅只写输入及安全状态，不能取回已存 Key |
| backend lifecycle | 平台装配 | Electron Main 继续监督 utilityProcess / 唯一 SQLite writer |
| workspace locking | 平台能力 | 原应用单实例锁 + SQLite writer 锁 + active pointer；不按浏览器标签启动 writer |
| backup / restore | application owner | 原验证/切换流程；切换后旧标签会话失效，拒绝旧稿写入新资料库 |
| secret input | 受限系统能力 | 原 Secret UI → 同源 POST → Main vault；Key 不进 URL、localStorage、日志或备份 |
| system prompts | OS 能力 | 继续由 Main / macOS 发起，授权等待可查状态、取消；不由 Chrome/Agent读取密码 |

## 运行与退出

`npm start` 启动持久本地系统宿主，后台及生产 Web 服务准备好后在 Chrome 打开标签。再次启动复用现有应用锁/后台并打开标签。`npm run dev` 是相同默认入口的前台进程运行方式；`npm run stop` 验证当前 profile 的本机宿主身份后正常退出。标准 `--user-data-dir` 隔离 TEST 工作区；同一 profile 只允许一个 active workspace。

默认端口优先 47631，保存实际可用端口以便重启重连；端口已被别的程序占用则分配另一个 loopback 端口，绝不连接其服务或暴露到网络。后台启动失败不转用空白替代资料库，也不自动外发。

Electron 暂不移除：它仍提供系统秘密、原生对话框和静态 PDF 打印。`--career-desktop-ui` 是显式兼容/回归入口，不是默认 UI。不存在独立 Home 导航。

## 浏览器安全边界

- TCP 固定绑定 127.0.0.1；同时检查真实连接地址和准确 Host/port，拒绝 DNS rebinding。
- 所有业务 API 只接受 POST、准确 Origin、JSON、同源 fetch、HttpOnly / SameSite=Strict cookie 和每标签随机 request capability；拒绝跨源预检、不提供 CORS。
- Cookie 按端口区分。请求能力只在当前页面内存中，既不进入链接也不写 localStorage。多个标签拥有不同能力，绑定同一明确 workspace；业务请求仍经正式 Contract 验证。
- 接口是固定的 owner/capability 白名单，不接收任意 IPC channel、文件路径、SQL、脚本或可执行命令；传输4 MiB bytes上限，并保留 Main 原1 MiB JSON字符限制，中文不会因多字节编码被提前截断。错误只返回白名单，不返回异常正文或请求正文。
- CSP 禁外部脚本/连接/嵌入，禁止被 iframe 嵌套；资源禁止缓存，COOP 隔离 opener。没有第三方脚本或远程字体。
- 关闭标签不关 writer；进程重启后凭证失效。重新连接只建立新会话，不自动重发未知结果命令/AI/Search。资料切换隔离旧页面并要求重新载入。
- 本机恶意程序、恶意浏览器扩展不属于 Web 同源边界所能隔离的威胁；没有因此新增通用 Key 读取能力。

Secret、真实外发审批、费用预算、结果未知、正式 Proposal Apply 等业务边界完全沿用原实现。发布签名、公证、x64 仍 READY / NOT RUN。

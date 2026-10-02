# Career 新架构设计｜V2 修订

**状态：READY FOR FINAL ARCHITECTURE REVIEW**  
**设计与技术核对日期：2026-10-02**  
**推荐：Electron 桌面壳 + React 前端 + TypeScript 模块化单体后端 + SQLite + 本地不可变附件。**

这里的“READY”只表示修订包可以进入最终架构审查，不表示架构已冻结、代码已实现或运行验收通过。本文提出架构决定；产品行为仍以冻结规格为准。

<a id="authority"></a>
## 1. 输入、权威和文档分工

本轮在 V1 上按完整 Reviewer 结果及用户修订指令进行定向修改。重新核对 Frozen R3 的八份 `rebuild-spec/` 正文和架构护栏，保留未被阻断的技术及产品映射；没有读取旧 Career 仓库、旧代码、旧目录、旧数据库设计或 audit 正文。八份冻结正文与包内 SHA256 清单一致。部分正文标题仍写 R2，以 R3 包、README 和校验值识别版本，不改写产品合同。Reviewer 指出的是文档允许的竞态反例，未声称已复现代码漏洞。

| 输入 | SHA256 |
| --- | --- |
| career-rewrite-spec-frozen-r3(1).zip | `fc612fd0bded492fbd2076737e695cde5592ec7171a79ae429c42190b814234d` |
| architecture-guardrails-v2(1).zip | `492ec36d89b0e230728790641e841775300365f22078a79d6d1c9a7502e0d730` |
| V1：career-architecture-review-2026-10-02.zip | `974fd380121633e8dc1143c344ac11d73412f005de0a445962e89d1afff35fad` |
| Reviewer：粘贴的文本 (1)(8).txt | `e78da4a41ef4846210110d2f296046e82502f9bd45531624189ef068eeb2609e` |

冻结输入包含 **87 个 Requirement ID、104 个验收分支、9 条旅程**；都是定义，不是测试通过记录。DM-32 仍是建议，架构不把它升级为必须实现的薪资计算器。

| 本包文件 | 唯一负责的架构正文 |
| --- | --- |
| ARCHITECTURE.md | 系统运行边界、技术取舍、总依赖方向、官方技术核对 |
| [MODULES.md](MODULES.md) | 业务边界、事实 owner、模块公开接口、前端状态和 UI 分层 |
| [DATA.md](DATA.md) | 持久化、文档格式、历史、文件提交、备份、清除、密钥、迁移 |
| [AI-RUNTIME.md](AI-RUNTIME.md) | 任务权限、Context、外发、Provider、提案生效、预算和未知结果 |
| [DELIVERY.md](DELIVERY.md) | 未来仓库骨架、并行顺序、集成门、需求追踪 |
| ADR/ | 仅记录三项难以撤回的系统决定及代价，不复写以上合同 |

业务规则冲突回到对应 Requirement ID；不能用 ADR、库的默认行为或某个 Agent 的实现绕过冻结规格。技术补丁版本可经兼容与安全验证更新，不为每次升级重新冻结产品。

<a id="derivation"></a>
## 2. 先从业务推导，而不是先选框架

Career 的核心压力不是高并发，而是“现实发生了什么、当时用的是哪份资料、谁可以改变它”要长期说得清。

| 冻结规格中的真实压力 | 推导出的边界 | 明确不推导出什么 |
| --- | --- | --- |
| 机会可以跳过理想顺序，面试、Offer、首次投递互相关联（DM-02～06、23～31） | Opportunity 保留招聘领域的外层组织；core 只守身份/阶段/结果，沟通、研究、面试、Offer、投递各有强边界 | 不把面试、Offer 做成独立服务；不强制先有简历/投递 |
| 项目可跨任职继续；人物只在任职内存在（DM-16～20、34～36） | Project 和 Employment 分开；Person 是 Employment 子模块 | 不做全局人物 CRM；不让结束任职自动结束项目 |
| 当前 Profile、当前简历、历史版本和实际发送材料不同（DM-01、21～25） | Profile、Resume、Opportunity/Submission 各守正本，通过快照交换 | 不维护跨机会共享当前简历；不让历史随 Profile 更新 |
| Wiki 与 Research 的用途不同，但来源可能相同（DM-07～15） | Wiki 和 Opportunity/Research 分开；共享来源引用协议，不共享可编辑正文 | 不造通用“事实表”吞掉各领域；不把 Raw 预加工为 Wiki 才能读 |
| Raw 的范围、更正、清除与文件字节不同（DM-11～13、38） | 小型 Materials 支撑域管材料语义；Platform 文件层管字节 | 不让文件服务判断现实事实或永久保存所有历史正文 |
| AI 权限、外发、提案、恢复各不等价（AI-01～18） | 独立受约束的 AI Runtime；业务 owner 决定正式写入 | 不建万能 Agent 平台；不把模型返回当成领域命令 |
| 单机、无 AI 可完整使用、桌面连续编辑（PR-01～02、UX-06～15） | 本地运行，单个事务数据库；UI 与后端独立进程 | 不引入微服务、云登录、同步、消息中间件或后台守护进程 |

**需要真正隔离的变化原因：** 招聘过程、长期项目、真实任职、文稿编辑、知识维护、个人身份、材料生命周期。它们是代码边界，不是部署边界。

**容易变化但不应冲击业务规则的边界：** Provider 接口、搜索服务、外部导入、PDF 渲染、编辑器库、视觉与动画、桌面打包、查询驱动。只在这些实际替换点设置窄接口。不为每个类加 repository/service/factory 三层。

<a id="runtime"></a>
## 3. 系统总图与运行方式

```text
macOS：一个 Career 应用实例 / 一个当前资料库

┌─ Frontend：sandboxed renderer ─────────────────────────┐
│ Design System → Shell → Wiki / Opportunity / Project   │
│                              / Employment / Resume     │
│ 只拥有输入、选区、视图状态；正式资料通过 Contract 查询/命令 │
└──────────────────────┬────────────────────────────────┘
                       │ 领域化、版本化 Contract / API
                       │ 精简 preload + sender 校验 + IPC
┌─ Desktop main ────────┴────────────────────────────────┐
│ 实例监督、窗口、文件选择、秘密存储桥、受限 PDF 渲染桥      │
│ 不包含业务 service，不写业务数据库，不持有领域真相       │
└──────────────────────┬────────────────────────────────┘
                       │ 私有 MessagePort
┌─ Backend：单个 utilityProcess ─────────────────────────┐
│ 控制事件循环：transport、Runtime 控制、受控外发          │
│ 唯一写执行 worker：领域命令 / workflow / SQLite 事务     │
│ Wiki │ Opportunity 子模块 │ Project │ Employment        │
│ Resume │ Profile │ Materials                           │
│ 受控只读 worker：慢查询、搜索；隔离候选备份               │
│ Platform：文件、驱动、Provider、导入、备份                │
└───────┬─────────────────────┬──────────────────────────┘
        │                     │ 唯一受控外发出口
        ▼                     ▼
  SQLite + 本地 blobs      获准的 LLM / Search / 飞书只读

PDF：后端冻结快照 → Desktop 启动无业务权限的打印 renderer
     → printToPDF → 后端校验并发布 PDF 与快照引用
```

这是**模块化单体**：一个应用、一个后端进程、一个业务数据库；不是把每个框拆成服务。Electron 官方提供 utilityProcess、进程消息及打印接口；其存在并不替代 Career 自己的授权和事务协议。[S01–S04]

### 3.1 前后端真正隔离，API 不等于必须开 HTTP 端口

正式应用不启动 TCP/HTTP 业务监听器，不开放局域网入口。前端静态资源来自受限的本地应用协议；外部网页不能借 localhost 端口调用 Career。开发服务器只服务开发资源，不成为生产业务接口。

Renderer 不允许 Node、SQL、任意文件路径读写、通用 shell、任意 IPC 通道或直接调用 Provider。preload 只暴露按操作白名单生成的窄能力；main 校验可信窗口、frame、来源和消息尺寸，后端再次校验 Schema 与行为权限。打印窗口、外部页面没有这份能力。拒绝任意导航、子窗口和任意外链协议；外链显式交给系统浏览器，业务协议只接受内部资源/导航，不接受“读取文件/执行命令”。[S02]

前端的读写入口是 Contract，而不是后端函数 import。后端可在没有 Electron UI 的测试进程里运行；Electron 耦合限于 bootstrap/transport 和少数 Desktop capability adapter。未来如有真实 Web 客户端需求，可以增加经过认证的 transport；本轮不顺带发布第二种运行模式。

### 3.2 三种身份、重启与重连

| 身份 | 何时改变 | 职责与持久性 |
| --- | --- | --- |
| `workspaceInstance`：当前资料实例身份 | 恢复或 workspace switch 时新建；普通 backend restart 不变 | 持久化并绑定命令回执、对象查询和缓存。目录/copy ID 只是副本定位，不代替资料身份 |
| `backendGeneration`：后端启动代次 | 每次 backend 启动都新建，包括同一库的重启 | 绑定所有执行 capability、生产者和内部能力；旧代次能力全部无效，不从业务备份恢复 |
| `connectionGeneration`：MessagePort 连接代次 | 每次建立新私有通道都新建 | 拒绝旧端口/旧响应；不拥有任务、业务状态或独立授权账本 |

Main 取得应用单实例锁，关闭失效通道；新 backend 必须取得资料副本的真实排他写锁，完成回执/文件保留/清除恢复及版本检查，才提供带三种身份的 ready 握手。锁失效依赖实际进程/句柄释放，不能仅凭心跳超时同时启动第二写者。Main 只监督自己持有的进程句柄，不按端口或猜测 PID 杀进程。AI、Search、飞书未配置不阻断人工业务 ready。（UX-13）

**普通后端重启：**资料身份与原 commandId 不变，执行能力全部重发放。旧 unknown 外发不得重试。前端保留同会话 dirty 输入和未核对 commandId，先查原回执，再读取正式值或显示冲突；新连接不会自动重放旧命令，也不会把旧命令换一个 ID 再发送。明确未提交时，用户可显式继续原命令及原不可变载荷；载荷改变则属于新的、明确确认的操作。已切库的旧命令只能作为原实例历史核对，不能迁入新库执行。

**恢复或切库：**关闭旧生产者和写连接，验证候选后切换唯一 active pointer，同时创建新资料身份。即使切回旧目录也取得新激活身份；旧回执仍带原来源身份用于历史查询，不充当新实例命令许可。断电选择规则仅在 [DATA §8.3](DATA.md#restore) 定义。

窗口关闭可保留应用后台运行；退出应用则关闭新写入/新外发入口，完成或安全终止本地任务后关闭后端。界面分别显示关窗口、停止任务和退出应用；退出失败不能显示已退出。完全退出时不承诺周期备份或任务继续，不安装 LaunchAgent/daemon。

### 3.2.1 Runtime 控制不能排在慢 SQL 后面

在现有 utilityProcess **内部**区分执行位置，不增加服务或第二业务后端：控制事件循环负责接收 stop/revoke、维护活的执行闸门和真实网络 handoff；一个写执行 worker 承载领域命令及唯一业务可写 SQLite 连接；有界只读 worker 承担重查询。控制循环不执行同步 SQL、大文件处理或大段同步解析。[S38、S40]

stop/revoke 到达控制器即关闭对应执行闸门，取消未交付步骤，不等待数据库队列、备份或索引任务。持久停止记录可以随后落盘；界面区分“后续派发已阻止”与“停止记录待确认”。即使随后崩溃，新的 backendGeneration 也不会恢复旧能力。正常事务内的最终业务权限检查仍由唯一写执行器完成；活闸门只收紧执行权，不另造可扩大权限的正本。具体 SQL/维护执行安排见 [DATA §1.1](DATA.md#database-execution)。

### 3.3 打包和更新

目标为 Developer ID 签名、公证的 macOS 应用。按 arm64/x64 分别构建和验证，只有两种产物都验证后才宣称同时支持；不依据用户代理字符串猜实际 CPU 或最低系统版本。最低 macOS 版本在第一阶段用 Electron 支持范围与真机验证确定，不在此虚构一个已测试版本。[S05]

首版采用**用户主动安装签名新版本**，不增加远程自动更新服务。应用退出/安装前提示未保存工作与备份；新程序按 DATA 的升级协议打开资料。后续可把同一更新边界换成受签名校验的 updater，但不得在编辑中强制重启、静默降级打开新 schema 或复活 AI 授权。Forge 负责打包；Vite 独立产出 bundle，不依赖仍标 experimental 的 Forge Vite 插件。[S06–S07]

<a id="backend-choice"></a>
## 4. Backend 路线比较与裁决

以下是基于冻结需求的工程判断，不是四种语言在 Career 上的实测排名。官方版本和能力依据见来源表。

| 维度 | A：Python | B：TypeScript / Node | C：Rust | D：混合方案 |
| --- | --- | --- | --- | --- |
| 复杂业务与状态 | 能胜任；需持续约束动态类型和模型边界 | 与 UI 同一业务语言；可用闭合联合类型表达未知/历史状态 | 编译约束强，但业务改动通常更重 | 业务分散两种语言后更难确认唯一 owner |
| AI / Search / 文件 / PDF | Python 生态很适合解析与本地科学计算；PDF 可另选引擎 | 当前需求主要是受控网络调用、资料处理；Electron 自带打印引擎可复用 | 网络与文件可做；AI/PDF 场景通常仍要接其他工具 | 真有 Python 独有能力再增加窄 worker，不能先加第二个业务后端 |
| SQLite | 成熟，SQLAlchemy 或显式 SQL 均可 | better-sqlite3 + Kysely 可用；须测原生依赖 | rusqlite/SQLx 路线可行；无需引入网络数据库 | 两套连接/迁移/事务 owner 容易成为长期负担 |
| 类型/Contract | Pydantic/OpenAPI 生成 TS，边界明确但有两端语义映射 | Zod Schema 只维护一套，仍需运行时校验 | Rust Schema 到 TS 生成，仍有跨语言表达差异 | 类型多不自动带来合同更一致 |
| 开发与测试 | pytest/FastAPI 路线直接，业务测试快 | 同一工具链覆盖合同、领域、界面；便于全栈切片 | 编译、原生异步及 FFI 对切片集成要求更高 | 同时维护 JS、Python/Rust 测试与打包矩阵 |
| Agent 修改冲突 | 按域组织同样可以很好；并非 Python 天生巨型 service | 前后端合同就近，少跨语言转换，适合本项目 | 可以并行，但不能把编译通过当产品正确 | 公共 bridge、schema 和打包文件更容易成为争抢点 |
| macOS 与维护 | 需冻结解释器/依赖；若 Tauri 壳还多 Rust 工具链 | Electron 已带 Node；主要额外原生模块是 SQLite | Tauri/Rust 打包自然；编辑/PDF 仍是 Web 技术 | 真实能力收益需大于 sidecar 监督、签名、升级成本 |

**保持 B。Career 当前最关键的工程压力是编辑器、快照、提案和事务的一致性；单一 TS 工具链减少跨语言合同与打包转换。** Python、FastAPI、Rust 均仍在维护，不存在“因为老旧所以淘汰”的依据。[S08–S12]

**Agent 编码能力的判断边界：** 本轮没有用同一组 Career 任务测量各语言的 Agent 成功率，因此不宣称某种语言必然“模型写得最好”。选择 TS 的实际收益是少一组跨语言 Schema/异常/构建转换；Rust 的编译约束也不能替代现实语义测试，Python 的灵活性也不等于无法保持严格边界。切片独立性主要由 owner 和 Contract 决定，而非语言决定。

**进一步比较混合方案：** Electron + Python 可以通过私有管道通信，不必开 localhost HTTP，也避免了 Tauri 壳的 Rust 工具链，是合理备选。但它仍需冻结和签名 Python 运行时、维护两端 Schema/异常映射；冻结需求没有指定必须依赖 Python 的处理能力，所以本轮不承担这份固定成本。Tauri + Node sidecar 则仍然携带 Node，并未消除 sidecar 生命周期与跨语言 bridge。两种混合方案都不应让 sidecar 再拥有第二份预算、密钥或数据库写入口。[S14、S37]

不引入 Fastify/Express/tRPC 服务端：当前没有 HTTP 业务服务器，强行加入只多一层。Contract-first 也不等于自己造通用 RPC 框架：仅实现本应用所需的请求、响应、状态通知、取消等待和持久命令查询。

**保留的混合扩展口：** 若未来规格确实要求专有 OCR、复杂文档识别或本地推理，可加只接收获准输入、只返回候选结果的 Python/Rust worker。它不拿数据库写权限、不决定正式事实、不另管 Key 或预算。现阶段不创建空 sidecar、双 ORM 或通用插件系统。

<a id="desktop-choice"></a>
## 5. Desktop 路线比较与裁决

| 路线 | 适合 Career 的部分 | 本轮未选/选择的关键代价 |
| --- | --- | --- |
| **Electron + Node 后端，选用** | 单一 Web 引擎覆盖编辑与 PDF；Node 与 UI 共用 TS 合同；生命周期、文件和秘密存储接口明确 | 安装体积和内存开销需实测；必须持续跟随 Chromium/Electron 安全更新；不把 Node 暴露给页面 |
| Tauri 2 + Rust 后端 | 系统 WebView、原生壳；本机文件能力清晰 | 将大量业务转为 Rust 并未解决本项目核心难题；系统 WebView/打印的一致性还需额外验证 |
| Tauri 2 + Python sidecar | Python 资料处理生态；壳相对薄 | JS、Rust、Python 三套链路；逐架构 sidecar、进程监督与签名复杂，PDF 还可能需要额外引擎 |
| 本地 Web + Launcher | 前后端接口直观，开发环境容易起步 | 需长期维护端口认证、浏览器生命周期、Launcher 与服务状态；可靠无打印对话框 PDF 又需独立渲染能力 |
| SwiftUI + WKWebView | 单 macOS 的原生集成有价值 | 重写主要交互为 SwiftUI 会放大富编辑器和设计迭代成本；混合 WebView 仍需 JS/Swift bridge；当前没有足够额外原生收益 |

**Tauri 不是不能用，也不是不能在 macOS 做自动化。** 当前 Tauri 文档已有基于 WebdriverIO 的内嵌测试方案；传统 tauri-driver 与内嵌方案的支持范围不能混为一谈。选 Electron 是本项目对统一编辑/打印链和较少语言运行时的取舍，不是利用过时信息否定 Tauri。[S13–S16]

<a id="frontend-choice"></a>
## 6. Frontend：少而清楚的工具组合

| 位置 | 明确选择 | 为什么适合 / 什么不做 |
| --- | --- | --- |
| UI | React 19.3.0 | 只构建客户端桌面 UI；不引入 Next.js、SSR、RSC 或 Server Actions |
| Router | React Router 8.4.0，客户端 Data 模式 | 管对象路由、返回、离开保护。loader 委托 Query，不另缓存一套正式资料；不使用其服务端框架部署模式 |
| Server State | TanStack React Query 5.103.1 | 按 workspace/对象/查询参数隔离读取缓存；写入仍由后端裁决，mutation 不自动重试 |
| 表单 | React Hook Form 7.89.0 | 用于对象表单、设置和对话框；不能替代 Resume 编辑器的文档/撤销模型 |
| Resume Editor | Tiptap 3.31.4 / ProseMirror | 受限结构化编辑；Career 自有文档格式和迁移。不开通云协作、AI 套件、任意 HTML 执行 |
| 样式与基础组件 | CSS Modules + CSS tokens；少量 Radix primitives 包在自有 Design System 内 | 不把大型主题框架铺到业务代码。Radix 按组件独立锁版本，不把 main 分支版本当 npm 已发布证明 |
| 动画 | CSS transition/animation，尊重 reduced-motion | 首版不装 Motion；复杂编排被真实设计要求证明后再接独立 Motion adapter |
| 测试 | Vitest 5.0.3、React Testing Library 16.3.3、Playwright 1.63.0 | 领域/组件/真实浏览器分层；Electron 测试 adapter 仍 experimental，单独封装且不能代替真机 IME 验收 |
| 构建 | Vite 8.3.2；Forge 8.0.1 仅打包 | 不为业务模块拆几十个包；原生 SQLite 模块不打进 renderer bundle |

TanStack Router 也可用，类型化路由是优点；当前导航复杂度不足以证明需替换熟悉的客户端 Router 或引入 TanStack Start。React Query 和 Router 的缓存职责不能重叠。Redux、全局业务 Zustand store、全站富文本编辑器、拖拽布局平台不进入基线。[S17–S27]

Gemini 后续只应主要修改 `frontend/design-system/`、`frontend/shell/`、feature 的 view/style 和受限 print-theme；不能通过视觉调整改变数据 owner、编辑生命周期、保存/授权动作。具体边界见 MODULES §7。

<a id="dependencies"></a>
## 7. 依赖方向与不可越线规则

```text
frontend feature → contracts + frontend 基础 UI/transport
frontend app composition → 各 feature 的公开 UI 入口

backend transport → 用例 / workflows / AI Runtime
workflows → 领域 public capabilities + Platform ports
领域用例 → 本域规则 + 本域 repository/外部能力窄接口
领域纯规则 → 本域模型 + 极少量稳定值类型
Platform adapters → SQLite / 文件系统 / 外部服务 / Desktop bridge

任何方向都不能：frontend → backend 实现
任何领域都不能：绕过其他 owner 直接写它的表
AI 模型/工具都不能：绕过权限门、Proposal 与 owner 正式写入
```

组合根只装配依赖，不判断“接受 Offer 之后是否 active”。领域不会 import React、Electron、Provider SDK。仓储与查询实现允许就近放在领域中；不把所有 SQL 移入一个全局 `database-service.ts`。

Contract、领域公开接口、Design System 接口是不同边界。Contract 负责跨进程可交换数据；内部 public capability 负责业务调用；不能为了“共享类型”把数据库行或整个 Domain class 暴露给前端。详细 API 协议在 MODULES，事务与历史在 DATA，AI 状态机在 AI-RUNTIME。

<a id="verified-stack"></a>
## 8. 2026-10 官方状态核对与选版

基线日期 **2026-10-02**。保留 V1 的已选版本和候选对比，本轮不重新进行全栈选型。V2 定向联网复核了 TypeScript 发布、SQLite 事务/FTS、better-sqlite3 worker、Node worker、ProseMirror history 和 Electron 44.5.1 safeStorage；其余版本数字沿用 V1 核对记录，未声称本轮逐库再次核验。整套组合与签名产物均未实测，必须经过 G0；不能用稳定发布标签代替兼容验证。

| 技术 | 官方可核对状态 | Career 裁决 | 依据 |
| --- | --- | --- | --- |
| Electron | 44.5.1 stable；内含 Node 24.21.0、Chromium 152.0.7977.130 | 基线 44.5.1；发布前复核安全补丁 | S01 |
| Node.js | 24 为 LTS；26 为 Current；可核对 24.21.0 | 开发基线 24.21.0；应用使用 Electron 内嵌 Node，不依赖用户系统 Node | S08 |
| TypeScript | 7.0.2 为稳定 7 系；6.0.3 为已发布稳定 6 系。7.0 不提供旧 compiler API | **默认 7.0.2**。G0 只有“具体依赖版本 + 实际使用功能 + 可复现失败”才能暂用 TS6，并记录回到 TS7 的负责人、触发条件和验证用例；泛泛 compiler API 风险不构成回退依据 | S09 |
| Python / FastAPI | Python 3.14.8；FastAPI 0.142.2；近期仍有发布 | 认真评估后不作为主后端；3.15 不按计划日期假定已稳定 | S10–S11 |
| Rust | 1.99.0，官方发布于 2026-10-01 | 主业务后端不选；不是因语言不成熟 | S12 |
| Tauri | 2.12.0 稳定；3.0.0 alpha 为预发布 | 本轮不选；不能把 GitHub 顶部预发布误称稳定 | S13 |
| Forge | 8.0.1 stable | 只管打包；独立 bundle，不使用 experimental Vite plugin | S06–S07 |
| React / Router | React 19.3.0；React Router 8.4.0 | 选用客户端模式 | S17–S18 |
| React Query | `@tanstack/react-query` 5.103.1 | 选用；仓库其他框架包的 6.x 不是 React Query 6 | S19 |
| RHF / Tiptap | RHF 7.89.0 稳定、8 beta；Tiptap 3.31.4 | 选稳定版本；不自动安装预发布 | S21–S22 |
| Radix | 官方 2026-07-20 仍更新；独立组件版本，Dialog main 元数据为 1.1.23 | 选组件体系，不声称 main 元数据等于已发布稳定包；G0 锁定实际发布版本，不阻塞业务架构 | S23 |
| Motion | 13.4.5 | 已评估；首版不用，CSS 足够 | S24 |
| Vite | 8.3.2；官方维护策略仍覆盖部分较早分支 | 选当前稳定 8.3.2 | S25 |
| Vitest / Testing Library / Playwright | 5.0.3 / 16.3.3 / 1.63.0 | 选用；Electron adapter 的 experimental 标记单列风险 | S26–S28 |
| SQLite | 3.53.4；3.52.0 已撤回；此前 WAL 修复已在后续版本包含 | 选 3.53.4；启动自检实际引擎版本与编译选项 | S29 |
| better-sqlite3 | 13.0.3；13.0.2 已更新到 SQLite 3.53.4；13 系使用 N-API | 选 13.0.3，真机验证二进制装载与签名，不能把 N-API 当兼容实测 | S30 |
| Kysely | 0.29.6 稳定；0.30 beta 不选 | 作为类型化 SQL 查询层，不让 ORM 模型成为业务合同 | S31 |
| node:sqlite | 最新官方文档仍标 Stability 1.2 / Release candidate | 不因“内置”切换到尚非完全稳定接口；这不是对 Electron 内嵌 Node 子版本的稳定性担保 | S32 |
| Zod | 4.6.5；支持 JSON Schema 导出 | 选用，跨进程 Schema 限制在 JSON 可表达子集 | S33 |

没有为 Career 运行性能/包体/内存/Agent 成功率基准，本文不填写虚构分数。没有验证真实 API Key、真实飞书、正式用户资料或生产迁移。组件维护情况由发布记录和官方支持说明判断，不由星标数量判断。

<a id="sources"></a>
## 9. 官方来源索引

S01～S37 是 V1 的官方来源索引，V2 保留。V2 本轮定向重新核对 S09、S35、S36 及新增 S38～S41；其他条目作为 V1 证据继承，不伪装成此次重查。技术证据不改变产品合同。其余文档 `[Sxx]` 均指此表；动态页面会变化，G0 需锁定实际发布版本与完整性。

| ID | 官方来源与用途 |
| --- | --- |
| S01 | Electron 稳定发布：`https://releases.electronjs.org/releases/stable` |
| S02 | Electron 安全边界：`https://www.electronjs.org/docs/latest/tutorial/security` |
| S03 | utilityProcess：`https://www.electronjs.org/docs/latest/api/utility-process` |
| S04 | webContents / printToPDF：`https://www.electronjs.org/docs/latest/api/web-contents` |
| S05 | macOS 签名与公证：`https://www.electronforge.io/guides/code-signing/code-signing-macos` |
| S06 | Forge 发布：`https://github.com/electron/forge/releases` |
| S07 | Forge Vite 插件 experimental：`https://www.electronforge.io/config/plugins/vite` |
| S08 | Node 发布生命周期：`https://nodejs.org/en/about/previous-releases`；24.21.0：`https://nodejs.org/zh-cn/download/archive/v24.21.0` |
| S09 | TypeScript 版本：`https://github.com/microsoft/TypeScript/releases`；7.0 compiler API 迁移说明：`https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/` |
| S10 | Python 下载与版本：`https://www.python.org/downloads/` |
| S11 | FastAPI 发布：`https://fastapi.tiangolo.com/release-notes/` |
| S12 | Rust 1.99.0：`https://blog.rust-lang.org/2026/10/01/Rust-1.99.0/` |
| S13 | Tauri 稳定版：`https://v2.tauri.app/release/tauri/v2.12.0/`；预发布辨别：`https://github.com/tauri-apps/tauri/releases` |
| S14 | Tauri sidecar：`https://v2.tauri.app/develop/sidecar/` |
| S15 | Tauri WebDriver 当前方案：`https://v2.tauri.app/develop/tests/webdriver/` |
| S16 | Apple WKWebView：`https://developer.apple.com/documentation/webkit/wkwebview` |
| S17 | React 官方版本：`https://react.dev/versions` |
| S18 | React Router 发布：`https://github.com/remix-run/react-router/releases`；运行模式：`https://reactrouter.com/start/modes` |
| S19 | TanStack Query 发布：`https://github.com/TanStack/query/releases` |
| S20 | TanStack Router 发布：`https://github.com/TanStack/router/releases` |
| S21 | React Hook Form 发布：`https://github.com/react-hook-form/react-hook-form/releases` |
| S22 | Tiptap 发布：`https://github.com/ueberdosis/tiptap/releases` |
| S23 | Radix 发布说明：`https://www.radix-ui.com/primitives/docs/overview/releases`；Dialog 元数据：`https://raw.githubusercontent.com/radix-ui/primitives/main/packages/react/dialog/package.json` |
| S24 | Motion 更新：`https://motion.dev/changelog` |
| S25 | Vite 版本：`https://github.com/vitejs/vite/releases`；维护策略：`https://vite.dev/releases` |
| S26 | Vitest 发布：`https://github.com/vitest-dev/vitest/releases`；维护策略：`https://vitest.dev/releases` |
| S27 | React Testing Library：`https://github.com/testing-library/react-testing-library/releases` |
| S28 | Playwright 发布：`https://github.com/microsoft/playwright/releases`；Electron experimental：`https://playwright.dev/docs/api/class-electron` |
| S29 | SQLite 变更/撤回/修复：`https://www.sqlite.org/changes.html` |
| S30 | better-sqlite3 发布与内嵌 SQLite：`https://github.com/WiseLibs/better-sqlite3/releases` |
| S31 | Kysely 发布：`https://github.com/kysely-org/kysely/releases`；迁移：`https://www.kysely.dev/docs/migrations` |
| S32 | Node SQLite 稳定性：`https://nodejs.org/api/sqlite.html` |
| S33 | Zod 发布：`https://github.com/colinhacks/zod/releases`；JSON Schema：`https://zod.dev/json-schema` |
| S34 | SQLite WAL：`https://www.sqlite.org/wal.html`；在线备份：`https://www.sqlite.org/backup.html` |
| S35 | SQLite FTS5/trigram/删除索引：`https://www.sqlite.org/fts5.html` |
| S36 | Electron safeStorage：`https://www.electronjs.org/docs/latest/api/safe-storage`；本轮同时核对选定版本的异步接口：`https://raw.githubusercontent.com/electron/electron/v44.5.1/docs/api/safe-storage.md` |
| S37 | Python 打包替代方案：`https://pyinstaller.org/en/stable/usage.html`；SQLAlchemy：`https://docs.sqlalchemy.org/en/20/intro.html` |
| S38 | better-sqlite3 官方慢查询 worker 用法：`https://raw.githubusercontent.com/WiseLibs/better-sqlite3/master/docs/threads.md` |
| S39 | ProseMirror 官方 history 实现与 closeHistory：`https://raw.githubusercontent.com/ProseMirror/prosemirror-history/master/src/history.ts`；API：`https://prosemirror.net/docs/ref/` |
| S40 | Node 24 worker_threads：`https://nodejs.org/docs/latest-v24.x/api/worker_threads.html` |
| S41 | SQLite 事务与 BEGIN IMMEDIATE：`https://www.sqlite.org/lang_transaction.html` |

## 10. 架构层面主动不做

不做微服务、独立消息总线、事件溯源框架、全局知识图谱、独立向量库、PostgreSQL、Redis、Kafka、云同步、通用插件市场或可执行用户脚本。数据库约束、事务、少量本地持久任务记录已足以满足已冻结压力。新增这些能力必须由新的真实需求证明，不能借“未来强 Agent”提前引入。

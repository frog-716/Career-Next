# 领域、owner 与两侧模块

本文件是领域归属、允许依赖、Contract 和前端状态分工的架构正文。运行进程与技术版本见 [ARCHITECTURE](ARCHITECTURE.md)，持久化细节见 [DATA](DATA.md)。业务依据仅为冻结 Requirement ID。

<a id="boundaries"></a>
## 1. 二维分层裁决

**用户提出的方向合理。调整的是少量业务支撑边界，不是一级导航。**

第一维保持 `Frontend ↔ Contract/API ↔ Backend`。第二维双方按业务组织，但不要求目录数量机械一致：前端有 Shell 和交互组件；后端有材料生命周期与 AI 权限。代码域不等于页面，也不等于进程。

| 边界 | Backend 负责 | Frontend 入口与归属 | 不负责 |
| --- | --- | --- | --- |
| Wiki | 各范围知识、知识修订/退役/恢复；手工 Cognition | 一级 Wiki；其他对象里的知识视图 | 对象身份/阶段；机会研究重复正文；自动全局认知 |
| Opportunity | 招聘机会及 Company、Research、Communication、Submission、Interview、Offer 子模块 | 一级机会，内部对应子区域 | 当前简历正文；真实任职；全局公司/人物 CRM |
| Project | 项目状态、任职归属、项目职责及参与历史 | 一级项目 | 人物身份、任职状态 |
| Employment | 真实任职、任职角色与 Person 身份 | 一级任职，内部人物入口 | 因接受 Offer 自动建任职；自动结束项目 |
| Resume | 当前 ResumeDocument、普通 ResumeVersion、导出快照与渲染任务 | 机会内打开独立 Resume 工作区；不是第五个一级入口 | 全局身份字段；实际已发送事件 |
| Profile（小型支撑域） | 当前本人身份资料 | Wiki 的辅助资料入口；Resume 纸面身份区的受控编辑 | 外部账号身份；历史文稿身份；职位经历事实库 |
| Materials（小型支撑域） | 独立 Raw 的身份、范围、原文版本定位、导入保存与材料清除规则 | 当前对象材料面板/导入流程；无全局 Inbox | 文件字节驱动；再次拥有 Communication/Transcript 原文 |
| AI Runtime（应用协调边界） | 任务、权限、Context、Proposal 生命周期和执行回执 | 辅助 AI 进度与每个业务任务入口 | 正式事实；通用自主 Agent 产品 |
| Platform / 应用辅助 | 文件、SQLite、搜索驱动、Provider、Secret bridge、备份；偏好和反馈各自小模块 | Shell、设置、反馈 | 通过 shared/service 吞并业务域 |

**保留四个一级入口：Wiki / Opportunity / Project / Employment。** Company、Interview、Offer、Person、Profile、Resume、Materials 都不会因代码独立而升成一级导航。（PR-03、UX-02）

### 1.1 Opportunity 的强边界子模块

保留 Opportunity 外层组织，Interview、Offer 作为其中的强边界子模块。**共用 SQLite 事务不赋予私有实现互访权，也不要求共享一份领域模型。**按变化原因分工：core 只拥有 Opportunity identity、phase、result、必要公共关系及相应变化/纠错历史；不保存研究内容、面试准备、谈薪正文或材料发送实现。

| 子模块 | 自己拥有的规则与数据 | 与 core 的最小关系 |
| --- | --- | --- |
| research | Company/Opportunity 的研究正文、条目、性质、核验、提升 | 查询 owner 与公司关系；内容变化不修改 phase/result |
| communication | 沟通原文、更正、后续发送活动 | 需要真实事件影响时调用 core 已公开的事件能力 |
| submission | 首次投递身份、当时材料及缺失语义 | 登记真实首次投递时组合 core 的阶段规则 |
| interview | 真实轮次、Simulation、排期/终态、Preparation、Transcript、Final Review | 真实轮次确认/纠错调用 core；模拟不推进招聘 |
| offer | 当前有效条件、原件、谈薪、不可变条件依据 | 接受及正式条件替换由组合用例调用 core；不另有 accepted 正本 |

每个子模块独立维护 Contract、规则、查询、写入能力与测试，均受 §6 的 public/private 约束。`opportunity/compositions/` 放同领域内的真实组合用例，调用子模块 `public.ts`，让同一个 UnitOfWork 贯穿全部修改。core 不 import 子模块私有仓储；子模块也不能直写 core 表或绕过其他子模块 owner。（DM-03～07、23～31、37）

新增面试准备字段只修改 interview 两侧与对应合同，不修改 core；只有阶段、结果或必要公共关系语义改变时才修改 core。该目录组织不新增一级入口、独立部署、独立数据库或产品对象。

### 1.2 Company / Research：招聘域中的共享对象，而不是某个机会的私有子记录

Company 在 `opportunity/company/` 中独立标识，可被多个 Opportunity 引用；不是复制到每个机会的一组公司字段。冻结规格没有要求它统一管理所有 Employment 的组织身份，不新增这条隐式关系。

`opportunity/research/` 统一实现研究规则，以 **Company 或 Opportunity 二选一的 owner** 持有当前 Research 文档及 ResearchItem。数据库和 Contract 都禁止 owner 同时为空或同时有两种值。公司级分享与机会私有研究在同一实现中通过明确 owner 隔离，而不是维护两套相似 Research 服务。

提升为 CompanyResearch 是显式改变内容归属的用例：校验公司/机会关系和目标依赖，在一个事务中变更该条目归属并在原机会留下引用；存在公司条目冲突时展示比较，不静默合并。稳定条目身份可以保留，旧引用按具体版本和历史归属解析。机会特有补充必须有不同含义，不能成为原正文的第二个编辑副本。提升不自动共享原机会的私聊、Raw 或历史私有版本；来源引用仍按原范围与具体权限解析，必要时显示不可读。（DM-02、08～10）

### 1.3 Person：Employment 内部模块

Person 只能属于一个 Employment。姓名不是主键，同名不合并。Project 保存的是对已确认 Person 的参与关系及项目职责，不拥有 Person 副本。一个人在不同任职中的记录不得自动被识别成同一全局自然人；未来若要统一人物视图，必须先有新的产品决定。（DM-18～20）

### 1.4 Profile：单独的小型业务支撑域

本人当前身份不是技术配置，也不应该私藏在 Resume 中。Profile 独立正本，同时以查询组合方式显示在所有当前简历。Resume 编辑身份区调用 Profile 命令，其他正文仍走 Resume 命令；这一分离防止“撤销简历内容”偷偷撤销全局电话修改。（DM-01、UX-06）

### 1.5 Submission / ResumeVersion：按“写文稿”和“现实发送”分界

ResumeVersion 归 ResumeDocument；Submission 归 Opportunity。一份来源版本可以被选择，但 Submission 接收其**独立留存的实际材料快照/文件引用**，不接管版本 owner。删除普通版本不能级联删除已经发送的独立材料。后续再次发送由 Communication 的发送活动保存，不制造第二条首次 Submission。（DM-22～25）

<a id="owners"></a>
## 2. 唯一 owner 清单

“唯一 owner”指有权裁决当前值和合法变化的模块；同一数据库内的另一张表、前端缓存或导出快照不因此取得修改权。

| 正本/状态 | 唯一 owner | 其他地方允许保存什么 |
| --- | --- | --- |
| 当前本人姓名、联系方式、链接 | Profile | 当前显示投影；历史快照内当时的值 |
| Company 身份、Opportunity→Company 关系 | Opportunity/company、Opportunity/core 各自拥有对应对象/关系 | 名称显示投影；冻结材料中的历史文字 |
| Opportunity 阶段、当前结果及纠错记录 | Opportunity/core | 时间线、计数、状态标签等派生展示 |
| Research 当前文档、ResearchItem 正文/性质/核验 | Opportunity/research，具体 owner 为 Company 或 Opportunity | Wiki 中的引用和只读卡片 |
| Communication 当前原文与纠正 | Opportunity/communication | 有版本的来源引用；不是 Raw 副本 |
| 真实轮次、Simulation、Preparation、Transcript、Final Review | Opportunity/interview 的对应对象 | 各对象互相引用；AI 草稿不成为第二份 Final Review |
| Offer 当前有效条件和原件 | Opportunity/offer | 条件分析草稿；每次接受的不可变依据 |
| 实际首次投递和后续发送活动 | Opportunity/submission、Opportunity/communication 分别拥有 | Resume 中的使用记录投影，不反向改写发送历史 |
| Project 状态/任职归属/项目参与关系和职责 | Project | Employment/Person 页面显示查询结果 |
| Employment 实际开始/结束、任职角色、Person 身份 | Employment | Project 保存参与时的角色历史，而不是竞争当前任职角色 |
| 独立 Raw 身份、所属范围及 DM-12 对应生命周期的原件或可更正正文 | Materials | 按实际业务语义处理；SourceRef 引用，文件层只保存字节 |
| WikiItem 正文、范围、类型、修订与退役 | Wiki | 来源可读状态/待复核提示；不维护业务状态 |
| 当前 ResumeDocument、命名版本、导出快照 | Resume | Editor 本地输入、Query 缓存、渲染输出 |
| Proposal 待处理/接受/拒绝、任务执行状态 | AI Runtime | 领域保存正式结果；UI 显示任务记录 |
| 首页置顶偏好 | 应用辅助 preferences | Shell 导航排序/首页投影；没有独立 defaultHome 字段 |
| 反馈记录 | 应用辅助 feedback | 反馈导出文件；不进入任何职业 Context |
| 文件内容、hash/尺寸、持久化结果 | Platform/files | 领域拥有“为什么保留该文件”与 retention 引用 |

### 2.1 正本、projection、cache、derived data

**正本**是业务当前值、具有独立意义的历史版本/发送材料、知识修订及现实变化记录。历史快照是“当时”的正本，不是与“现在”竞争。

**Projection** 包括机会时间线、阶段日期、项目列表上的任职名、Wiki 中研究卡片、Resume 纸面身份显示。只读、可重建；不允许通用 `updateTimeline`、`updateResearchCard`、`setStageFromUI` 写入口。

**Cache** 包括 React Query、FTS 索引、临时解析结果、渲染缓存、任务中间摘要。可丢弃；丢弃不改变现实状态。某个 PDF 一旦成为保留导出物或实际发送材料，就不再是“随便删的缓存”。

**Derived data** 包括活动计数、预算展示和保存状态的 UI 投影。预算裁决本身使用 Runtime 持久账本，不依赖前端显示数字。

### 2.2 最容易形成双正本的地方

| 错误做法 | 本设计的阻断方式 |
| --- | --- |
| Wiki 和 Research 都允许编辑“岗位负责什么” | 查询返回 ownerRef；编辑跳回研究 owner；不提供重叠 Wiki 正文写入通道 |
| Offer.accepted 与 Opportunity.result 各维护状态 | Offer 只持条件/有效性；接受记录与 Opportunity result 在同一用例事务改变 |
| 所有当前简历保存一份联系方式 | 当前简历只保存身份布局/占位；读取时组合 Profile |
| Transcript、Raw、复盘各保留“原始全文” | Transcript 是原文 owner；Raw 目录只解析它的来源引用；Final Review 是明确不同的理解正文 |
| Proposal 被接受后仍充当可编辑正式内容 | 正式内容写回目标域；Proposal 只保留处理身份和必要追溯 |
| 每个 Agent 写一套“机会状态推导” | core 提供唯一 phase/result 能力；组合用例以同一事务调用公开能力，禁止导入私有实现 |
| 同一个事件同时有独立可编辑 timeline 行 | 时间线查询组合已有记录；不建手工编辑时间线实体 |

<a id="relations"></a>
## 3. 关键基数与事务边界

| 关系 | 约束及裁决 |
| --- | --- |
| Company → Opportunity | 一对多；机会必须选定公司与岗位；同名公司由用户选择，不自动去重 |
| Company / Opportunity → Research | 各自最多一个当前 Research；多条稳定 ResearchItem |
| Opportunity → 当前 Resume / 首次 Submission / 当前 Offer | 各为零或一；由唯一约束兜底，不以“前端按钮隐藏”兜底 |
| Opportunity → Communication / 真实 Interview | 各零到多；不强制先有 Submission |
| 真实 Interview → Simulation | 零到多；模拟只能关联同机会真实轮次，不能关联另一模拟 |
| 真实 Interview → Preparation | 最多一个当前准备稿；真实/模拟 session 各有最多一个当前 Transcript、Final Review |
| Project → 当前 Employment | 零或一；过去的关系与参与历史另外保留 |
| Employment → Person | 一对多；每个 Person 恰属一个任职 |
| Project ↔ Person | 通过参与关系连接；当前候选限定为当前任职的已确认人物；参与期间与项目职责归 Project |
| ResumeDocument → ResumeVersion / ExportSnapshot | 一对多；版本和导出物不因被其他机会采用而更换 owner |
| Wiki / Research → 来源 | 多对多的版本化 SourceRef；关系不授予读取或外发权限 |

跨域用例放在 `backend/workflows/`，只建立真实存在的组合：Profile+Resume 快照、登记发送材料、项目换任职、AI 接受、资料清除。领域 public capability 接受同一个 UnitOfWork，不能偷偷单独 commit。业务事务中不等待 HTTP、PDF 渲染、用户操作或长时间文件复制。

CompanyResearch 提升和 Interview/Offer 影响机会结果放在 `opportunity/compositions/`，只组合公开能力，不为它们建立跨服务事件。需要刷新页面时发送已提交对象的最小失效通知；**通知不是事实变更指令**，漏通知可重新查询，不能导致数据库状态分叉。

### 3.1 真实事件与状态写入

前端提交“确认真实轮次”“补录首次投递”“接受当前有效条件”“纠正误结束”等命令，不提交任意目标状态组合。Opportunity core 依据事件含义裁决阶段与结果。已结束后的普通沟通不自动重开；晚录旧事件不倒退阶段；现实恢复与误操作纠正使用不同命令。（DM-04～06、33、35、39）

日期来自事件的实际日期语义，而不是数据库录入顺序。显示“首次面试日期”时不能把某个后补时间当系统自动补齐的历史；必要时显示日期未知或已知记录中的最早日期。只有真正在纠错的事件才修正其过去日期。

<a id="source-boundary"></a>
## 4. Raw / Wiki / Research / Proposal 的最小完整模型

```text
原件或可更正的原文（对应业务 owner）
             │ SourceRef：owner + 对象身份 + 版本 + 定位
             ├── 用户当前理解 → Wiki 或 Research（按内容归属）
             ├── 明确资料快照 → Resume 历史 / 实际发送 / 接受依据
             └── 获准 AI 任务 → Proposal → 用户接受 → 目标域正式写入
```

Materials 只拥有独立 Raw 的身份、范围及对应生命周期。生命周期由 DM-12 的业务含义决定：需要留存的原件按原件规则处理，可更正正文按更正规则处理，冻结材料按冻结规则处理；不能因名字叫 Raw、来自导入或某种文件类型，就一律开放普通编辑。Communication、Transcript、Offer 原件、发送材料由各自业务模块拥有。平台建立**代码级 SourceResolver 注册目录**，路由到实际 owner；注册目录不保存第二份正文，也不镜像一份可独立编辑的“当前事实”。SourceRef 可识别旧版本已不可读；不拿最新正文冒充旧版本。跨入口使用已有 Communication/Transcript 时携带其原身份；外部导入保留连接账户/文档的稳定来源身份用于复用判断。已经确认是同一原件的内容复用原 Raw；无法确认的本地文件只提示候选、由用户确认，不凭同名路径或 hash 自动合并。明确导入新版本仍受相应材料的更正/冻结规则约束。

真实 Interview Transcript / Final Review 在明确获准后，可以向 Company/Opportunity 的研究 owner 产生受控 Research Proposal；不要求为使用已有材料先做公网 Search。AI 提升/写入仍走用户审批，真实材料与模拟材料路径分开（AI-02、J-05）。

Research 描述公司/机会当前理解；Wiki 描述冻结范围允许的长期知识和个人判断。Proposal 描述尚待处理的变更，不是知识库。SearchRun 只证明本次搜索返回过什么，不代表条目已核实。Raw 保存不触发自动建 Wiki、Person 或 Profile。

确实改变来源的命令，在同一资料事务内更新必要的依赖标记或可重算依赖输入，使当前相关陈述显示待复核；不自动改陈述正文。Wiki 范围明确区分 Project、Employment、Opportunity、已确认 Person、Personal、Cognition；机会私有 Wiki 不自动进入全局长期知识默认列表。手工无来源的 Wiki 是合法用户记录，不为凑格式伪造 Raw。敏感清除需覆盖上述所有容器，细节由 DATA §7 统一定义。（DM-10～15、AI-06、16、18）

<a id="contracts"></a>
## 5. Contract/API：唯一 Schema，分别实现

### 5.1 正本与生成

`contracts/<domain>/` 中的 **Zod JSON 可表达 Schema** 是跨进程契约正本；类型由 Schema 推导，JSON Schema 与操作清单按模块生成。禁止手写另一份 DTO，禁止从 ORM 类型或后端业务函数反射出面向 UI 的接口。[S33，见 ARCHITECTURE 来源表]

普通业务 Contract 包只含请求、响应、判别联合、操作名、可见错误及必要值类型；不含数据库访问、领域状态转换、React、Electron、Provider SDK 或 secret 明文。新 Key 的一次性输入使用单独的 Desktop 只写输入协议，见 DATA §9；它不进入通用 command/envelope 或配置 DTO。日期、未知值、来源性质用显式闭合结构，不跨边界发送 Date、BigInt、Error 实例或带原型对象。

各域维护自己的 `manifest` 与 Schema。总客户端、总路由、总注册表在构建时确定性生成并忽略提交；feature 分支不提交或手工合并同一个总生成文件。需要提交的 JSON Schema 等按模块稳定分片，集成构建校验与聚合，详见 DELIVERY §3。跨域稳定公共结构仅限 OwnerRef、SourceRef、业务时间、命令回执与通用协议错误；领域特有状态仍放本域，不能堆成 `shared/types.ts`。

### 5.2 最小传输协议

| 概念 | 负责解决什么 |
| --- | --- |
| protocolVersion | 前后端发布合同版本一致性 |
| workspaceInstance | 资料与命令回执归属；普通 backend restart 不变，restore/switch 变更 |
| backendGeneration | 每次启动改变；废止旧 executor、生产者、文件/Secret 内部能力 |
| connectionGeneration | 识别当前 MessagePort；旧端口消息不可混入新连接，不充当任务 owner |
| requestId | 一次传输的响应关联；不用于判断真实操作重复 |
| commandId + operation + payload digest | 本次不可变本地写意图的幂等身份；相同 ID 不同内容拒绝 |
| expected revision / dependency set | 普通保存比较当前版本，Proposal 比较实际字段/来源/关系依赖 |
| result receipt | 已提交结果、owner、revision；返回正文仍须通过当前权限和清除检查 |
| trusted actor envelope | 接入端附加可信来源与当前身份；客户端 userApproved 不构成权限 |
| committed notification | 只提示对象/任务版本变化；接收者重读，通知不承担事实提交 |

三身份由受信握手/接入端绑定，业务 JSON 无权替换。进入后端时校验 Schema 与身份；排队命令执行前以及正式事务内再次校验当前写权限、目标和依赖。旧连接命令已提交的事实不因断线撤销；尚未获准执行的旧连接命令不能在重连后自动获得新许可。连接失效、权限修改与已开始事务存在明确顺序：已在线性化点进入的本地短事务可提交，后续命令被拒绝；不能声称能撤销已经完成的写入。所有网络 handoff 仍独立接受 Runtime 活闸门检查。

输入由后端校验，响应由前端 transport 校验。业务错误不返回堆栈、SQL、绝对路径或 secret。大附件用用户选择的短期文件能力，不允许任意路径或重复复制的大 JSON。

新端口 ready 后，前端先按原 workspaceInstance/commandId 查询未决回执，不自动重放写命令。已提交只重读；尚在途等待或显示状态；确认未提交后，用户可以明确继续同一不可变意图。切换 workspace 后旧意图不得执行到新实例。dirty 输入与未决列表留在原 session 供比较，失联查询不能覆盖它们。只有普通只读查询可以按受控策略重试；外部 AI unknown 不能套用查询重试机制。

### 5.3 可替换但不架空合同

测试使用相同 Schema 的内存 transport；生产使用 private IPC。纯前端 mock 只能作为开发替身，不能作为联合验收证据。Contract 发生破坏性变化时标明协议版本，前后端产物必须成套发布；本地桌面没有必要长期兼容任意旧客户端。

<a id="module-interfaces"></a>
## 6. 允许依赖与公开接口

每域及 Opportunity 的每个强边界子模块提供小型 `public.ts`，仅暴露已存在的用例/查询/能力类型；实现留在本模块。import 边界检查同时作用于域间与 Opportunity 子模块间。事务上下文是调用参数，不是全库写权限；公开能力不能泄漏私有仓储或可写表句柄。

| 调用者 | 可以依赖 | 禁止 |
| --- | --- | --- |
| 领域纯规则 | 本域模型、少量稳定值类型 | Electron、React、SQLite、网络、其他域私有模型 |
| 领域用例/仓储 | 本域规则、注入的事务/文件等窄接口 | foreign domain repository；直接写其他 owner 的表 |
| 跨域 workflow / Opportunity composition | 对应 owner 的 public capability，共享 UnitOfWork | 跨私有 import、直接写 其他 owner 的表、复制领域规则 |
| AI Runtime | 已登记任务策略、Context 读取端口、Proposal 校验/生效端口 | 全库 SQL、任意文件、通用 JS 执行、用户确认能力 |
| Frontend feature | Contract、自有 query/form/editor、Design System | backend import；其他 feature 私有 hook/store |
| Frontend app composition | 各 feature 公开 UI、导航 Contract、Shell | 定义 Offer/Project/Proposal 的业务状态规则 |
| Platform adapter | 具体技术 SDK/驱动、其窄端口 | 以底层能力为由修改业务含义 |

跨域读取优先调用 owner 查询能力。必要的组合列表通过 `read-models/` 依赖 owner 导出的只读查询/view 合同形成，不开放任意跨域 join 权限。数据库写入归属由目录 import 约束、查询层句柄范围和事务测试共同保证；TypeScript 类型不能当成对恶意本地进程的安全沙箱。

前端 feature 之间不循环 import UI。组合页面由 app composition 注入各 feature 的公开视图；来源卡片可展示 Contract 的只读 DTO，编辑动作导航到 owner。Opportunity 和 Wiki 都能展示同一知识，不需要互相 import 对方页面树。

<a id="ui"></a>
## 7. UI 系统与连续编辑边界

### 7.1 三层，而不是一套“大组件包”

| 层 | 拥有什么 | 允许视觉精修的部分 | 不应知道什么 |
| --- | --- | --- | --- |
| Design System | tokens、字体/间距、基础控件、焦点/弹窗/可访问性规则 | 色彩、密度、组件反馈、基础 Motion | Opportunity.phase、Proposal.apply、数据库 |
| Shared Shell | 四入口、窄侧栏、辅助入口、全局 overlay 容器、导航与反馈承载 | 侧栏与常显短标签、响应布局 | 领域状态转换、简历正文、外发权限裁决 |
| Feature | 当前业务对象、表单/查询/编辑 session、来源展示与动作文案 | 业务视图的布局样式、受控动画 | 其他 feature 的私有状态 |

AIHOT 和 ChatGPT 仅作为用户已冻结的视觉方向，不抓取其实现、不引入其产品功能。本轮没有视觉稿。Gemini 的调整应留在这三层相应位置；`print-theme` 可以变，但改完必须重验 PDF，不追改历史 PDF。

### 7.2 Frontend 状态 owner

| 状态 | 唯一前端 owner | 保存/恢复边界 |
| --- | --- | --- |
| 正式业务读取缓存 | feature-local React Query keys | workspaceInstance + 对象 ID + 查询参数隔离；握手后核对版本，旧连接结果不可污染新会话 |
| 未提交表单 | 当前 feature 的 form session | 保存/丢弃/比较明确；晚到 query 不覆盖 dirty 值 |
| 当前 Resume 选区、格式、撤销栈 | Resume editor session | 历史面板开关、Shell 折叠、反馈 overlay 不重建 session |
| 筛选、排序、列表位置 | 该 feature 的路由参数 + session view-state | 同会话合理保持；不承诺刷新后恢复未保存输入 |
| pinned module | 后端 preferences；Shell 只读取 | 唯一字段同时派生排序和默认首页；无置顶为 Wiki |
| 焦点/弹窗层级 | Shell overlay manager + feature 返回焦点引用 | 控制互斥快捷键与恢复；不含领域数据 |
| AI 运行/提交结果 | 后端任务记录；UI 只订阅和查询 | 关闭页面不改任务事实；失联时不猜成功或失败 |

返回“所属机会”、返回来源、返回列表、浏览器后退是不同动作；不得用一个 `goBack()` 猜测全部语义。对象消失显示不可用，不跳到“最近一个”冒充。（UX-03、15）

### 7.3 Resume 编辑器与 Profile 的交界

Resume 身份区调用 Profile 命令，正文调用 Resume 命令。两个窗口分别比较 Profile revision；非 dirty 身份显示可刷新，dirty 值保留比较。Profile 修改不进入正文 undo，不因恢复旧文稿而回滚当前电话。（DM-01、UX-06）

**本轮选定“短暂保护 Apply 涉及范围”方案，不引入协作编辑平台。**

| 阶段 | 编辑器处理 |
| --- | --- |
| 准备 | 等待中文 composition 结束及已有正文保存回执；保留 editorSessionId、稳定 block ID、已知基线和本次 commandId |
| Apply 在途 | 暂时保护本次写集合涉及的区块及会移动/删除它们的结构操作，含相关 undo/paste；其他区块仍可输入。该 Resume 的普通 autosave 排队，输入留在本地；Profile 独立处理 |
| 同期非相关输入 | 记录本地编辑步骤；服务端结果按稳定 block ID 和编辑映射定位，只有能够证明不相交才组合。不能按旧字符偏移盲插 |
| 后端成功 | 按原 commandId 仅处理一次，取得该事务提交前后授权正文快照或可完整重建它们的差异及 revision。核对本地已保存基线后才映射 patch；保留同期 dirty 输入，不直接把旧本地整稿标成新 revision |
| 后端冲突或无法可靠映射 | 保留全部当前输入及原基线，展示用户草稿/当前正式内容/提案差异；不全量 setContent、不清空 session、不隐式更换来源或 rebase。新的保存需用户选择后建立已知基线 |
| 结果未知/重连 | 查原回执，不能再接受一次。可以离开并保留当前会话草稿或进入比较处理；不得无限以 spinner 代替状态。该目标正式保存要先核对结果，避免覆盖可能已经成功的 Apply |

若提交前的服务端文档已包含另一窗口的变更，与本地已保存基线不同，先保留输入并比较；只有可证明不相交且无歧义的映射才能继续。禁止仅收到 Apply 的新 revision 就把旧本地整稿作为 autosave 发送，否则会覆盖其他窗口的修改。后端已 accepted 的事实仍保留，前端比较不再次接受 Proposal；用户确认合并/采用后才建立新的已知保存基线。

范围保护仅是前端防错措施，跨窗口并发仍由同一正式事务内的依赖检查裁决。若不能保证某个结构操作不触及保护范围，暂时禁止该操作并解释原因，不阻止无关区块输入；未采用的提案保持 pending。

**撤销组必须显式隔离。**采用建议前关闭上一 history group；把该次确定 patch 作为一个允许进入 history 的 editor transaction；在下一用户输入前再关闭分组边界。使用适配器封装 ProseMirror `closeHistory` 等能力并测试，不依赖“单事务”、500ms 间隔或相邻输入自动合并规则。[S39] 一次撤销只撤该次 AI 内容变化，不带走前后用户输入。撤销会产生新的人工保存，后端 Proposal 保持 accepted；重复通知/回执不能重复插入 undo 项。

History 使用独立只读预览，不替换 live editor 文档、不 remount、不改变其 key、选区或撤销栈。仅浏览、开关、取消恢复均不执行历史重置。用户确认恢复才以当前基线提交，并独立构成一个 undo group；恢复只处理文稿/布局，不把旧 Profile 值写回全局。

命名版本/PDF 导出必须明确携带选定的 Resume revision 与 Profile revision；后端在同一短事务内校验并冻结二者。不能先看到 A，后端再取“当前最新”B。此后内容变化不改 job；晚到 PDF 归原冻结快照，来源/目标已清除则拒绝持久化，详见 [DATA §4.2](DATA.md#pdf-snapshot)。

自动保存感知 composition、dirty revision 与在途请求；旧回执不能把新输入标成已保存。Cmd+S 命名、Cmd+F 当前文稿查找、纸面选择、替换、焦点返回和 A4 溢出必须真机验收；同会话连续 undo 的保证不扩张为重启后永久恢复 undo。

### 7.4 保存成功、保存未知和读取失败分开

后端明确返回已提交 → 即使后续查询失败也显示“已保存，刷新读取失败”，只重读。传输中断不知道是否提交 → 显示保存结果待核对，查询原 commandId。冲突 → 提供当前正式值/用户草稿的可理解比较，继续保存必须以新的已知基线明确提交，不盲目 force overwrite。

延迟的 A 对象请求只更新 A 的 cache 与 receipt；用户已切 B 时不能改 B 的表单或弹窗内容。刷新/崩溃只保证已经提交的内容；没有声称未保存输入或撤销栈永久可恢复。（UX-04～05、15）

### 7.5 反馈独立，不采集职业正文

反馈是辅助模块，不是业务工作流。overlay 打开不卸载底层编辑 session。只自动带允许的最小 route/应用版本；截图由用户选择，不自动抓取正在编辑的内容。记录支持查看、修改、导出、归档、清除，保存命令同样幂等；Context 源目录中没有 feedback/logs/debug-chat 的读取端口。（UX-11、AI-16）

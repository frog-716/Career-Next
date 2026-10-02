# 开发切片、并行集成与验收门

**本轮只交付设计，不执行以下计划。** 不创建新 Career 仓库、不安装 Skills、不生成业务代码、不调用真实 AI/飞书、不迁移用户资料。当前架构状态为 **READY FOR FINAL ARCHITECTURE REVIEW**；架构审查通过并获得实施指令后，才开始本文件中的工作。

<a id="skeleton"></a>
## 1. 未来仓库骨架

一个仓库，四个粗粒度 workspace：`contracts`、`frontend`、`backend`、`desktop`。业务模块是目录，不是独立发布的 npm 包。不加入 Turborepo/Nx、微服务部署目录或通用插件 SDK；先使用普通 workspace 与确定性构建脚本。

```text
Career/
  rebuild-spec/                 冻结产品合同，原文只读
  architecture/                 本包五份正文与必要 ADR
  AGENTS.md                     未来建立：操作规则与工作区边界，不复写产品合同
  MAP.md                        未来建立：需求→业务切片→测试位置的导航
  contracts/
    common/                     OwnerRef / SourceRef / BusinessTime / 协议回执
    wiki/
    opportunity/
      core/ company/ research/ communication/ submission/ interview/ offer/
    project/
    employment/
    resume/
    profile/
    materials/
    ai/
    application/                偏好、反馈、备份状态等辅助 API
    generated/                  按模块提交的 Schema 分片；总 client 在构建目录生成
  frontend/
    app/                        根装配、组合页面、生成路由装配
    shell/                      四入口、导航、overlay、辅助入口承载
    design-system/              tokens / primitives / 可访问性 / motion 边界
    transport/                  Contract transport，不含领域判断
    features/
      wiki/
      opportunity/
        core/ company/ research/ communication/ submission/ interview/ offer/
      project/
      employment/
        people/
      resume/
        editor/ history/ proposals/ view/ print/
      profile/
      materials/
    support/                    settings / feedback / ai-progress / backup
    generated/                  总路由构建时生成并 gitignore，不作为分支合并对象
  backend/
    bootstrap/                  main 组合入口与生命周期，保持薄
    transport/                  私有 IPC handler / actor 注入 / schema 检查
    workflows/                  少数跨域事务；按具体用例分文件
    domains/
      wiki/
      opportunity/
        core/ company/ research/ communication/ submission/ interview/ offer/
        compositions/           同领域公开能力组合，仍禁止导入私有实现
      project/
      employment/
        people/
      resume/
      profile/
      materials/
    ai-runtime/
      authorization/ context/ dispatch/ proposals/ recovery/
    platform/
      database/ files/ providers/ search/ imports/ secrets/ backup/
                                database 含唯一写 worker 与受限只读任务入口
    application/                preferences / feedback / 只读组合 read-models
    generated/                  总注册装配构建时生成并 gitignore，不放业务规则
  desktop/
    main/                       实例、窗口、后端监督
    preload/                    窄能力桥，不暴露任意 IPC
    capabilities/               文件选择 / secret / PDF / 生命周期
    packaging/                  Forge、签名、公证、产物校验
  tests/
    contract/                   跨进程正反例，非领域测试大杂烩
    integration/                跨 owner 事务、回执、备份和恢复
    journeys/                   J-01～J-09 / AC 分支追踪
    desktop/                    真机输入/焦点/PDF/签名应用验收
  tooling/                      构建、边界检查、生成、迁移发布装配
```

每个领域/子模块通常按需要拥有 `model/rules`、具体 `commands`、`queries`、`repository`、`public.ts`、`manifest`、`migrations/` 和就近测试。**不要求每个小模块先创建八个空目录**；代码少时合并文件，出现独立变化压力再拆。同样不允许为了减少文件数把所有命令挤进一个 service。

本包没有实际生成以上骨架；示意中 AGENTS/MAP 是未来维护导航的方案，不是安装 guardrails/Matt Skills 的指令。

<a id="slices"></a>
## 2. 一个业务功能通常修改哪里

| 功能例子 | 主要修改面 | 原则上不应修改 |
| --- | --- | --- |
| Wiki 知识退役/恢复 | contracts/wiki、frontend/features/wiki、backend/domains/wiki、就近测试 | Electron main、Resume、全局 shared service |
| Interview 待排期/改期/纠错 | contracts/opportunity/interview、两侧对应子模块、Opportunity core 的已有状态接口测试 | 全局 Router 手写注册表、Offer 全文 service |
| Project 换任职 | contracts/project、project 两侧、一个明确跨域 workflow；Employment 公共查询契约已存在则直接使用 | Person 复制/全局去重、Employment 私有仓储 |
| Resume 采用 AI 后撤销 | contracts/resume 与相关 proposal 协议、Resume editor/session、Resume owner、AI 接受集成测试 | Shell 状态大对象、其他领域表 |
| CompanyResearch 提升 | opportunity/research 命令/查询/合同/界面；必要公司归属验证 | Wiki 第二份正文、全局事实表 |
| 视觉密度/侧栏 Motion | design-system、shell、feature view/style | 领域状态机、事务、Provider、AI 权限 |
| 新 LLM adapter | platform/providers、adapter 契约测试、明确配置 schema | Wiki/Resume 正式写入代码、授权根规则 |

正常切片只改自己的合同片段、两侧业务目录和就近测试。跨域功能可以触碰明确的集成文件，但先注明涉及的 owner 和依赖，不能假装所有功能都能零冲突并行。

<a id="public-hotspots"></a>
## 3. 稳定公共接口与冲突热点治理

| 潜在巨型文件/热点 | 避免方式 | 谁负责变更 |
| --- | --- | --- |
| `main.ts` / `App.tsx` / bootstrap | 只组合已注册模块；业务注册由各自 manifest 经构建聚合 | 基础集成负责人；模块 Agent 不逐项追加业务逻辑 |
| 全局 `router.ts` | 各 feature 路由 manifest + 生成装配；四一级入口固定在 Shell | 模块 Agent 改自己片段；Shell owner 检查一级导航 |
| `shared.ts` / `types.ts` | 只有少量 common 协议类型；领域 DTO 留本域 Contract | Contract owner 审查跨域新增项 |
| `service.py` / `business-service.ts` | 按具体业务对象/用例组织；不建万能 CRUD 服务 | 对应业务 slice |
| 全局 ORM schema | 模块 table 类型/仓储/迁移片段就近；只生成只读组合类型 | 模块 owner；正式迁移顺序由集成负责人串行确认 |
| 全局 query keys / Zustand store | feature-local keys、editor session 与 form；正式结果只在后端 | 各 feature |
| AI 巨大 task switch / tool list | 业务 TaskPolicy manifest、Runtime 固定的少量能力类别 | 任务策略归业务域，安全机制归 Runtime owner |
| 单一 CSS / 设计复制代码 | tokens/primitive 正本；feature CSS Modules | Design System owner 与各 feature |
| lockfile / 根依赖 / 签名配置 | 模块 Agent 提依赖请求，统一集成更新；不并行自动升级 | 集成负责人 |

**生成产物采用明确合并策略：**总客户端、总路由、总注册表由模块 manifest 在构建时按稳定顺序生成，放入 gitignore 的构建产物，不进入 feature 分支的手工合并。确需提交的 JSON Schema 等只按模块稳定分片，Agent 只改自己的片段；集成构建生成最终聚合。

生成器只做机械装配，不推导业务规则。CI 检查分片再生成一致、聚合确定性、操作 ID 唯一、Contract 正反例，以及域间和 Opportunity 子模块间的 import/写 owner 边界。不能用 any、关闭校验或扩大 bridge 消除冲突。

根 lockfile、根依赖、bootstrap、正式 migration 发布批次排序及签名配置由 integration owner 串行管理。模块 owner 提交依赖/接口需求与最小变更，由集成人合入；业务 Agent 不在每个分支自行升级根工具链。

### 3.1 Migration 并行编写，发布顺序串行

各域提交带全局唯一片段 ID、依赖和校验和的迁移片段；不要各自抢同一个 `0007.sql`。集成阶段为新发布生成一个**新的单调发布批次**，包含这一批尚未执行片段的固定顺序；Kysely migrator 只执行已经发布的有序批次。已发布批次和片段不可改写，修复走新迁移。[S31，见 ARCHITECTURE 来源]

全局 schema 版本、跨域外键依赖与不可逆转换由一个集成人确认。新增模块不能把一个字典序更早的迁移偷偷插到已执行历史前面；也不能让每域各自升级共享数据库然后宣称已集成。空库升级、上版升级、故障中断和不兼容拒绝均需测试。

<a id="sequence"></a>
## 4. 先串行什么，后并行什么

“先串行”指同一公共合同/关键路径有一个裁决 owner，不要求所有其他人完全停工。设计 tokens、测试场景、局部静态视图可以先做，但不能越过未确定的协议开始复制业务规则。

### G0｜架构审查后，先验证技术组合和真正桌面难点

建立最小可运行技术验证切片，而不是先批量生成业务 CRUD。验证 Electron utilityProcess、better-sqlite3 原生装载、签名/公证、私有 IPC、没有生产 HTTP 监听、受限打印、真实 macOS 中文输入/焦点、Zod 合同与 TS 工具链。

默认锁定 **TypeScript 7.0.2**，验证类型检查、Vite、Forge 配置、Vitest/Playwright、Zod 生成和原生 SQLite 打包的实际调用链。Radix 等锁实际已发布版本与完整性。

暂用 TS6 的唯一准入记录为：具体阻断依赖及版本、Career 实际使用的功能/调用点、最小复现输入、命令与 exit code、失败证据、TS6 能解除同一失败的证据、回到 TS7 的负责人和明确退出条件/回归用例。仅有“生态可能调用 compiler API”或工具未验证不够；不能无声引入双编译器。未复现阻断则继续 TS7。[S09]

G0 也验证控制循环不被 SQL/Keychain 提示阻塞、只写 Secret 通道不进入通用 recorder、arm64/x64 原生产物装载与签名身份。记录安装体积、空闲/双窗口内存、PDF 峰值和退出资源释放的真实测量，不填写猜测 MB。正式包检查无调试服务器、通用 IPC、测试后门或不必要 inspector；打印 renderer 无业务/Secret 权限，原生装载不能以无条件放开未签名库解决。

**通过条件：** 签名应用在声明支持的实际机器/架构启动，后端 ready 的证据真实，数据库可提交读取，生成中文可选文字 PDF，外部网页无能力调用；Electron 测试 adapter 的 experimental 限制没有通过削弱生产安全配置绕过。未通过就修技术组合，不进入大规模业务并行。

### G1｜只为第一个人工 vertical slice 完成最小骨干

**首个贯通两侧的切片：个人范围独立 Raw 的本地选择/预览 → 确认保存 → 回读，并能取消而不留空记录。**它使用冻结的 DM-11/12、AI-09、UX-04 语义；没有 AI 外发，不新建全局 Inbox。

先串行完成此切片真正需要的：三身份握手与可信 human actor；分模块 Contract；command/receipt；唯一写 worker/短事务及 owner 约束；Materials 单一路由的 SourceRef；受控 staging、publish hold、immutable blob、retention handoff 与故障回执；最小预览、保存未知/冲突/取消界面。材料生命周期按实际含义，不能默认为所有 Raw 可编辑。

清除/生产者协议先在架构中确定，此切片持久化路径预留真实准入检查并验证失效写回拒绝；**不要求完整 Purge UI、全部副本清理、Backup/Restore、全部 TaskPolicy、全部 Domain interface 在 G1 实现完毕。**未上线这些能力前，不展示虚假可用入口；上线生产者/清除功能时必须接真实协议，不能留下永远返回 true 的安全桩。

G1 退出条件是这一个真实 DB/文件/前后端切片通过，包括重复命令、文件失败、结果未知和 hold/GC 最小竞态。通过即开放业务并行。各域公共接口按下一切片需要就近确定，不先建设所有域的抽象平台。Opportunity core 和 Resume editor 核心分别有唯一裁决 owner，但不成为所有其他人工业务启动的前置大工程。

### G2｜核心业务切片并行

| 并行线 | 负责范围 | 已固定的依赖 |
| --- | --- | --- |
| W：Wiki + Materials | Raw 导入保存/来源、知识/认知、修订/退役/清除界面 | SourceRef、文件协议、权限读取接口 |
| E：Employment + Person | 真实任职、计划/实际日期、人物与任职角色 | BusinessTime、领域事务 |
| P：Project | 项目状态、参与职责、换任职和历史 | E 的 public 关系查询；实现未齐可用合同替身开发，但集成必须接真域 |
| O：Opportunity 主线 | 最小 Company/core 与对应人工界面；沟通、投递各守子模块边界 | core identity/phase/result 最小合同先稳定，不等待全部界面 |
| R：Resume + Profile | 连续编辑、当前身份、版本/导出、实际发送候选 | 文档 schema、打印桥、文件发布和 Profile 接口；人工编辑不等 AI 接受实现，后者随 G4 接入 |
| A：AI Runtime | 按首个 AI 场景接授权、Context、预算、外发、Proposal 和恢复 | 只实现当前任务所需 TaskPolicy/Target；与对应业务 owner 持续联调 |
| U：Design System / Shell / 辅助 | 四入口、偏好、反馈；备份/恢复/清除作为随后接入的受控子切片 | 合同 DTO、保存/冲突状态；相关能力上线时必须满足 DATA 协议 |

W 是一个组合工作线，不把 Materials 变成 Wiki 的私有仓库。R 内先串行稳定 editor session/文档格式，再把版本面板、导出界面等拆出并行；避免两个 Agent 同时重构编辑器核心。

### G3｜按最小 core 合同解锁，与 G2 重叠

Company/Opportunity identity、phase/result 及必要关系的最小公开合同和规则夹具稳定后，Research、Interview、Offer 立即分别开发两侧和测试。**不等待 Communication、Submission 或整条 O 线页面做完。**组合用例接公开能力，子模块 import 与表写边界同域间一致。对 core 的真实语义变更交 core owner 处理，新增面试字段不能顺手扩充 core。

Search/飞书 adapter 与上述业务可在 Contract 确定后并行；真实外部验收必须独立授权，默认开发测试用可控模拟服务，不带真实 Key 和个人资料。

### G4｜跨域事务集成

按以下接缝整合，不等“所有页面都做完”才第一次连接后端：Profile↔Resume；Resume↔Submission；Project↔Employment/Person；Research↔Wiki 引用；Transcript/Raw↔来源待复核；Proposal↔正式 owner；清除↔索引/文件/任务/备份。联调采用真实数据库和文件目录，不用纯 mock 声称通过。

### G5｜完整旅程与真实桌面连续性

按 §11 的 104 分支索引安排验证；本阶段执行已具备的普通产品分支和 J-01～J-09，安全/故障分支继续在 G6 收口。DM-32 保持条件性建议；正式迁移分支在独立 M 阶段验证，不能谎称 G5 已执行全部。无 AI 路径必须独立通过。真实 macOS 中文输入、快捷键、焦点、缩放、窄窗口、关闭/停止/唤醒、签名包 PDF 单独记录证据。

Playwright 浏览器与 Electron 自动化仅是不同证据层；生产硬化构建若不支持测试专用入口，不能为让自动化方便而向发布版开放 inspector/通用 bridge。保留真实签名应用的交互验收记录。

### G6｜故障、恢复与发布门

故障注入覆盖本地提交/回执丢失、文件 staging/blob/引用的每个切点、磁盘满、DB 忙、后端崩溃、任务撤销竞态、外部 A unknown/B/迟到 A、备份缺文件与额外文件、三身份重连、唯一 active pointer、所有受管理副本及清除后迟到写回。100 个机会/项目的列表导航与中文搜索用于检验信息增长，不冒充生产性能基准。

只有已执行的环境可以写 PASS；记录命令、exit code、短结论及必要证据位置。

### M｜正式旧系统迁移，独立另行授权

MG-01/02/03/06 及 MG-07 的正式迁移部分进入 M：先真实资料盘点，再隔离演练、语义核对、明确授权后实施。可以先用人工测试夹具开发适配器合同，但不能作为正式迁移分支通过证据。G6/J-09 普通恢复成功不替代 M。本轮没有读取旧仓或执行任何 M 阶段工作。

<a id="parallel"></a>
## 5. Agent 并行图

```text
最终架构审查通过 + 明确实施指令
              ↓
G0：TS7 / 签名桌面 / 原生 SQLite / IME / PDF / 控制路径验证
              ↓
G1：仅本地 Raw 预览、保存、回读所需的最小 Contract/事务/文件骨干
              ↓
├─ W：Wiki + Materials
├─ E：Employment + Person ──窄公开查询──→ P：Project
├─ O：最小 Company / Opportunity core 合同
│          ↓ 合同稳定即解锁，和 O 后续开发重叠
│          ├─ Research    ├─ Interview    └─ Offer
│          └─ Communication / Submission 各自切片
├─ R：Resume + Profile（editor 核心先由一个 owner 稳定）
├─ A：AI Runtime（逐个真实任务接 TaskPolicy/Target）
└─ U：Design System / Shell / 反馈 / 后续 Backup-Restore-Purge 切片
              ↕ 每个相关切片到位就联调，不等全部页面完成
G4：公开能力的真实跨 owner 事务 / 快照 / Proposal / 清除与副本
              ↓
G5：9 条旅程、普通产品分支、真实桌面连续性
              ↓
G6：安全/故障/恢复/签名发布；核对 104 分支的适用与证据状态

M：另行授权的正式迁移；不能用 G5/G6 普通恢复代替
```

### 5.1 worktree 规则

每个工作树使用独立测试资料库、staging、缓存与 Electron userData；不能共享正式用户库、应用单实例锁目录或真实凭据。CI 与默认测试禁真实外发，假数据明确标记；生产就绪不能用 Demo 成功替代。

每个 Agent 获得自己的需求 ID、允许写目录、公共 Contract 版本、依赖接口、验收分支。需要越界改目录时先提出有明确理由的接口变更；不通过复制外域代码“避免冲突”。根 lockfile、公共协议、正式迁移顺序、签名配置由集成人串行处理。

小 PR 按可验收行为合并；共同修改 Contract 时先合约后实现，保留兼容窗口或原子联动提交。变更后运行本域测试与受影响跨域测试，不要求每个微小 CSS 修改重跑真实外部服务，但不能跳过关键 owner/安全测试。

<a id="gates"></a>
## 6. 必须击穿的集成测试

| 接缝 | 必须可观察的结果 | 对应冻结分支 |
| --- | --- | --- |
| 不按理想顺序使用 | 无 JD 可建机会；直接面试/Offer 不造投递/日期；晚录不倒退 | AC-DM-02-01、AC-DM-04-01、AC-DM-05-01、AC-DM-25-01、AC-DM-33-01 |
| 接受后条件变更 | 30k 接受依据保留；正式换 25k 后 active/Offer；无原件可诚实记录 | AC-DM-31-01 |
| Profile/两窗口/简历历史 | 当前身份同步；dirty 输入不被吞；旧版本/发送材料不变 | AC-DM-01-01、AC-DM-01-02、AC-UX-06-02 |
| 连续 Resume 编辑 | 中文输入→采用单条→撤销→看历史取消→继续→导出；Proposal 不复活 | AC-UX-06-01、AC-UX-07-01 |
| 实际发送 A，当前稿 B | 登记选择 A；本次保存文件失败整次失败；历史文件丢失单列 | AC-DM-22-01、AC-DM-23-01、AC-DM-23-02、AC-DM-24-01 |
| 角色与项目换任职 | A 协作者变历史；B 重新选人；人物升职不改过去项目职责 | AC-DM-18-01、AC-DM-19-01、AC-DM-20-01 |
| Research 提升/Wiki 引用 | 提升后仅公司一个可编辑正文；Wiki 无第二份研究副本 | AC-DM-08-02、AC-DM-09-01、AC-UX-09-01 |
| 来源变化与清除 | 更正文稿不自动改结论；待复核准确；原文清除覆盖缓存/提案/备份说明 | AC-DM-13-01、AC-DM-38-01、AC-MG-04-02 |
| AI 冒充人工 | UI/manual API 路径仍识别 AI actor，不能自动保存/自批 | AC-AI-01-01 |
| 只读材料衍生外发 | 原文、摘要、片段、query 都不能超出独立外发范围 | AC-AI-07-02、AC-AI-08-01 |
| 撤销/子任务预算 | 缓存也停止后续使用；共享预算不重复花；无 Provider fallback | AC-AI-07-03、AC-AI-17-01 |
| Proposal 原子性/局部依赖 | Research 组选中全部或全不；不相关第二条仍可处理；接受立即生效 | AC-AI-10-01、AC-AI-10-02、AC-AI-11-01 |
| unknown 与回读失败 | A/B/迟到 A 各归其主；保存成功读失败不重写；未落盘不再生冒充 | AC-AI-12-01、AC-AI-13-01、AC-UX-04-01 |
| 恢复与 Secret | 恢复旧库不复活授权/旧 Key；备份无 secret；配置安全失败不降级 | AC-AI-14-01、AC-AI-14-02、AC-MG-05-01 |
| 无 AI / 反馈 / 生命周期 | 完整人工流程；反馈不吞输入；退出失败如实显示 | AC-PR-02-01、AC-UX-11-01、AC-UX-13-01 |

### 6.1 Reviewer 反例的新增实现验证

下列 RV 编号是实现测试定位，不是新增 Frozen Requirement/Acceptance；全部尚未执行。它们在 §11 的产品分支之外补强并发与故障证据。

| 反例 ID | 必须注入的执行顺序与断言 | 首次接入 / 收口 |
| --- | --- | --- |
| RV-P0-01 | Apply 准备看来源 R1；另一命令更正为 R2；最终事务拒绝，目标/Proposal/receipt 无半提交。覆盖每种产出与 Research 组；改无关区块仍可接受 | G4 / G6 |
| RV-P0-02 | 在 hold、rename、业务 COMMIT、handoff 各点暂停/崩溃并并发 GC；claim 后新保留被拒，旧 claim 不能删除新 incarnation；receipt 成功必有材料 | G1 / G4/G6 |
| RV-P0-03 | AI/parser/import/PDF 已读 A，在清除完成后返回含 A 的正文/摘要/文件；全部拒绝持久化。sink 已打开时必须排空/终止后才完成清除 | G4 / G6 |
| RV-P1-01 | 长中文短查询、无匹配、大正文、索引 merge、backup/压缩期间 stop/revoke 仍关活闸门；记录实际扫描行/字节、partial 和控制响应 | G0 / G6 |
| RV-P1-02 | DB 已提交但连接断；backend 重启后同资料身份查到原 receipt，旧 capability 无效；仅重连不重放；active pointer 每个切点断电只选一个已验证库 | G1/G4 / G6 |
| RV-P1-03 | Apply 在途同区块编辑保护、异区块输入保留；前后连续输入分别 undo；历史取消不重置；其他窗口先改无关区块时不得用 Apply 新 revision 覆盖其内容；导出起点改 Resume/Profile 时拒绝或固定原快照 | G4 / G5/G6 |
| RV-P1-04 | 实际输入敏感 A+公开 B，模型只引用 B；外发和清除仍包含 A；摘要再摘要/子任务/缓存同样不洗掉来源 | G2-A/G4 / G6 |
| RV-P1-05 | 输入/保存/失败/取消/卸载新 Key，抓取普通 DTO、Query、command recorder 与日志均无 Key；已存 Key 不能回读，旧撤销值不回退 | G0/G2-A / G6 |
| RV-P1-06 | 恢复留下旧库、失败候选、quarantine、failed backup、staging，清除计划全部可见；留一个副本就不报全清；发布备份无被排除正文残留 | G4 / G6 |
| RV-P1-07 | 证据 Raw 禁止普通覆盖、可更正 Transcript 仍可更正；真实 Review 无 Search 也产生受控 Research Proposal，模拟不能走该研究路径 | G1/G4 / G5 |
| RV-MODULE | import/表写测试拒绝 Research/Interview/Offer 穿透 core/彼此私有实现；新增准备字段无需修改 core | G3 / G4 |
| RV-DELIVERY | 两 feature 分支各改 Schema/manifest 后构建可确定性聚合，不手工合并总生成文件；G1 不等待全部平台能力 | G1/G2 / 持续 CI |

上述是优先级较高的跨域接缝，不取代全部 104 分支。测试实现按冻结 ID 建索引；不能只写源代码字符串断言、纯 Schema 检查或 mock 成功代替真实交互/持久化。

<a id="trace"></a>
## 7. 87 个 Requirement 的落点

本表只做定位，不复写产品正文。每个 Requirement 恰有一条主定位；§11 继续逐一定位 104 个分支。架构定位已经重新核对，运行验证状态统一为**未执行**。DM-32 维持建议状态：不加入估算引擎，若后续采纳展示建议再执行其条件性分支。

| Requirement | 主 owner / 架构落点 | 主要门 |
| --- | --- | --- |
| PR-01 | Desktop/Platform；ARCHITECTURE §3、DATA §1 | G0/G6 |
| PR-02 | 所有业务域的人工路径；AI 不是前置依赖 | G5 |
| PR-03 | Shell；MODULES §1、7 | G2/G5 |
| PR-04 | 各正式 owner；MODULES §2、4 | G4 |
| PR-05 | ARCHITECTURE §10、AI-RUNTIME §1/10 | G1/G5 |
| PR-06 | Design System/Shell；MODULES §7 | G2/G5 |
| DM-01 | Profile + Resume；DATA §4.1、MODULES §7.3 | G4/G5 |
| DM-02 | Opportunity/company/core；MODULES §1.2、3 | G2 |
| DM-03 | Opportunity/Resume；MODULES §3、DATA §2.1 | G2/G4 |
| DM-04 | Opportunity/core；MODULES §3.1 | G3/G4 |
| DM-05 | Opportunity/core；MODULES §3.1 | G2/G5 |
| DM-06 | Opportunity/core/communication；MODULES §3.1 | G4/G5 |
| DM-07 | Opportunity/communication；MODULES §4 | G4 |
| DM-08 | Opportunity/research；MODULES §1.2 | G3/G4 |
| DM-09 | Opportunity/research，Wiki 只读引用；MODULES §2.2 | G4 |
| DM-10 | Opportunity/research；DATA §3.1 | G3/G4 |
| DM-11 | Materials/来源实际 owner；MODULES §4 | G2/G4 |
| DM-12 | 材料实际 owner；MODULES §4、DATA §3.1/7 | G1/G4/G6 |
| DM-13 | 来源实际 owner + 引用域；DATA §3.1 | G4 |
| DM-14 | Wiki；MODULES §4 | G2/G5 |
| DM-15 | Wiki；DATA §3.1 | G2/G5 |
| DM-16 | Project；MODULES §1/3 | G2 |
| DM-17 | Employment；DATA §3.2 | G2/G5 |
| DM-18 | Employment/people；MODULES §1.3 | G2 |
| DM-19 | Project/participation；MODULES §2/3 | G4 |
| DM-20 | Project + Employment workflow；MODULES §3 | G4 |
| DM-21 | Resume；DATA §4.1 | G2/G5 |
| DM-22 | Resume；DATA §4.1～4.3/5，MODULES §7.3 | G4/G5/G6 |
| DM-23 | Opportunity/submission；DATA §4.3/5 | G4/G6 |
| DM-24 | Opportunity/submission；DATA §3.3 | G4/G5 |
| DM-25 | Opportunity/submission/communication；DATA §4.3 | G4/G5 |
| DM-26 | Opportunity/interview；MODULES §1.1/3 | G3/G5 |
| DM-27 | Opportunity/interview；DATA §3.2 | G3/G5 |
| DM-28 | Opportunity/interview；MODULES §1.1 | G3/G5 |
| DM-29 | Opportunity/interview；MODULES §2/4、AI-RUNTIME §5 | G3/G4 |
| DM-30 | Interview + Wiki Proposal；AI-RUNTIME §4.3 | G4/G5 |
| DM-31 | Opportunity/offer/core；DATA §4.4 | G3/G4 |
| DM-32 | Offer 条件性展示建议；不升级为必需计算能力 | 条件性 G5 |
| DM-33 | Opportunity 只读 projection；MODULES §2.1/3.1 | G4/G5 |
| DM-34 | Employment；DATA §3.2 | G2/G5 |
| DM-35 | Opportunity/core；MODULES §3.1、DATA §4.4 | G4/G5 |
| DM-36 | Project；DATA §3.1、MODULES §3 | G2/G5 |
| DM-37 | Opportunity/interview；MODULES §1.1 | G3/G5 |
| DM-38 | owner 清除 workflow / 受管理副本 / 写回闸门；DATA §7 | G4/G6 |
| DM-39 | 各现实事件 owner；DATA §3.1/3.2 | G4/G5 |
| DM-40 | BusinessTime 合同及各事件 owner；DATA §3.2 | G1/G5 |
| AI-01 | 可信 Actor + AI Runtime；AI-RUNTIME §2 | G1/G6 |
| AI-02 | 各域 TaskPolicy；AI-RUNTIME §5 | G2/G4 |
| AI-03 | Context；AI-RUNTIME §4.1 | G4/G5 |
| AI-04 | Wiki TaskPolicy；AI-RUNTIME §4.1/5 | G4/G5 |
| AI-05 | Interview TaskPolicy；AI-RUNTIME §5 | G4/G5 |
| AI-06 | 来源性质/Proposal；AI-RUNTIME §4.3/7 | G4/G5 |
| AI-07 | Authorization/dispatch；AI-RUNTIME §3/4/6 | G2-A/G4/G6 |
| AI-08 | Search adapter + research TaskPolicy；AI-RUNTIME §5.1 | G4/G6 |
| AI-09 | Materials/import adapter；AI-RUNTIME §5.2 | G4/G5 |
| AI-10 | Proposal + target owner；AI-RUNTIME §7 | G4/G6 |
| AI-11 | Proposal dependency set；AI-RUNTIME §4.2/7.2/7.3 | G4/G6 |
| AI-12 | ExternalOperation/receipt；AI-RUNTIME §8 | G4/G6 |
| AI-13 | Recovery；AI-RUNTIME §9、DATA §8 | G6 |
| AI-14 | Provider/Secret；AI-RUNTIME §6.1、DATA §9 | G0/G2-A/G6 |
| AI-15 | Context/egress；AI-RUNTIME §4.2 | G4/G6 |
| AI-16 | Context/actor；AI-RUNTIME §2/4/9 | G4/G6 |
| AI-17 | 根任务预算/dispatch；AI-RUNTIME §6 | G4/G6 |
| AI-18 | 输出校验/保留；AI-RUNTIME §7.1/9 | G4/G6 |
| UX-01 | Shell + 各 feature 空状态；MODULES §1/7 | G2/G5 |
| UX-02 | preferences/Shell；MODULES §7.2 | G2/G5 |
| UX-03 | feature navigation；MODULES §7.2 | G4/G5 |
| UX-04 | form/query + command receipt；MODULES §7.4 | G4/G6 |
| UX-05 | form/editor/overlay；MODULES §7.2～7.4 | G5 |
| UX-06 | Resume editor/Profile；MODULES §7.3 | G0/G4/G5 |
| UX-07 | Resume editor/overlay；MODULES §7.3 | G0/G5 |
| UX-08 | Resume/PDF/Submission；DATA §4 | G0/G4/G5 |
| UX-09 | Wiki/Research/source；MODULES §2.2/4 | G4/G5 |
| UX-10 | AI progress；AI-RUNTIME §3/6/8 | G4/G5 |
| UX-11 | feedback/overlay；MODULES §7.5 | G2/G5 |
| UX-12 | backup UI/Platform；DATA §8 | G4/G6 |
| UX-13 | Desktop lifecycle；ARCHITECTURE §3.1～3.3 | G0/G6 |
| UX-14 | Design System/真实桌面；MODULES §7 | G0/G5 |
| UX-15 | feature/editor session；MODULES §7.2～7.4 | G5/G6 |
| UX-16 | BusinessTime UI；DATA §3.2 | G5 |
| MG-01 | 独立正式迁移；DATA §8.4 | M（另行授权） |
| MG-02 | 独立正式迁移/历史 owner；DATA §8.4 | M（另行授权） |
| MG-03 | 历史记录只读；AI-RUNTIME §9、DATA §8.4 | M（另行授权） |
| MG-04 | backup/recovery；DATA §8.1～8.3 | G6 |
| MG-05 | Secret/authority；DATA §8.3/9、AI-RUNTIME §9 | G6 |
| MG-06 | 独立正式迁移；DATA §8.4 | M（另行授权） |
| MG-07 | 普通恢复与正式迁移分离；DATA §8.4 | G6 / M（另行授权） |

<a id="risks"></a>
## 8. 真正可能再次失控的架构风险

| 风险 | 早期信号 | 必须阻断 |
| --- | --- | --- |
| 双正本重新出现 | Wiki/Research 两个编辑框、Offer/result 两套 setter、每稿一份 Profile | owner 写边界与跨域事务测试，不靠文档劝告 |
| AI 从工具层绕过人工/外发边界 | generic execute、模型拿 UI user token、SDK 自动 retry、摘要丢权限 | 删除危险能力；可信 Actor、最终派发检查与反例测试 |
| 编辑器、PDF、Profile 互相破坏 | setContent 重建、接受不进 undo、旧版本恢复旧电话、PDF 按最新稿生成 | G0 与 R 线先打通连续编辑和快照，再并行美化 |
| 文件/备份与 DB 看似成功实则不一致 | 文件失败降级历史缺失、直接复制活 DB、清除漏 Proposal/FTS | 发布协议、完整性报告、故障切点和恢复演练 |
| 多 Agent 把公共层变成大杂烩 | shared types 暴涨、同改 main、域间直接 SQL、根 lockfile 冲突 | 合同片段、生成装配、明确接口 owner、发布迁移串行 |
| 桌面依赖长期不更新 | Electron 安全补丁拖欠、原生模块只在开发机工作 | 签名产物回归与依赖维护责任明确；不以锁版本永久逃避维护 |

## 9. 本轮交付边界和停止点

交付只有 architecture 目录中的五份正文与三份 ADR；没有另建技术选型报告、逐库 ADR、业务代码或新仓库。所有正式实现、真实服务、真实用户数据及迁移测试仍未执行。

**架构冻结状态：READY FOR FINAL ARCHITECTURE REVIEW。**

这表示审查发现已落实为修订后的设计合同及实现验证门；不表示反例已被代码测试击穿。V1→V2 变化、Reviewer 映射和逐分支核对继续列在本文件中，不新增报告文件。


<a id="revision-map"></a>
## 10. V1 → V2 与 Reviewer 整改定位

这是设计修订记录。下表的“落实”表示规则已写入本包正文和测试门，未表示运行验证通过。Electron / TS-Node / React / SQLite / utilityProcess 分进程 / 模块化单体 / Tiptap 适配器 / Career 文档语义 / Kysely / Zod / FTS5 / safeStorage 全部保留；不新增 Python sidecar、微服务、独立向量库、通用 Repository 或事件总线。

### 10.1 用户最小修改集

| 项 | V1 → V2 的具体修改 | 唯一主正文 |
| --- | --- | --- |
| V2-01 Apply | 事务外检查仅准备；当前权限/目标/真实来源/关键依赖/owner 修改/Proposal/receipt 同一正式事务 | [AI-RUNTIME §7.2](AI-RUNTIME.md#atomic-apply) |
| V2-02 Blob | 增加 durable publish hold，与 GC claim 互斥；正式事务内 retention handoff；原命令恢复、incarnation 防误删 | [DATA §5](DATA.md#file-commit) |
| V2-03 Purge | 按来源/目标清除代次拒绝迟到持久化；关闭/排空 sink 后才完成，覆盖全部生产者 | [DATA §7.2～7.3](DATA.md#persistence-fence) |
| V2-04 SQLite/control | 控制循环与唯一同步写 worker 分离；受控只读 worker、有界索引维护/backup；中文短查询限制实际扫描 | [DATA §1.1](DATA.md#database-execution)、[§6](DATA.md#search) |
| V2-05 Identity | 分开资料实例、后端启动、连接三种身份；普通重启保留回执归属、旧执行权失效；唯一已验证 active pointer | [ARCHITECTURE §3.2](ARCHITECTURE.md#runtime)、[DATA §8.3](DATA.md#restore) |
| V2-06 Editor | Apply 范围保护/异区块输入保留；冲突比较；显式独立 undo group；History 不卸载 session；导出绑定两种 revision | [MODULES §7.3](MODULES.md#ui)、[DATA §4.2](DATA.md#pdf-snapshot) |
| V2-07 Provenance | Runtime 根据实际输入及传递来源计算权限链，模型 citation 无法缩小范围；用于外发与清除 | [AI-RUNTIME §4.2](AI-RUNTIME.md#trusted-provenance) |
| V2-08 Secret | 新 Key 专用只写输入；已有 Key 仅私有 adapter 使用、禁止 UI 回读；不进入普通 DTO/cache/command/log | [DATA §9](DATA.md#secrets) |
| V2-09 Copies | 当前/旧 workspace、恢复候选、隔离、失败备份、staging 和全部派生容器统一登记；保留副本不能报全清 | [DATA §7.1](DATA.md#managed-copies) |
| V2-10 产品映射 | Raw 生命周期按 DM-12；真实 Transcript/Final Review 可形成受控 Research Proposal，无强制 Search | [MODULES §4](MODULES.md#source-boundary)、[AI-RUNTIME §5](AI-RUNTIME.md#task-types) |
| V2-11 Opportunity | core 收敛身份/阶段/结果/必要关系；Company 及五个内容/事件子模块各守 public/private/表写边界，事务不放宽 import | [MODULES §1/6](MODULES.md#boundaries) |
| V2-12 Delivery | G1 只交首个真实切片最小骨干；core 最小合同即可解锁并行；聚合构建生成，根配置/迁移排序归集成人 | [DELIVERY §3～5](#public-hotspots) |
| 版本调整 | 默认稳定 TS7.0.2；TS6 例外必须具体依赖/真实功能/复现失败/退出条件 | [ARCHITECTURE §8](ARCHITECTURE.md#verified-stack)、[G0](#sequence) |

### 10.2 Reviewer P0 / P1 逐项对应

保留 Reviewer 原编号。其第 5、6 节未单独编号的 P1 用原章节及条目号引用，不伪造新的 Reviewer 编号。

| Reviewer 发现 | 修订位置 | 验证定位与状态 |
| --- | --- | --- |
| P0-01 Apply 事务外校验 | AI-RUNTIME §7.2～7.3；DATA §1/5 | RV-P0-01，G4/G6；设计已修订，未执行 |
| P0-02 blob 与 GC 缺少保留交接 | DATA §5.1～5.4、§8.2 | RV-P0-02，G1/G4/G6；设计已修订，未执行 |
| P0-03 清除后迟到输出恢复正文 | DATA §7.2～7.3；AI-RUNTIME §6.3/8.1/9 | RV-P0-03，G4/G6；设计已修订，未执行 |
| P1-01 SQLite 阻塞控制/短查询无限扫描 | ARCHITECTURE §3.2.1；DATA §1.1/6/8.2 | RV-P1-01，G0/G6；设计已修订，未执行 |
| P1-02 三种身份/重连/active pointer | ARCHITECTURE §3.2；MODULES §5.2；DATA §8.3 | RV-P1-02，G1/G4/G6；设计已修订，未执行 |
| P1-03 接受期间输入/undo/导出起点 | MODULES §7.3；DATA §4.2 | RV-P1-03，G4/G5/G6；设计已修订，未执行 |
| P1-04 可信权限来源链 | AI-RUNTIME §4.2/7.1～7.3；DATA §7.2 | RV-P1-04，G2-A/G4/G6；设计已修订，未执行 |
| P1-05 新 Key 输入与保存后禁止回读 | DATA §9；MODULES §5.1 | RV-P1-05，G0/G2-A/G6；设计已修订，未执行 |
| P1-06 managed old workspace/备份残留 | DATA §7.1/8.2～8.3 | RV-P1-06，G4/G6；设计已修订，未执行 |
| P1-07 Raw / Review→Research 产品映射 | MODULES §2/4；AI-RUNTIME §5 | RV-P1-07，G1/G4/G5；设计已修订，未执行 |
| P1（Reviewer §5）：Opportunity 内部边界 | MODULES §1.1/6；DELIVERY §1～2/G3 | RV-MODULE，G3/G4；设计已修订，未执行 |
| P1（Reviewer §6①）：G1 不做大平台 | DELIVERY G1/G4 | RV-DELIVERY，G1/G2；设计已修订，未执行 |
| P1（Reviewer §6②）：最小 core 解锁并行 | DELIVERY G2/G3/§5 | RV-DELIVERY，G2/G3；设计已修订，未执行 |
| P1（Reviewer §6③）：生成物/根文件冲突 | MODULES §5.1；DELIVERY §3/5.1 | RV-DELIVERY，持续 CI；设计已修订，未执行 |

### 10.3 P2 与既有 ADR

P2-01 已改默认 TS7，例外须复现。P2-02 保留 Electron，G0/G6 记录资源与 arm64/x64 原生产物/签名/更新后 Keychain 行为。P2-03 的无调试服务器、窄 preload、打印隔离、发布安全检查已进入 G0/G6。P2-04 继续限制自有编辑语义、Kysely/UnitOfWork/SourceResolver 的职责，不扩成通用平台。

只更新 ADR-001、ADR-002、ADR-003：分别澄清唯一写入口/同事务最终校验，快照与文件保留交接，以及三身份/可信来源/清除不复活执行权。没有新增 one-way-door，**ADR 新增数为 0**。

<a id="acceptance-trace"></a>
## 11. 104 个验收分支的实施验证安排

每行对应 Frozen R3 `rebuild-spec/ACCEPTANCE.md` 的一个原始 AC ID，原文及条件仍为唯一验收依据；这里只补架构位置和执行阶段，不重写场景。首次门负责接入与局部证据，收口门负责跨域/真实桌面/故障证据。**下表全部未执行。**“G2-A”指 G2 的 AI 线；G3 与 G2 重叠；M 需独立正式迁移授权；DM-32 不提升为必需功能。

| AC 分支 | Requirement | 架构处理位置 | 首次验证 → 最终收口 |
| --- | --- | --- | --- |
| AC-PR-01-01 | PR-01 | [桌面隔离/控制](ARCHITECTURE.md#runtime) | G0 → G6 |
| AC-PR-02-01 | PR-02 | [所有域人工闭环](MODULES.md#boundaries) | G2/G3 → G5 |
| AC-PR-03-01 | PR-03 | [Shell/Design System](MODULES.md#ui) | G2-U → G5 |
| AC-PR-04-01 | PR-04 | [唯一 owner/来源性质](MODULES.md#owners) | G4 → G5/G6 |
| AC-PR-05-01 | PR-05 | [退役入口/非通用平台](AI-RUNTIME.md#evolution) | G2-A → G5/G6 |
| AC-PR-06-01 | PR-06 | [Shell/Design System](MODULES.md#ui) | G2-U → G5 |
| AC-DM-01-01 | DM-01 | [当前身份与历史快照](DATA.md#resume-data) | G2-R → G4/G5 |
| AC-DM-01-02 | DM-01 | [两窗口保留输入](MODULES.md#ui) | G2-R → G5 |
| AC-DM-02-01 | DM-02 | [Company/core 身份](MODULES.md#boundaries) | G2-O → G5 |
| AC-DM-02-02 | DM-02 | [Company/core 身份](MODULES.md#boundaries) | G2-O → G5 |
| AC-DM-03-01 | DM-03 | [真实事件/必要关系/阶段结果](MODULES.md#relations) | G2-O/G3 → G4/G5 |
| AC-DM-04-01 | DM-04 | [真实事件/必要关系/阶段结果](MODULES.md#relations) | G2-O/G3 → G4/G5 |
| AC-DM-04-02 | DM-04 | [撤回/历史接受依据](DATA.md#resume-data) | G3 → G4/G5 |
| AC-DM-05-01 | DM-05 | [真实事件/必要关系/阶段结果](MODULES.md#relations) | G2-O/G3 → G4/G5 |
| AC-DM-06-01 | DM-06 | [真实事件/必要关系/阶段结果](MODULES.md#relations) | G2-O/G3 → G4/G5 |
| AC-DM-07-01 | DM-07 | [实际原文 owner/生命周期/知识范围](MODULES.md#source-boundary) | G1/G2-W → G4/G5 |
| AC-DM-08-01 | DM-08 | [Research owner/提升/引用](MODULES.md#boundaries) | G3 → G4/G5 |
| AC-DM-08-02 | DM-08 | [研究单正本/引用](MODULES.md#owners) | G3 → G4/G5 |
| AC-DM-09-01 | DM-09 | [Research owner/提升/引用](MODULES.md#boundaries) | G3 → G4/G5 |
| AC-DM-10-01 | DM-10 | [陈述/来源版本与修订](DATA.md#time-history) | G2-W/G3 → G4/G5 |
| AC-DM-10-02 | DM-10 | [陈述/来源版本与修订](DATA.md#time-history) | G2-W/G3 → G4/G5 |
| AC-DM-11-01 | DM-11 | [实际原文 owner/生命周期/知识范围](MODULES.md#source-boundary) | G1/G2-W → G4/G5 |
| AC-DM-12-01 | DM-12 | [业务生命周期与清除](MODULES.md#source-boundary) | G1/G3 → G4/G6 |
| AC-DM-13-01 | DM-13 | [陈述/来源版本与修订](DATA.md#time-history) | G2-W/G3 → G4/G5 |
| AC-DM-14-01 | DM-14 | [实际原文 owner/生命周期/知识范围](MODULES.md#source-boundary) | G1/G2-W → G4/G5 |
| AC-DM-15-01 | DM-15 | [陈述/来源版本与修订](DATA.md#time-history) | G2-W/G3 → G4/G5 |
| AC-DM-16-01 | DM-16 | [Project/Employment/Person 关系](MODULES.md#relations) | G2-E/P → G4/G5 |
| AC-DM-17-01 | DM-17 | [现实日期/历史/未知](DATA.md#time-history) | G2-E/O → G5 |
| AC-DM-18-01 | DM-18 | [Project/Employment/Person 关系](MODULES.md#relations) | G2-E/P → G4/G5 |
| AC-DM-19-01 | DM-19 | [Project/Employment/Person 关系](MODULES.md#relations) | G2-E/P → G4/G5 |
| AC-DM-20-01 | DM-20 | [Project/Employment/Person 关系](MODULES.md#relations) | G2-E/P → G4/G5 |
| AC-DM-21-01 | DM-21 | [Resume 当前稿](DATA.md#resume-data) | G2-R → G4/G5 |
| AC-DM-22-01 | DM-22 | [命名版本/导出冻结快照](DATA.md#pdf-snapshot) | G2-R → G4/G5/G6 |
| AC-DM-23-01 | DM-23 | [实际发送材料/发布保留](DATA.md#file-commit) | G4 → G5/G6 |
| AC-DM-23-02 | DM-23 | [文件失败与历史缺失](DATA.md#file-commit) | G1/G4 → G6 |
| AC-DM-24-01 | DM-24 | [没有/未知/缺失语义](DATA.md#time-history) | G3/G4 → G5 |
| AC-DM-25-01 | DM-25 | [真实事件/必要关系/阶段结果](MODULES.md#relations) | G2-O/G3 → G4/G5 |
| AC-DM-26-01 | DM-26 | [Interview 强边界/同一轮次](MODULES.md#boundaries) | G3 → G4/G5 |
| AC-DM-27-01 | DM-27 | [Interview 强边界/同一轮次](MODULES.md#boundaries) | G3 → G4/G5 |
| AC-DM-28-01 | DM-28 | [Interview 强边界/同一轮次](MODULES.md#boundaries) | G3 → G4/G5 |
| AC-DM-29-01 | DM-29 | [Interview 强边界/同一轮次](MODULES.md#boundaries) | G3 → G4/G5 |
| AC-DM-30-01 | DM-30 | [真实/模拟的受控回流](AI-RUNTIME.md#context) | G3/G4 → G5/G6 |
| AC-DM-30-02 | DM-30 | [真实/模拟的受控回流](AI-RUNTIME.md#context) | G3/G4 → G5/G6 |
| AC-DM-31-01 | DM-31 | [Offer 条件与冻结接受依据](DATA.md#resume-data) | G3 → G4/G5/G6 |
| AC-DM-32-01 | DM-32 | [Offer 建议，保持条件性](DELIVERY.md#trace) | 采纳建议后 → 条件性 G5 |
| AC-DM-33-01 | DM-33 | [真实事件/必要关系/阶段结果](MODULES.md#relations) | G2-O/G3 → G4/G5 |
| AC-DM-34-01 | DM-34 | [现实日期/历史/未知](DATA.md#time-history) | G2-E/O → G5 |
| AC-DM-35-01 | DM-35 | [真实事件/必要关系/阶段结果](MODULES.md#relations) | G2-O/G3 → G4/G5 |
| AC-DM-36-01 | DM-36 | [Project/Employment/Person 关系](MODULES.md#relations) | G2-E/P → G4/G5 |
| AC-DM-37-01 | DM-37 | [Interview 强边界/同一轮次](MODULES.md#boundaries) | G3 → G4/G5 |
| AC-DM-38-01 | DM-38 | [归档/清除/副本/生产者](DATA.md#purge) | G4 → G6 |
| AC-DM-38-02 | DM-38 | [归档不等于清除](DATA.md#purge) | G2 → G5 |
| AC-DM-39-01 | DM-39 | [真实事件/必要关系/阶段结果](MODULES.md#relations) | G2-O/G3 → G4/G5 |
| AC-DM-40-01 | DM-40 | [现实日期/历史/未知](DATA.md#time-history) | G2-E/O → G5 |
| AC-AI-01-01 | AI-01 | [可信 Actor](AI-RUNTIME.md#actors) | G1/G2-A → G6 |
| AC-AI-02-01 | AI-02 | [任务范围/真实面试/导入](AI-RUNTIME.md#task-types) | G2-A/G3 → G4/G5 |
| AC-AI-03-01 | AI-03 | [渐进 Context/证据性质](AI-RUNTIME.md#context) | G2-A → G4/G5 |
| AC-AI-04-01 | AI-04 | [渐进 Context/证据性质](AI-RUNTIME.md#context) | G2-A → G4/G5 |
| AC-AI-05-01 | AI-05 | [任务范围/真实面试/导入](AI-RUNTIME.md#task-types) | G2-A/G3 → G4/G5 |
| AC-AI-06-01 | AI-06 | [渐进 Context/证据性质](AI-RUNTIME.md#context) | G2-A → G4/G5 |
| AC-AI-07-01 | AI-07 | [两种许可/实际外发](AI-RUNTIME.md#grants) | G2-A → G4/G6 |
| AC-AI-07-02 | AI-07 | [衍生外发/可信输入](AI-RUNTIME.md#trusted-provenance) | G2-A → G4/G6 |
| AC-AI-07-03 | AI-07 | [撤销/缓存/独立控制](AI-RUNTIME.md#dispatch-budget) | G2-A → G6 |
| AC-AI-08-01 | AI-08 | [Search 与既有资料分开](AI-RUNTIME.md#task-types) | G3/G4 → G6 |
| AC-AI-08-02 | AI-08 | [Search 与既有资料分开](AI-RUNTIME.md#task-types) | G3/G4 → G6 |
| AC-AI-09-01 | AI-09 | [预览与保存分离](AI-RUNTIME.md#task-types) | G1 → G4/G5 |
| AC-AI-10-01 | AI-10 | [同事务最终校验/生效](AI-RUNTIME.md#atomic-apply) | G4 → G6 |
| AC-AI-10-02 | AI-10 | [同事务最终校验/生效](AI-RUNTIME.md#atomic-apply) | G4 → G6 |
| AC-AI-10-03 | AI-10 | [pending/拒绝/忽略](AI-RUNTIME.md#states) | G2-A/G3 → G4/G5 |
| AC-AI-11-01 | AI-11 | [细粒度依赖/原子检查](AI-RUNTIME.md#proposal-apply) | G4 → G6 |
| AC-AI-12-01 | AI-12 | [unknown / A-B 原结果](AI-RUNTIME.md#states) | G2-A/G4 → G6 |
| AC-AI-13-01 | AI-13 | [恢复内容与执行权分开](AI-RUNTIME.md#recovery) | G4 → G6 |
| AC-AI-14-01 | AI-14 | [Secret 输入/使用/撤销](DATA.md#secrets) | G0/G2-A → G6 |
| AC-AI-14-02 | AI-14 | [Secret 输入/使用/撤销](DATA.md#secrets) | G0/G2-A → G6 |
| AC-AI-15-01 | AI-15 | [实际输入来源/外发限制](AI-RUNTIME.md#trusted-provenance) | G2-A/G4 → G6 |
| AC-AI-15-02 | AI-15 | [实际输入来源/外发限制](AI-RUNTIME.md#trusted-provenance) | G2-A/G4 → G6 |
| AC-AI-16-01 | AI-16 | [实际输入来源/外发限制](AI-RUNTIME.md#trusted-provenance) | G2-A/G4 → G6 |
| AC-AI-17-01 | AI-17 | [根预算/stop/revoke](AI-RUNTIME.md#dispatch-budget) | G2-A → G6 |
| AC-AI-18-01 | AI-18 | [无效/临时/持久化闸门](AI-RUNTIME.md#recovery) | G2-A/G4 → G6 |
| AC-UX-01-01 | UX-01 | [UI session/导航/焦点/连续性](MODULES.md#ui) | G2 → G5 |
| AC-UX-02-01 | UX-02 | [UI session/导航/焦点/连续性](MODULES.md#ui) | G2 → G5 |
| AC-UX-03-01 | UX-03 | [UI session/导航/焦点/连续性](MODULES.md#ui) | G2 → G5 |
| AC-UX-04-01 | UX-04 | [回执/冲突/迟到结果](MODULES.md#contracts) | G1 → G4/G6 |
| AC-UX-05-01 | UX-05 | [UI session/导航/焦点/连续性](MODULES.md#ui) | G2 → G5 |
| AC-UX-06-01 | UX-06 | [Apply 独立 undo/History](MODULES.md#ui) | G0/G2-R → G4/G5/G6 |
| AC-UX-06-02 | UX-06 | [Profile 独立编辑](MODULES.md#ui) | G2-R → G4/G5 |
| AC-UX-07-01 | UX-07 | [中文 composition/快捷键/焦点](MODULES.md#ui) | G0/G2-R → G5 |
| AC-UX-08-01 | UX-08 | [PDF owner/冻结 revision](DATA.md#pdf-snapshot) | G2-R → G4/G5/G6 |
| AC-UX-09-01 | UX-09 | [UI session/导航/焦点/连续性](MODULES.md#ui) | G2 → G5 |
| AC-UX-10-01 | UX-10 | [进度/停止/unknown](AI-RUNTIME.md#states) | G2-A → G4/G5/G6 |
| AC-UX-11-01 | UX-11 | [UI session/导航/焦点/连续性](MODULES.md#ui) | G2 → G5 |
| AC-UX-12-01 | UX-12 | [用户备份与恢复](DATA.md#backup) | G2-U/G4 → G6 |
| AC-UX-13-01 | UX-13 | [启动/隔离/退出](ARCHITECTURE.md#runtime) | G0 → G6 |
| AC-UX-14-01 | UX-14 | [真实桌面基础交互](MODULES.md#ui) | G0/G2-U → G5 |
| AC-UX-15-01 | UX-15 | [会话保持/重启/回执](MODULES.md#ui) | G2 → G5/G6 |
| AC-UX-16-01 | UX-16 | [日期/时区/录入时间](DATA.md#time-history) | G2 → G5 |
| AC-MG-01-01 | MG-01 | [独立正式迁移/语义](DATA.md#backup) | M：隔离演练 → M：另行授权验收 |
| AC-MG-02-01 | MG-02 | [独立正式迁移/语义](DATA.md#backup) | M：隔离演练 → M：另行授权验收 |
| AC-MG-03-01 | MG-03 | [独立正式迁移/语义](DATA.md#backup) | M：隔离演练 → M：另行授权验收 |
| AC-MG-04-01 | MG-04 | [备份/清除/恢复完整性](DATA.md#backup) | G4 → G6 |
| AC-MG-04-02 | MG-04 | [受管理副本/外部清除边界](DATA.md#managed-copies) | G4 → G6 |
| AC-MG-05-01 | MG-05 | [备份不含 Key/恢复无授权](DATA.md#secrets) | G4 → G6 |
| AC-MG-06-01 | MG-06 | [独立正式迁移/语义](DATA.md#backup) | M：隔离演练 → M：另行授权验收 |
| AC-MG-07-01 | MG-07 | [日常恢复与正式迁移分开](DATA.md#backup) | G6 / M 隔离演练 → G6 + M 另行授权 |


### 11.1 九条旅程仍有集成落点

| Journey | 核心 owner 接缝 | 验证安排 |
| --- | --- | --- |
| J-01 首次使用，不配外部服务 | Shell/人工业务/空状态 | G2 接入，G5 无 AI 独立验收 |
| J-02 工作材料形成长期积累 | Project/Employment/Person/Materials/Wiki/来源清除 | G2 并行，G4 真 owner 集成，G5/G6 |
| J-03 按现实推进机会 | Opportunity core 与各强边界子模块 | G2/G3 接入，G4/G5 非顺序事件 |
| J-04 编辑、导出与真实发送 | Resume/Profile/Submission/文件保留 | G0/G2-R 接入，G4/G5 连续编辑，G6 故障 |
| J-05 真实面试与模拟 | Interview/真实 Review→Research Proposal/模拟→受限 Wiki | G3/G4 接入，G5 完整旅程，G6 权限反例 |
| J-06 Offer、谈薪、接受与入职 | Offer/core/Communication 与独立 Employment | G3/G4 接入，G5 现实变化与冻结依据 |
| J-07 研究或导入 | Search/Import/Runtime/Materials/Research | G1 本地导入起步，G3/G4 分层，G5/G6 |
| J-08 在原任务里记录反馈 | feedback/Shell overlay/底层 editor session | G2-U，G4 receipt，G5/G6 |
| J-09 日常备份恢复 | backup/managed copies/active pointer/权限恢复 | G4 接入，G5 用户旅程，G6 断电与完整性；不代替 M |

<a id="verification"></a>
## 12. 本轮文件与覆盖复核

复核方法：重新读取八份冻结正文；按标题提取原 Requirement ID，逐条与 §7 的主定位比较；按 ACCEPTANCE 的表行提取原 AC ID 及其 Requirement 关系，与 §11 比较；核对 J-01～J-09 的串联规则和对应门。程序负责集合相等、唯一性、关系、链接和包结构检查，人工语义复核负责判断定位是否承接真实行为；单纯数字相等不代表运行通过。

| 检查 | 本轮结果 |
| --- | --- |
| 冻结八份正文 SHA256 | 8/8 与 R3 包清单一致；未修改原文 |
| Requirement 主定位 | 87/87；PR 6、DM 40、AI 18、UX 16、MG 7；无丢失/新增/重复 |
| AC 分支与父 Requirement | 104/104；PR 6、DM 48、AI 25、UX 17、MG 8；无丢失/新增/重复/错误归属 |
| AC 的验证阶段 | 104/104 已指定；DM-32 保持条件性，正式迁移保留独立 M 阶段 |
| Journey | 9/9 已定位；J-05 真实 Review→Research 路径明确保留 |
| Reviewer | 3 个 P0、7 个编号 P1，以及 §5/§6 未编号模块/协作 P1 均有正文位置和验证门 |
| 文档边界 | 5 份正文 + 原有 3 份更新 ADR；新增 ADR 0；无业务代码或原仓内容 |
| 已执行证据层级 | 仅文件完整性、静态覆盖与设计一致性复核；技术组合、并发、故障、真实 macOS/服务/迁移全部未执行 |

**最终状态：READY FOR FINAL ARCHITECTURE REVIEW**

# J-07 真实外部验收（PASS）

[Issue #31](https://github.com/frog-716/Career-Next/issues/31)，基线 `65a5d67789172905abc0b0c3fa8d241843b04e79`。不是新 Gate，不进入 Migration M，不读取旧 Career。最终结算：J-07 PASS、G5 PASS、G6 LOCAL PASS；发布环境三项 READY / NOT RUN。下文失败与待验记录均为各自历史时点，不覆盖此最终状态。

| 真实服务 | 结果 | 当前边界 |
| --- | --- | --- |
| Search | PASS | 用户新授权后唯一 1 次 Tavily 请求，HTTP 200，10 条 Research candidate；未自动写正式 Research，未独立核验，详见末节 |
| DeepSeek Provider | PASS | 唯一 1 次请求；人工接受后 Proposal accepted，正式 ResearchItem 1 条，independentlyVerified=false；用户明确确认本条 hypothesis → inference 语义可接受 |
| Feishu Read | PASS | user identity；指定 TEST DATA 文档只读 1 次，revision 25；用户确认缓存 Preview 后正式 Materials 本地保存为 Raw，重放无重复，取消无空 Raw；写操作 0 |

当前累计：模型请求 1、真实 Search 请求 1、飞书正文读取 1、飞书写入 0、真实 Career 用户资料外发 0。保存 Key 本身不发请求。下文此前 HTTP 0 等描述保留为当时证据，最新真实服务结果见后续章节。

## 固定 Provider 测试材料

Target：**Example Corp / Test Opportunity**。

```text
Example Corp is testing a fictional hiring workflow.
Role: Test Analyst.
Hiring process: Two fictional interview rounds.
```

用户于 2026-10-03 禁止旧模型及 fallback。官方 [模型表](https://api-docs.deepseek.com/quick_start/pricing/) 将 V4.1-Flash 映射为 `deepseek-flash`；[Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/) 使用 `POST https://api.deepseek.com/chat/completions`。本次固定 `thinking.type=disabled`、`stream=false`、JSON 输出和有界 max_tokens。

完整 HTTP 正文进入不可变 manifest 及最终外发预览，授权绑定整个 digest，同时显示接收方、非敏感凭据代次、资源和费用限制。Main 按启用代次经私有桥解密凭据；Key 不进入业务 DTO/命令记录/数据库。等待后检查取消与有效期，单次发送，不重定向、不自动重试或 fallback。确定未发送时退回请求预留，未知结果保持 unknown。

响应先经模型/JSON/任务 Schema 和长度校验成为 pending Research Proposal。用户接受后由 Research owner 生效，保持 `userConfirmed=true`、`independentlyVerified=false`。Token usage 按响应记录；接口未提供实际货币费用，不声称货币硬上限。真实 adapter 首次仅支持 Research 整理，不扩展其他任务。

## 准备证据与待验

- 独立资料库 `out/j07-real-external/profile` 已标记 TEST DATA；仅通过正式公开命令创建 Example Corp、Test Opportunity 和固定虚构 Raw，没有复制真实资料库。
- 正常 arm64 包使用独立 `--user-data-dir`，不启用测试能力。Key 只由用户本人在正式 Secret UI 输入；之后仍需要完整外发预览及明确授权。
- `tests/j07-deepseek-provider.test.ts`：模拟 HTTP 对照预览、固定模型/模式、撤销/过期零请求、无重试、异常模型拒绝。
- `tests/j07-secret-dispatch.test.ts`：合成凭据的加密、代次读取、停用/替换/删除与业务状态不暴露凭据。
- `tests/integration/j07-deepseek-research.test.ts`：真实 SQLite / owner 与模拟 HTTP；授权前零请求，响应不自动写正文，接受后生效；等待 Key 时 revoke 确认 NOT SENT、零 HTTP、预算退回。
- code-review Standards / Spec 后修正了有效期、未发送状态/预算、授权前费用提示和完整 Target 断言。上述模拟回归不计为真实 PASS；实际运行日志位于隔离产物目录。

本轮没有输入/读取真实 Key。Git / logs / DB / backup / recorder 的运行后完整 Secret 审计，须在真实运行后补齐。飞书连接状态未记录昵称、账号标识或令牌；候选、选择、正文、预览、确认保存仍待指定测试文档。

准备阶段最终回归：typecheck / build / 正常 arm64 package 成功；完整单元串行 **124/124**，集成串行 **384/384**，正常包 Materials 基础冒烟 **1/1**。首次并行单元运行 99 PASS / 25 FAIL（界面测试超时），原日志 `out/j07-real-external/unit.log` 保留；串行完整重跑通过，未改变业务断言。最终日志分别为 `unit-serial.log` / `integration.log` / `packaged-smoke.log`。Standards / Spec 复核无剩余发现。

正常包 ASAR SHA-256：`37f4bc05104af04789055163466b7e3e712c8a06427edfb05b73435c2f07141e`。当前 Git 文件静态扫描没有发现 API Key 样式，测试资料库安全目录真实凭据密文数量为 0；这不是运行后全面审计的替代证据。上述结果只证明接线准备和自动回归，不证明真实外部服务已通过。

G5 保持 **PARTIAL**；104 分类不变：38 PASS_ALREADY / 31 PASS_G5 / 28 DEFER_G6 / 5 DEFER_M / 1 EXTERNAL_LIVE_PENDING / 1 CONDITIONAL。只有三条真实链全部通过才升级唯一外部待验项。Developer ID / Notarization / x64 仍 READY / NOT RUN。冻结产品 12/12、架构 8/8 SHA 不变。Issue 保持 OPEN，当前不创建最终验收 checkpoint。

## Tavily Key 界面准备（2026-10-03）

用户确认 Search 服务 Tavily、唯一查询 `OpenAI official website`，最多 1 次，不附带 Resume / Raw / Profile / Career 私有资料。本轮进一步限定为仅准备 Key 输入框，搜索请求继续 0。

正式 Secret UI 增加独立 Tavily 密码输入；Main 的 `security-tavily/` 独立设备加密存储，不调用模型凭据协调器，不覆盖或启用 DeepSeek，不进入业务数据库/备份或通用命令记录。保存只做本地设备安全存储，没有 Search adapter dispatch。用户本人输入并提交；不读取 Key、不打印 Key。

类型检查通过；凭据 UI / Vault 相关 2 文件 5 测试通过（合成凭据），含 Tavily 输入清空和仅 status / save 操作。该证据不计真实 Search PASS。打包界面准备日志保留在 `out/j07-real-external/tavily-key-*.log`。

Tavily Key 界面版正常 arm64 package / build 成功；ASAR SHA-256：`95afd93bb023579554e2a90b4009daf61b08cb421e15144c0f4a48ddc00c0be5`。上一版包保留在 `out/j07-real-external/CareerNext-deepseek-pre-tavily.app`。冻结文件复核仍 12/12、8/8 不变。

## Tavily 最终外发预览（仅准备，未发送）

用户本人已通过正式 Secret UI 保存 Tavily Key。Computer Use 点击“读取 Tavily Key 状态”后仍显示凭据已安全保存（UI 只在 configured / enabled 都为 true 时显示该状态），未读取或显示 Key。

最终预览冻结在 [j07-search-egress-preview.json](j07-search-egress-preview.json)：接收方 `Tavily`，固定 `POST https://api.tavily.com/search`；请求业务正文仅 `{"query":"OpenAI official website"}`。不附带 Resume / Raw / Profile / Career 私有资料；设备凭据仅用于认证头，不进入预览正文。最多 1 次派发，禁止自动重试、重定向和 Provider fallback。

端点及认证方式核对 [Tavily 官方 API](https://docs.tavily.com/documentation/api-reference/endpoint/search)。本步仅形成可审阅的预览和其摘要，未解密凭据，未创建或执行任何 Search 网络请求；后续实际派发必须逐字使用该正文，并实现同一单次派发限制。Search / Provider / Feishu 仍为 NOT RUN，G5 保持 PARTIAL。

## Tavily 正式 adapter 单次派发准备

平台 adapter 位于 `packages/backend/platform/providers/tavily.ts`，仅使用已确认 preview digest 和固定 query JSON。Key 仅在派发时经 Main 私有凭据桥获取；前端无读 Key 能力。实际 HTTP 使用 `redirect:error`，单个 fetch，无 retry / fallback，无访问结果 URL。

单次 slot 在网络前以独占文件建立并同步落盘，重启/并发/重新点击不能再次发送；操作 marker 只保存请求、状态和次数等元数据，不复制结果正文。真实返回由 SearchRun 唯一 owner 保存，来源身份与 owner 对齐，标注 public_search_result_unverified。Research/Wiki owner 不接收自动写入。

凭据变更意图即时收紧 Main 新请求 admission，同时私有控制使已有 runtime epoch 失效；真实 handoff 前复核。原始及解析后的响应均拒绝 Key 回显。SearchRun 清除覆盖 `ai.search.tavily` 回执。Standards / Spec 审查发现已修复并复核。

类型检查 / build / 正常 arm64 package 通过；相关 unit 4 文件 10 测试通过，集成全套 78 文件 387 测试通过。模拟验证不算真实 PASS。必要正常包冒烟日志为 `out/j07-real-external/tavily-packaged-smoke.log`。真实派发仍待下方实际证据。

## 真实 Search 派发尝试结果（未发生 HTTP）

用户明确批准最终 Tavily preview 后，Computer Use 在正常 arm64 包中选择隔离 `Test Opportunity`，包内预览确认凭据已配置且已启用，query / endpoint 与已批准内容一致。本轮仅点击一次“执行已授权的唯一一次 Tavily 搜索”。

实际返回 `credential_unavailable`，在 HTTP handoff 前被阻止。随后仅点击“核对本次 Tavily 结果，不重发”，得到 `not_sent / requestCount=0`。单次 marker 与数据库复核一致：SearchRun 0、结果 0、候选 0；Research / AI 表记录数量与派发前一致。未调用 DeepSeek、未进入 Feishu、未尝试第二次搜索；未重置或删除已占用 slot。

证据见 [j07-search-attempt.json](j07-search-attempt.json)。派发前失败的具体阶段与原因尚未确认，不能记真实 Search PASS。Git / logs / 隔离业务文件及现存备份的 API Key 样式检查无命中（只报告数量，没有输出 Secret）；Agent 未读取 Key。冻结产品 12/12、架构 8/8 SHA 不变。正常包基础冒烟 1/1 通过，但不替代真实外部验收。G5 / J-07 继续 PARTIAL；不创建最终 checkpoint，不进入 Migration M。

## Tavily 凭据诊断与本机检查（2026-10-04）

本轮明确禁止真实 Search / Provider / Feishu、重试、要求用户再次输入 Key。用户另行确认允许 Career 在本机检查一次原凭据，Agent 只接收可用/不可用结果，不接收 Key。

### 已确认与尚不能确认

- 原密文记录实际存在，当前隔离 TEST DATA profile、Tavily 专用 slot、已保存 generation 对齐；cipher 为当前用户所有的普通文件，0600；目录 0700；无 pending-save，未误写 DeepSeek slot。未修改、替换、复制或导出原密文。
- 正常 arm64 包的正式 Secret UI 点击一次“本机检查 Tavily Key（不联网）”，trusted Desktop Main 成功打开原密文、检查后丢弃临时值，仅返回 `readiness=available`。CUA 看到“凭据已配置，当前本机检查可用”。不需要 Key re-entry。UI 无 read / export Key API。
- 再次仅核对原回执：`not_sent / requestCount=0`。原 operation `ce5026c3-7cff-4538-a94a-0f128db5fe99` 和占用 slot 保留；没有 reset、释放、重试或调用网络 adapter。实际 Search / Provider / Feishu 请求仍全部为 0。
- **历史真正失败原因未证实。** 原实现把 credential resolver、格式、persistence gate、session gate 的发送前错误全部压成 `credential_unavailable`，原 marker 没有阶段字段。当前打开原凭据成功，排除了“当前密文无法恢复”的判断，但不能证明原失败属于哪一层，也不能把当前成功冒充历史根因已修复。历史请求不会为诊断重发。

### 确认的缺陷及修复

1. UI / Vault 只用 generation 表示 configured，未表示是否可用。增加单独本机 check；状态区分未配置、已保存未检查、已检查可用、已保存不可用。状态查询不解密；实际 resolver 失败更新脱敏原因，同一 generation 的检查结果仅在当前 Main 内存保留，重启后恢复 unchecked。停用/替换仍经原 admission 闸门，check 不开启派发权。
2. 本机检查检查真实 Header 构造规则，非法换行、零宽字符、NUL 在外发前拒绝；只返回 `invalid_credential`，不返回非法内容。原凭据真实检查发生在这项边缘校验加强前；加强项用合成凭据回归验证，没有第二次打开原凭据。
3. Tavily 发送前失败记录非敏感 `failureStage`（resolver / format / persistence / session）。持久化闸门拒绝单列 `preflight_denied`，不再冒充凭据失败。旧 marker 未补写或猜测阶段。
4. Secret 状态失败不提示用户盲目重输 Key。Renderer、业务 DTO、命令记录、SQLite、业务备份仍不接收 Key；Main→utility 的私有派发桥只在正式外发前取临时值，不让 worker 自行读取密文。

### 测试证据

- `readiness-status-red.log`：合成 OS 解密失败后仍只有 configured、缺 unavailable，先红；修复后绿。
- `readiness-formal-bridge-red.log`：旧正常包、临时合成 profile，save → configured → 正式 private Search resolver 解密失败 → credential_unavailable / HTTP 0，UI 状态缺 unavailable，红灯。修复后的同一链验证 available / unavailable 与 write-only 边界。
- `readiness-preflight-red.log`：persistence gate 失败误报 credential_unavailable，先红；分阶段修复后绿。
- `readiness-header-red.log` / `readiness-adapter-header-red.log`：非法 Header 值误判 available / outcome_unknown，先红；修复后在网络前明确拒绝。
- 单元、集成和正常包结果见本轮最终汇总；所有 transport 测试均为本地合成或 stub，不计 REAL SEARCH PASS。合成 profile 在测试结束后删除。抛弃的临时 vault build helper 已移除。

安全扫描只输出数量、不输出匹配值：Git、日志、隔离 DB / recorder / 现存 backup / business 文件、进程参数没有发现 Tavily / API Key 样式。此扫描没有回读原 Key 做逐字比较；证明范围与代码/合成回归共同记录。原 Key 仍只在设备加密存储。Frozen Product Spec 12/12、Architecture 8/8 SHA 不变。

本轮 `CREDENTIAL READY` 只指本机原密文可打开，不代表 Tavily 接受 Key 或真实 Search 已通过。G5 / J-07 继续 PARTIAL，104 分类不变。下一步必须得到新的最终 egress 授权；本轮不会自动重新搜索，也不会释放原单次 slot。

本轮最终结果：相关 unit **31/31**、integration **8/8**、正常包 **4/4**，最新 UI 重跑 **4/4**；typecheck / build / 正常 arm64 package PASS，git diff --check PASS。Standards / Spec 复核无剩余代码或证据表述发现；历史根因缺口仍明确保留。最终 ASAR SHA-256：`d0260fecd4fc76a9f997094a77d45cb0364d36a930995147d8d8545647a79003`。真实原凭据检查包 ASAR SHA-256：`b4932ce77b5928a445a59afabd7d85be2a2f78b71f6bfc53e08cae1f0aa3ca23`。日志与仅计数的安全汇总保存于 `out/j07-real-external/readiness-*.log` / `readiness-safety-check.json`，不包含 Key。Git 保留本轮与此前 J-07 未提交现场，不创建真实外部验收 checkpoint。

## Tavily 再授权单次尝试（2026-10-04）

用户再次明确批准固定 Tavily endpoint / query，单次、无 retry / redirect / fallback。发送前只核对元数据确认原 generation、Tavily slot、正常包与隔离 TEST DATA profile 一致，没有回读 Key。App 完全正常退出后，原 `ce5026c3-7cff-4538-a94a-0f128db5fe99` not_sent/0 marker 原样 rename 归档并核对 SHA，未建立自动释放或重试能力。新授权只允许一个独占新 slot。

正式 UI 再核对最终预览后只点击一次执行。本次在 `credential_resolve` 失败，回执 `not_sent / requestCount=0`；request_build / connect / TLS / HTTP auth / HTTP response / parse 全部 NOT RUN。没有收到 HTTP 状态，没有结果/候选，未写 Research、未标为独立核验事实。只核对回执，没有重发，也没有调用 DeepSeek / Feishu。此前 trusted Main 本机 available 不能证明真实派发桥成功，本次不伪造真实 Search PASS。

必要阶段补充经过先红后绿：Tavily unit **13/13**（HTTP 401/403/429、parse、connect/TLS 已知错误、无 retry、Key 不落盘、最终撤销闸门）；integration **3/3**；typecheck / build / 正常 arm64 package PASS。阶段失败只记录固定枚举，不记 Key 或任意原始错误。HTTPS 响应成功可证明 connect/TLS 成功；无法辨别的 transport 错误明确 UNKNOWN，不猜阶段。HTTP 前最后检查紧邻 handoff，拒绝记零请求。Standards / Spec 复核无剩余发现。

本轮正常包回归 **2 PASS / 2 FAIL**：private bridge 两个合成案例通过，native readiness 与 restart 两个案例超时，原日志保留 `reauthorized-search-packaged.log`。不能将该回归写成全部 PASS，不能据此确认真实凭据链正常。此前本机 readiness 成功证据保留，但这次真实 dispatch 仍失败。

本次必要正式证据见 [j07-search-reauthorized-attempt.json](j07-search-reauthorized-attempt.json)。Git / logs / DB / recorder / business文件 / CLI参数 Key 样式扫描无命中；仅报告计数，没有读取 Key 做逐字比较。Frozen Product Spec 12/12、Architecture 8/8 SHA 不变，G5/J-07 仍 PARTIAL。当前任务在保存证据后停止；不继续修复、搜索、Provider 或 Feishu，不创建本轮外部验收 checkpoint。

## credential_resolve 正式交接诊断（2026-10-04）

在再授权的 Search 失败后，CUA 仅刷新同一正常 App 的 Secret 状态，Main 已显示 available。这证明 Main 后来成功打开原凭据，但 utility 先返回失败；历史操作没有时延记录，不能追认每次历史失败的准确等待原因。

合成正式 Main→utility→Search 桥将 OS 解密延迟 16 秒：旧 utility 的 15 秒 timer 先拒绝，Main 后来 available、Search credential_unavailable、模拟 transport 0，先红。凭据 RPC 改为有界 60 秒，Main 外层总等待 125 秒容纳本机 60 秒 + 单次 HTTP 60 秒，原样慢测试变绿。未增加重试、Provider fallback 或放宽撤销检查。明确区分 credential_timeout 与 credential_unavailable，并向 adapter / marker / Runtime / 回执传递；失败仍 NOT SENT / 0。

新增“检查正式搜索凭据链（不联网）”：经同一 trusted Main resolver、同一私有端口真实交接，立刻丢弃临时值，只返回 available / elapsedMs / 固定脱敏失败码。不读取或占用 Search slot，不调用 transport，不写业务 DB。类型检查 / build / 正常 arm64 package PASS；Tavily unit 14/14、integration 3/3、慢包 private bridge 1/1；其他 packaged 案例本轮未重跑，先前超时证据不删除。Standards / Spec 复核发现的 timeout 原因丢失已修复，无剩余发现。

### 真人系统授权后的真实本机结果

正常包 `CareerNext-credential-bridge.app`、原隔离 profile、原 Tavily generation，仅执行一次正式无网络交接检查。SecurityAgent 启动时自动操作立即停止，未打开密码字段、未截图、未记录或识别密码，仅回复 USER PASSWORD INPUT REQUIRED。用户本人输入并确认后恢复；CUA **只读取已经结束的检查结果，没有再点执行**：正式凭据交接 available / **57008 ms**。这个真实结果说明含系统授权的当前交接耗时超过原 15 秒，修复后的链能完成。不能据此声称 Tavily 服务端认证已通过。

仍有限制：系统授权超过 60 秒会明确 timeout；不会自动重新读取并外发。用户若迟到确认，必须重新明确发起本机检查；没有任何超时自动重试。这个限制不隐藏为永久 READY。

原真实 Search marker 保留 `not_sent / requestCount=0`，没有 reset 或新搜索。本轮 Search / DeepSeek / Feishu 请求全部为 0，Research 无新增，G5/J-07 仍 PARTIAL。没有重新输入 Tavily Key；密码仅由用户系统 UI 操作，没有进入 Agent、终端、环境变量、文件或日志。必要脱敏证据见 [j07-credential-bridge-diagnosis.json](j07-credential-bridge-diagnosis.json)，安全扫描无 API Key 样式命中，Frozen 产品 12/12、架构 8/8 SHA 不变。

修复已完成本机正式凭据交接验证，真实 Search 仍须先给用户新的最终外发预览并等待新授权。本轮在证据记录后停止，不进入 Provider / Feishu / Migration M，不创建真实外部 PASS checkpoint。


## 凭据授权交互等待修正（2026-10-04）

用户指出 57 秒真人授权紧贴 60 秒上限，本轮只修正本机等待机制，不启动任何 Search / Provider / Feishu 请求。此前 57.008 秒真人本机交接证据保持原样，本轮不再次解密用户真实 Key，不计真实外部验收 PASS。

- Main-owned vault 开始受保护读取时发布 `waiting_for_system_authorization`；Renderer 只查询状态元数据，显示“正在等待系统授权”。这表示受保护调用正在等待，不声称检测到了系统窗口。基础业务查询、回执查询和关闭应用继续响应。
- 状态查询与取消不排在受保护调用后面。同一 generation 的并发检查共用一次 native 调用；取消或异常超时后仍锁住未结束的 native 调用，禁止重复弹窗、自动重试及迟到结果重新变成 READY。
- 应用内“取消等待系统授权（不发送）”立即返回 `credential_cancelled`。native safeStorage 没有取消系统弹窗的 API，系统窗口仍由用户本人处理；初始化迟到完成后不再启动解密。
- 已移除 60 秒主等待上限。15 分钟仅作为 native 调用永不返回的异常保护，返回独立 `credential_timeout`；私有桥有额外 5 秒通信保护，外层 Search 桥覆盖该异常上限及原有 HTTP 预算。HTTP 的 60 秒网络保护保持原值，本轮没有走 HTTP。
- 取消、授权失败、异常超时和不可用在 Main、私有桥、Runtime、adapter、回执及 UI 中分别保留。Key 不进入状态 DTO、Renderer 回读、数据库、日志、CLI 或备份；前后端均不增加重试。

### 原生 API 限制（保留缺口）

[Electron 44.5.1 safeStorage 实现](https://raw.githubusercontent.com/electron/electron/v44.5.1/shell/browser/api/electron_api_safe_storage.cc) 只提供异步结果和通用解密失败 / 暂时不可用错误，没有授权弹窗出现事件，没有可供应用调用的取消方法，也没有承诺把 macOS 的取消 / 拒绝 OSStatus 返回到 JavaScript。明确 native 状态码出现时保留 `credential_cancelled` / `credential_denied`；原因被合并时如实显示 `unavailable`，不从耗时、SecurityAgent 进程或弹窗推断用户选择。

[Apple errSecUserCanceled](https://developer.apple.com/documentation/security/errSecUserCanceled) 表示用户取消；[errSecAuthFailed](https://developer.apple.com/documentation/security/errsecauthfailed) 表示授权或认证失败。测试仅在 OS 边界注入这些状态码，不能算真实系统窗口取消 / 拒绝验收。本轮没有替用户操作系统窗口，也没有读取密码。

### 本机回归证据

正式公开边界为 Secret Bridge、Tavily 只读 credential.check 和基础业务/control 请求。所有新测试均使用独立临时 profile、虚构 credential、隔离 OS 边界；网络 transport 被禁止或受控替换，均无真实联网。

- 先红：`credential-wait-red.log` 复现状态查询被解密阻塞；`credential-wait-packaged-red.log` 在上一版正常包中复现等待 UI 缺失；`credential-cancel-initialization-red.log` 复现取消后初始化迟到仍继续解密。三处均已修绿。
- Unit / Secret UI：37/37 PASS；包含快速、57 秒、65 秒虚拟时钟授权，取消、明确授权错误、未知错误、15 分钟异常保护、迟到结果丢弃、单次 native 调用及普通状态无 Key。
- Runtime integration：8/8 PASS；四种凭据失败均独立保留、`not_sent / 0`，本机检查不预留 Search slot、不调用 transport。
- 正常 arm64 包：6/6 PASS；65 秒实际经过的模拟 native 等待 PASS；等待期间真实业务查询、状态及回执响应，重复检查只有一次 native 解密；取消、明确状态码和通用失败通过正式 Main → private port → utility → Runtime → Renderer 路径验证；等待期间退出应用无需等异常保护截止。
- typecheck / build / arm64 package PASS。正式包验证只替换 OS 边界和禁网 transport，未加入产品测试开关；真实密文没有复制、重置或导出。
- 集成首轮与构建同时运行时有一次 writer `db_failed`，该原日志保留；构建结束后串行重跑为 7/7 PASS，不能将首轮写成 PASS。

完整结果、最终包摘要和安全扫描见 [j07-credential-wait-verification.json](j07-credential-wait-verification.json)。日志位于 `out/j07-real-external/credential-wait-*.log`。Frozen Product Spec 12/12、Frozen Architecture 8/8 保持原 SHA。

当前真实请求仍为 0，原 `not_sent / 0 / credential_resolve` 回执保持不变；J-07 仍未完成，G5 仍 PARTIAL，Issue #31 保持 OPEN。本轮不创建真实外部验收 checkpoint，不进入 Migration M。下一次真实搜索前必须重新展示最终 egress preview 并等待用户明确授权，不能继承先前失败派发的发送权。


## 唯一真实 Tavily Search 成功（系统授权后，同一个请求）

用户在 [重新预览](j07-search-egress-preview-after-wait.json) 后明确授权唯一一次 `POST https://api.tavily.com/search`，正文逐字为 `{"query":"OpenAI official website"}`。已证明旧操作 `4e565026-6f8e-437c-8f73-20e1e05e15e5` 为 `not_sent / 0` 后，仅在本次明确授权下原字节重命名归档并 fsync；不具备自动 rearm / retry 能力，不读取或移动 credential 密文。

正常 arm64 `CareerNext-credential-wait.app` 使用同一隔离 TEST DATA profile 和 Tavily generation。正式 UI 预览显示固定接收方 / 正文 / 限制，执行按钮只点击一次。macOS 系统授权出现后停止自动操作、交还用户输入；没有截图、读取、记录或代输密码。用户完成后，仅核对既有请求结果，没有再次点击发送、重试或创建新操作。

- 操作 / SearchRun：`f8e7c61f-d777-4a97-a458-b63fcc01010e`。
- 唯一请求次数 **1**；HTTP **200**；最终状态 `captured`。credential_resolve、request_build、connect、TLS、HTTP auth、HTTP response、parse 均 PASS。
- 真实 Tavily 返回 **10** 条结果。title / HTTP(S) URL / source locator 均正确解析并保存为 SearchRun candidate；排序前 3 为 OpenAI - Wikipedia、OpenAI | Research & Deployment、IT’S OFFICIAL: OpenAI is worth $157 billion。搜索结果不代表独立核验，未跟随结果 URL。
- 只读复核隔离 DB：`ai_search_runs=1`；research_documents / research_items / research_history / research_references / wiki_knowledge / ai_tasks / ai_proposals 全部 0。未创建正式研究正文、事实、Proposal 或模型任务。
- 请求正文不附带 Resume / Raw / Profile / Career 私有资料。Key 只经受信任私有链用于认证头，Agent 未回读、未显示明文；安全扫描 Git / logs / business DB、recorder、backup / CLI args 均无 Key 格式匹配。
- DeepSeek **0**，Feishu **0**，不自动 retry、不跟随 redirect、不切换 Provider。Frozen Product Spec 12/12、Frozen Architecture 8/8 SHA 不变。

必要原始回执、provider request id、全部结果 title / URL / source 和结果正文 SHA 保存在 [j07-search-real-success.json](j07-search-real-success.json)，实际正文保留在隔离 TEST DATA SearchRun。该记录证明真实 Search 分支 PASS，不代表整条 J-07 Research / Provider / Feishu 链完成；J-07、G5 仍 PARTIAL。已停止，不自动进行第二次 Search 或任何 Provider / Feishu 操作。

## DeepSeek real request and pending proposal (2026-10-04)

The user explicitly authorized the complete preview body. Before dispatch, the immutable manifest body and digest matched the approved preview exactly; the DeepSeek credential slot and generation matched. Computer Use clicked the original operation authorization once, without rebuilding, retrying or accepting a proposal. The formal adapter performed one fetch to the fixed endpoint, thinking disabled, no fallback, redirect error. No Tavily results or private Career user data were included.

The real response passed model, JSON, Proposal Schema, citation and token-total validation. One Research lead / hypothesis proposal remains pending / current. Operation success, task needs_attention, usedRequests=1. Usage: input 262, output 186, total 448 tokens; actual cost not reported. HTTP success is evidenced as 2xx; the adapter did not retain the exact status code. Do not claim 200 or resend to recover that evidence.

Read-only DB checks: Research documents / items / history / references are all zero. No Apply and no independent verification. Evidence: [j07-deepseek-real-response.json](j07-deepseek-real-response.json); approved body: [j07-deepseek-egress-preview.json](j07-deepseek-egress-preview.json). Agent did not read the Key. Key-pattern scans found zero matches in Git, logs, business DB / recorder / backup files, and CLI arguments; this is not an exact-value comparison against the saved Key.

The request-to-pending-proposal segment passed. The full Provider owner acceptance chain still awaits user acceptance; Feishu has not run. G5 / J-07 remain PARTIAL; the external pending classification is unchanged. No second DeepSeek request, Tavily call, Feishu call or checkpoint commit occurred in this step.

## User-authorized local Apply (2026-10-04)

The user reviewed and explicitly accepted proposal `09d38be6-4275-4d78-9828-82222653f0ad`. Computer Use clicked the formal accept button once. The formal Research owner wrote one OpportunityResearch item, and the product decision transaction updated Proposal accepted with the same item in its receipt. Before/after item counts: 0/1; no duplicate. Title/body match the reviewed content, citation remains the original synthetic test material, userConfirmed=true, independentlyVerified=false. External calls in this step: zero; cumulative DeepSeek requests remain one.

**Nature difference:** the Proposal content remains unchanged as hypothesis, while the existing Research contract supports fact_statement / inference / unknown and owner.applyProposal persists inference. The user said nature should remain hypothesis, so this difference is explicitly retained for confirmation; it is not silently reported as literal hypothesis preservation in ResearchItem. No contract, business code or existing item was changed to conceal it. Evidence: [j07-proposal-local-apply.json](j07-proposal-local-apply.json). Stop here; Feishu and the broader J-07/G5 closeout remain pending.

## Research AI nature mapping: local repair (2026-10-04)

The user confirmed that the existing accepted J-07 hypothesis-to-inference item is valid and must remain unchanged. The local defect was the Research owner unconditionally writing inference for every AI proposal, including fact_statement. DM-10 defines Research nature as fact_statement / inference / unknown; AI-02 and AI-06 require task-specific output and distinguish acceptance from verification.

The mapping is now explicit: fact_statement -> fact_statement; hypothesis -> inference. ResearchProposalContent narrows the existing generic AI Content contract to those two values. Observation has no documented Research mapping and is rejected at Research TaskPolicy.validate, before a pending proposal is created; effective content is checked again during Apply so edit-accept or an older pending proposal cannot bypass the restriction. Other tasks still support generic observation. Research owner receives the explicit domain nature and always records AI adoption with userConfirmed=true and independentlyVerified=false. No automatic verification upgrade occurs.

Contract gap: generic AI Proposal Content cannot express unknown, although Research domain supports it. The free-text unknowns list is not a nature label and is not used to guess one. This repair does not widen the shared AI contract or change Frozen Spec. Research AI accepts only the two supported explicit mappings; human Research unknown remains supported and is covered by the integration test. A future explicit Research AI unknown output requires a separate contract change.

Both defects were reproduced red before repair: fact_statement was stored as inference; observation incorrectly survived TaskPolicy validation. Final local results: 10/10 unit, 19/19 integration (six new full Runtime-to-owner nature scenarios), build and typecheck PASS. One initial regression assertion assumed a specific error code for generic AI unknown; the existing Runtime instead exposes provider_failure. The assertion was corrected to verify rejection/no proposal/no write without changing unrelated failure handling. Logs and counts are preserved in [j07-research-nature-mapping.json](j07-research-nature-mapping.json).

No external requests in this repair. Tests used temporary isolated databases and synthetic local transport responses, then removed those stores. Read-only comparison confirmed the original accepted J-07 item is unchanged, the real test workspace still has exactly one ResearchItem, and cumulative real Provider requests remain one. Frozen Product Spec 12/12 and Architecture 8/8 match HEAD byte-for-byte. Feishu remains NOT RUN; G5 / J-07 remain PARTIAL. No final checkpoint or Migration M.


## Feishu 真实只读与用户确认后的本地保存（2026-10-04）

用户明确指定 TEST DATA wiki 文档，禁止搜索、读取其他正文及所有飞书写操作。只读 auth status / verify 确认 user identity 令牌可用，没有使用 bot。随后仅一次 `lark-cli docs +fetch --as user --doc-format markdown --detail simple` 读取指定文档；未跟随引用或搜索其他文档。真实文档 ID 为 `EVRwdPQMoo9WSbxo2xockU5qnJg`，wiki node 为 `BEySweDliiGwbpk56zTcA88Snxc`，revision 25。正文是 224 字节虚构 TEST DATA，SHA256 为 `e2f08857e9bef4d2277642613a5547ea9537a139d5d1fed0e9d37630b05aca7c`。首次读取后仅缓存 Preview，没有保存 Raw。

用户确认正文与 Preview 一致后，本步骤仅使用已有缓存，不再请求飞书。正式 Materials 原先缺少外部来源字段，先补失败测试证明来源丢失，再加入 Materials-owned 可选 origin 元数据及追加 schema batch 007；本地 Raw revision 仍为 1，飞书 revision 25 单独记录，不混用。已有冻结迁移 SQL 不变；备份候选验证支持新旧版本，origin 随备份保留。Renderer 无权提交或改写 origin，正文仍由不可变预览 digest 约束。未增加真实 Feishu 网络 adapter 或任何写能力，本次真实 fetch 是已授权的只读 CLI，保存走正式 Materials API。

正常 TEST DATA 应用退出后，通过正式 Runtime / Materials selectFile → preview → confirm → read 保存缓存，未直接写业务 SQL。回读正文逐字节相同，包括 Markdown 换行和尾随空格；没有总结或补充。Raw ID 为 `f4211cdf-86a2-408b-95b6-df378ca71045`，来源 identity=user、真实 URL、文档 ID、wiki node 和外部 revision 全部保留。相同 command `17902bdb-7789-4fce-b606-35402c0edc64` 重放返回相同 committed receipt；该文档 Raw 数量为 1，workspace 共 2 条（另一条是既有 DeepSeek 虚构材料）。再次仅本地暂存同一缓存并取消，之后确认被 invalid_capability 拒绝，Raw 列表不变，没有空 Raw。

本步骤所有外部请求为 0，累计 Feishu 正文读取仍为 1，其他文档 0，Feishu 写入 0，Career → Feishu 数据发送 0；没有调用 Tavily 或 DeepSeek，没有读取凭据或密码。62 项相关集成回归通过，包含恢复候选、旧 schema 升级、来源保留、取消和重放。必要证据见 [j07-feishu-local-save.json](j07-feishu-local-save.json)。三个真实服务分支已通过；本步骤不自动修改 Acceptance 104 分类、不关闭 Issue #31、不提交最终 checkpoint，J-07/G5 正式收尾仍待单独执行，不进入 Migration M。

正常 arm64 package 与独立临时 profile 的 Materials packaged smoke 1/1 PASS。重新打开原 TEST DATA profile，Computer Use 只点击已保存的 body.md：正式回读显示原文 revision 25、真实 document ID/URL、user 只读来源及完整 TEST DATA 正文。没有再次读取飞书。Frozen 产品 12/12、架构 8/8 SHA 不变，Key 样式扫描 Git/logs/业务文件均 0 命中；该扫描未回读真实 Key。


## J-07 / G5 最终结算（2026-10-04）

用户明确认可三个真实分支并授权最终收尾。Search=Tavily、固定 query `OpenAI official website`、1 次真实请求、HTTP 200、10 条候选；Provider=DeepSeek V4.1-Flash / `deepseek-flash`、thinking disabled、fallback none、1 次真实请求，仅固定虚构材料，1 条 Proposal 人工接受后由 OpportunityResearch 原子写入，独立核验=false、无重复；Feishu=user、指定文档 1 次正文读取、revision 25、224 字节已确认缓存保存 Raw，重放相同 receipt、取消无空 Raw。Feishu 写入和 Career→Feishu 均为 0。

真实 Search 与 Provider 按用户分别授权的材料隔离执行：本次没有把 Tavily 结果发给 DeepSeek，不宣称同一份真实搜索结果的连续模型整理链已执行。该产品接缝沿用已通过的受控 G5 证据。Feishu 真实读取走官方 user 只读 CLI，保存走正式 Materials；本轮没有新增 App 内置 live Feishu adapter、通用 CLI 执行能力或飞书写能力。回归只用 mock / 临时夹具 / 已持久证据，未重复任何真实服务请求。

审查新增发现 DeepSeek 响应回显认证值可能进入 Proposal，先用虚构 credential 复现，随后拒绝原始、外层 JSON 和内层 Proposal 的回显；规范 JSON 转义同时匹配，覆盖双引号、反斜杠及 Unicode 编码。Tavily 同路径补齐。输出失败只给脱敏固定错误，不自动重发；受信内存 finally 丢弃临时值。额外集成验证没有 Proposal、正式 Research、DB/recorder/backup 残留。未读取真实 Key，没有真实泄露证据。

Research nature 显式映射保持：hypothesis→inference，fact_statement→fact_statement；observation 在 Research TaskPolicy 被拒绝；generic AI unknown 不能表达的 contract gap 保留，不猜测、不改 Frozen。原 accepted 测试条目不变。

最终 Acceptance 104：38 PASS_ALREADY、32 PASS_G5、28 PASS_G6、5 DEFER_M、1 CONDITIONAL，EXTERNAL_LIVE_PENDING=0，DEFER_G6=0；总计 104。原分类列保留历史；G6 28 个已完成分支逐项链接其真实本地证据。G5 产品/桌面/J-01～J-09 PASS，G6 LOCAL PASS。Developer ID / Notarization / x64 READY / NOT RUN；Migration M NOT STARTED。

最终命令、数量、审查与隐私审计见 [j07-final-closeout.json](j07-final-closeout.json)。Secrets 审计采用存储/命令路径检查与模式检测，Agent 未回读 Key，不声称用真实 Key 做逐值比对。Provider 响应文档只保留必要标识、正文 SHA、状态、用量与引用，不复制完整响应或重复正文。Frozen 产品12/12和架构8/8 SHA不变。最终 checkpoint、远端一致性与 Issue #31 关闭以 Git/Issue 收尾记录为准。

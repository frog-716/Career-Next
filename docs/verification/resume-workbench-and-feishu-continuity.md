# 指定 Resume 纸面模板 / Feishu 连接续期

状态：2026-10-08，用户纠正后的真实入口已接入，当前简历已导入隔离的本机审阅副本，并经正式 owner 保存、重开、命名版本和 PDF 导出。等待用户界面审阅；未 commit / push。

## 正确来源与纠正

用户指定的妙搭应用由官方只读源码导出获得。实际运行入口为 `client/index.html → legacy-entry.ts → legacy-app.js + legacy.css`。`ResumeEditorPage / ResumePreview` React 表单脚手架不是该应用实际运行界面。此前双纸面与表单版均被用户否决，不计为验收通过；这些活动编辑入口已移除。

当前移植实际 A4 单纸面：姓名/联系区、深灰分区标题与横线、技能/工作/项目/教育的源稿顺序、三列表头及要点。Editor 仍为原 Career Tiptap 输入适配器；仅直接编辑一张纸，不生成第二份预览正本。不接入来源应用的云端保存、整稿 localStorage、截图 PDF 或其他导出系统。

## Career 正式边界

- 入口：`frontend/features/resume/source-paper.{tsx,css}` 和原 `index.tsx`；Tiptap 顶层区块、稳定 ID、save session、AI Apply 与独立 Undo 继续使用既有路径。
- Career schemaVersion=1 可选扩展 entry 字段，明确保存项目名称/职责/日期、单位/岗位、学校/专业；`miaoda-paper` 是指定版式。源稿显式对齐与纸面比例持久化，不从 CSS 猜业务内容。旧基础文稿与已冻结 PDF 保持可读、不重新生成。此前实验模板只保留只读兼容处理，不作为普通用户新选项。
- Profile 仍是本人身份 owner，连接 nickname/avatar 不进入它；修改身份仍由正式 Profile 保存。当前源稿只导入独立 PRIVATE review profile，没有覆盖已迁入的 REAL Profile 或既有 Resume。
- PDF 静态 renderer 读取冻结 Career JSON，由原固定 Chromium 打印。使用源稿同一字形与间距的本地字体，固定字体资源经过摘要验证，其他资源请求全部阻断。不调用截图 PDF，不向远端加载字体。
- 字体派生版 `Career Resume Sans` 保留原字形/间距/变化轴，只去除共享字形的兼容偏旁 cmap 别名，避免 Chromium 的 PDF ToUnicode 把普通汉字映射为偏旁。遵守随包 OFL1.1 并重命名。源字体 SHA256 `f971e3bff46f76b49e1d5510556c2297c618ec4b491a295a4e741cdd38257799`；派生版 SHA256 `81de8e80a42588e0b74bfc50a6d478363a076d1a3859aed90a196ec3b9298bff`，移除379个别名。字体没有用户正文。

## 本次私密当前稿与导出验收

- 源稿从当前已授权妙搭页面 DOM 只读取得，不操作其保存/版本/PDF按钮。38个正文/表头字段转换前后文本一致；保留 marks、已存在链接和对齐。真实内容、原件、PDF、工作区、缓存及运行日志全部位于 Git ignored 的 `out/miaoda-resume-adaptation/`，不进入 Git。
- 原稿3个项目职责和3个项目日期均为空，没有替用户补写。UI 可以提示填写；正式 PDF 不包含空字段提示、`undefined` 或技术 ID。
- 曾检出源字体的 PDF 字符映射问题：视觉正常但复制变成兼容偏旁。派生字体后真实 PDF 的36个非空正文/标题均可提取核对一致，replacement character / 偏旁替代字符均0；原文的不可换行连字符提取为等价普通连字符，Career 原文仍原样保留。
- 正式链：Profile 保存 → 机会隔离副本 → Resume 保存 → 回读 → 受控创建命名版本 → 未命名导出 → 正式版本 PDF blob。所有回执及内容均核对；最终文件是1页 A4，原联系方式与网页链接保留。所有页均已渲染逐页检查，不截断、不以截图替代 PDF。
- 接入回归发现并修复：空三列表头鼠标定位、paragraph 默认节点优先级、composition 结束读取当前编辑器、输入正文的 DOM 容器稳定性。旧测试仍保留非法内容阻止保存/冻结、未知结果保留草稿和只继续原命令等断言。
- 中文 composition 为合成自动回归，不冒充本轮真人 macOS IME 验收。

## Feishu 故障原因与修复

原连接层在本地授权状态 `needs_refresh` 时直接拒绝执行，将可续期的短期凭据误判成必须重新授权。官方 CLI 的 user 请求本来可以在受信任进程内锁定并续期凭据；Career 不读取 token。

现在有既有连接缓存时，状态检查允许一次续期；主动连接也允许可续期状态。并发状态、身份、头像检查共享同一次恢复。失败后不按时间自动重试，只有用户明确点击或本地授权恢复后再继续。真正失效、撤销或 refresh token 到期仍需重新授权，无法保证平台授权永久有效。

实际身份读取仍固定为本机确认的当前 user Contact User endpoint，只取 nickname 与头像，不提供任意用户、raw API 或 bot fallback。没有新增权限、OAuth 架构、文档查询或飞书写能力。

依据：[官方 CLI v1.0.96 的 UAT 续期实现](https://github.com/larksuite/cli/blob/v1.0.96/internal/auth/uat_client.go)。

## 最终验证边界

本次不读取旧 Career；不读取飞书 Bitable 新记录、文档或附件；不调用 AI/Search，不写飞书，不保存待审批的 F3-C Raw。REAL 业务内容只读审计，所有当前稿写操作仅在 PRIVATE 审阅副本。Frozen Product Spec / Architecture、Sidebar、设置布局不改。

最终命令与结果见下方收口记录。之前针对错误模板的自动 PASS 属于已否决尝试，不代表正确模板的人工作品审批。

## 2026-10-08 收口记录

- `typecheck` / `build` PASS。
- 全相关回归：26文件 / 55测试 PASS；最后针对源纸面只读 focus、恢复保护、AI独立Undo、composition 与实际PDF再执行5文件 / 10测试 PASS。原有断言没有放宽；CSS缺省的IIFE夹具改为填写实际正文内容容器，而非删除编辑器内容容器。
- 真实 Chrome：保存状态、刷新重开、1张直接编辑纸面、4分区/5组表头、冻结历史、600px均核对。隔离当前稿通过正式导出按钮下载成功，下载文件再次逐字段及逐页检查：1页A4，36个非空正文/标题全部匹配，乱码与偏旁替代字符0，源网页链接保留，空职责/日期不印提示。下载观察回调未收到事件，但实际Chrome下载文件、正式版本及PDF内容验证均成功；没有因此重复点击导出。
- REAL 38张业务表与原F1缓存不变；Product12/12、Architecture8/8与HEAD逐字节一致。待提交代码/文档未发现本次私人正文或Key模式。真实当前稿/PDF/工作区全部为本机ignored资料，不进Git。未commit/push，未导入F3-C Raw。

### 用户要求的版面留白调整

仅调整当前私密审阅稿的既有 `layout.contentScale`：0.965 → 0.99；未改模板源码、正文、marks、来源链接或旧冻结版本。试排后选择一页A4且有余量的比例，通过正式Resume保存/回读/新导出完成。底部文字留白30.58mm → 16.29mm；36个非空正文/标题逐项匹配，乱码0、来源链接保留，逐页视觉检查通过。Chrome刷新后仍为已保存，正文计算字号12.1275px。旧PDF与旧版本保留；本次没有外部服务调用或正式REAL资料覆盖。

### 后续纠正：真实 A4 屏幕纸面与简历内身份编辑

用户继续指出屏幕不像一张 A4，并要求姓名/联系/网页/GitHub 在简历中直接修改，而非设置统一维护入口。本次修复屏幕显示和编辑入口，不改变 Frozen 正文，不改 Profile/Resume 的既有保存归属。

- 问题可复现：604px 窗口把纸面宽度压到484px，正文重新换行后纸面高1492px，宽高比0.324。窄屏还覆盖了字号/纸面最小高度；通用 Tiptap 的段落最小高度、list padding 和表单 grid 间距盖过来源样式。此前 PDF 单页 PASS 不能证明屏幕纸面一致。
- 保持源模板固定210×297mm与9mm边距。只缩放观看层，编辑器排版宽度不随窗口改变。非占位 outline 替代占内容宽度的边框，正文可用宽度与打印区同为约726px；恢复原行高和与静态renderer一致的list间距。长稿不裁切，真正超页仍显示提示。历史纸面也采用同一观看层；不重建live editor。
- 当前私密审阅稿最终实测：604px窗口中约484×684.51px，宽高比0.707068（A4为0.707071），一张纸，无横向溢出。字号、正文、marks、layout.contentScale、当前身份及既有PDF未改写。
- 指定纸面姓名与联系方式可原地编辑；网页/GitHub可增加、修改显示文字及地址、移除，保留其他链接。保存提示与按钮放在纸外，避免工程控件撑高文稿。工具栏“保存”能够提交未保存身份输入；导出仍要求先保存，并冻结选定Profile/Resume版本。
- 设置移除“我的基础资料”编辑入口，默认进入连接；其他设置能力保留。仍只调用正式Profile命令，身份改动不混入正文undo，历史身份/PDF不被覆盖。对“只影响本简历还是同步所有当前简历”已发起询问；未收到决定前保留既有共享语义，并在保存操作旁明确说明影响范围，不擅自建立第二份身份正本。
- TDD先复现纸张比例、编辑区域宽度、单行额外高度、纸面身份不可编辑及设置重复入口的问题，再修复。最终相关19文件/40项PASS，另核对网页/GitHub新增保存、保留既有链接的UI回归PASS；typecheck/build与diff check通过。覆盖600/1280、合成composition、marks、AI独立Undo、历史/PDF、失联回执、辅助面板与草稿连续性。真人macOS IME未在本轮重新验收，不冒充真人PASS。

只用TEST夹具写测试；当前私密审阅稿与上次导出快照回读一致。没有新Feishu、Search或Provider请求，没有读取旧Career/Secret，F3-D资料保存不受影响。当前改动未commit/push。

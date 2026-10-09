# 连续交付：资料主链、简历纸面与日常旅程

状态：READY_FOR_DAILY_USE（本地日常旅程与受控模拟外部链）；待用户统一视觉复审。基线 `cb84f2c4f326a67650635e6326d7a3d367f79abc`。不以局部通过宣称全产品完成。

## 正式实现

- 飞书云文档：已有元数据候选的后端 opaque ref → 用户明确查看 → 固定官方只读接口、版本前后核对、最多5页/500块/180KiB → 完整自然预览 → 用户明确保存 → 正式 Materials owner。图片、附件、关联内容只保留说明，不下载/展开。
- 同连接账号/文档/来源版本重复确认复用一份 Raw；来源新版本另存，旧正文不覆盖。同版本内容冲突拒绝。来源保存文档与账号摘要、版本、读取时间和内容摘要。待办保留官方状态，缺失则明确未知。
- 预览、取消、确认与保存回执分开。响应丢失先检查原命令，只有正式 `not_found` 和同一原意图才允许用户显式续存；没有自动发送/重试。
- 保存后正式回读与预览核对；“用这份资料整理知识”是独立人工动作。Raw 不自动变 Wiki/Project/研究事实。AI Context 读取、真实外发与正式提案采纳继续逐次分开。
- Bitable 保留结构、最多5条记录与可选单条 Raw，非整表同步。恢复/连接换代清理旧来源引用、预览与迟到读结果；确认前取消撤销生产者。
- 添加资料主线为来源→资料→内容→保存，技术信息收在来源详情。四入口、A6品牌和方案3动效、右侧设置/头像辅助菜单保持。
- 指定简历模板为原始纸面结构，不把宽度压窄成新布局。210mm×297mm纸面用视图缩放，9mm内边距及实际打印区域一致；姓名、联系方式、网页/GitHub在纸面编辑，保存仍由 Profile owner共享当前简历，历史快照冻结。跨模板恢复/撤销保护未保存身份输入。

## 验证与限制

开发使用隔离 TEST DATA，未读取新的真实飞书正文，未调用真实模型/Search，未读取旧 safeStorage。F3-D既有隔离测试Raw保留，不转入正式资料库。

独立测试执行者仅从README/MAP/正式产品文档理解使用。环境为正式arm64 Career.app启动链与独立TEST业务工作区；外部I/O仪器化副本仅替换Feishu CLI、Provider/Search fetch、Keychain边界。原生launcher、Node宿主、writer及React文件逐字节校验；原始正式包不改。TEST副本runtime加载shim，故不能冒充完整未修改签名包或真实外部验收。完整包未经插桩的入口另行验证。

最后无工程阻断项；没有运行的项目明确NOT RUN。新的真实云文档主链未另外授权读取，故只记SIMULATED PASS，不记真实联网PASS。

## Gemini真实结果

本轮Chrome新thread均确认3.8 Flash＋扩展思考。首轮及唯一精简重试均拒绝，没有有效三方向比较或代码；不再重试/换模型。不把本地收口叫作Gemini设计。保持已审批Aura/A6，只落实用户明确的资料四步与纸面修正。原答与模型证据仅在Git ignored `out/design/delivery-gemini/`，无真实Career资料上传。

## 独立审计

`docs/audit/FINAL-REVIEW-REQUEST.md` 是交接入口。独立网页GPT-6 Pro审查尚未执行；此处工程review不替代它。发布签名、公证与x64仍READY / NOT RUN。

## 当前已执行的独立旅程

空上下文执行者在真正Chrome、正式打包启动链与TEST业务库连续完成：本地导入取消/确认回读；模拟云文档选择/读取/取消/确认/同版本去重；Wiki人工引用；项目、任职、人物和关联；机会；纸面身份、正文加粗居中、保存、命名版与实际A4PDF；沟通、面试与Offer；AI本地读取不外发的区分、模拟最终外发及人工采纳；帮助、反馈草稿；离线保存结果未知核对与同意图续存；两标签冲突保护；完整备份及实际恢复对照标记验证。

已修并复测的环境问题：仪器化preload原先误拒绝正式只读snapshot Worker（source/destination/driver），导致TEST备份失败。修复只允许同一TESTprofile和本包driver，越界仍拒绝；正式备份算法未改。完整副本（DB＋blobs）只读业务/关系检查通过，独立UI备份恢复复测通过。

已修正式问题：连接成功返回材料页状态不更新；AI原停止回执确认后状态提示未清；工作区恢复后旧飞书引用/预览未全部失效；Bitable取消确认前迟到保存；跨模板恢复/Undo丢失未保存身份输入。修复证据分别位于连接事件回归、g6-ai-control-ui、connector dispose及正式Materials闸门集成、resume-session身份保护测试。

已知界限：分区标题是Career section.title，不是独立格式正文；标题固定纸面样式，输入适配不接受标题marks，正文bold/italic仍保留。恢复后连接外发权限停用；停用Provider时部分既有AI任务入口不可见，目前仍列UX限制。新真人macOS IME、外部服务撤权与真实outcome_unknown未在本轮重跑，不用模拟替代其真实PASS。

## 最终回归与review（2026-10-09）

- 全量unit：91文件/304测试PASS；随后受影响brand/Resume 3文件16测试、最终轮廓火苗品牌用例、缓存通知大级联边界均PASS。
- 全量integration：103文件/480测试，首跑476通过、4失败。打印取消时序涉及文件2/2重新运行通过；Bitable三文件fixture在显式连接换代前建立可信缓存后3/3通过。没有把这段证据冒充一次480/480全绿。
- 缓存隐私收口：正式host/HTTP双窗口3/3（针对性清除、未知映射保守清除、清除未完成但已封锁）；相关后端42项与前端5文件14项回归PASS。新测试均先复现相关故障，再修复；清除仅使用新建合成TEST资料，原F3-D Raw未动。
- 最终typecheck/build/package通过；最新未插桩arm64包Node/Chrome、文件、冻结PDF、备份恢复及launcher重启/崩溃/中文路径回归2文件4测试PASS。既有打包安全回归4文件7测试PASS，未重跑真实服务。
- 最终v4仪器化隔离环境：29个原生launcher/Node/writer/React文件SHA与本次正式包一致。独立执行者再以只读方式确认原资料/关系/版本/实际PDF/accepted Research/反馈持久状态，600px四入口无溢出，初始品牌静止；自己的测试tab已关闭。完整旅程与截图在Git ignored `out/delivery-validation/empty-context-E2E/`，只含合成TEST资料。
- Standards/Spec缺口已修并复核：永久清除关闭相关云文档/Bitable正文与旧导入能力；缺少历史映射时只保守清理connector正文缓存，保留结构元数据和无关业务草稿。`purge_incomplete` 已封锁对象同样关闭缓存。全窗口收到严格无正文通知，所有迟到回应有generation保护，不能重新显示已清除正文；大级联通知上限与既有PurgeNotification一致。
- 隐私候选扫描无Key/凭据/运行时DB/私人正文文件；REAL数据库与active pointer的SHA和本轮只读基线一致。Frozen Product12/12、Architecture8/8逐字节不变。旧Career仅固定Git基线元数据查询，未读其实现。

## 本轮品牌最终状态

用户否决光束后已完整删除。按后续反馈沿豹子轮廓放置10个小火苗，耳朵/后颈/下方保持小尺寸，脸侧4个更小。页面进入停在第一帧，第一次轻滑才触发完整0.75倍动作；随后悬停是呼吸与豹身到Career字标的既有线条流转，离开归位。reduced motion显示静态完整字标；没有首页导航或新品牌照片贴片。实际隔离Career页面已接入，原参考视频与逐帧证据保持本地ignored。

## 明确未跑与剩余限制

- 新的真实Feishu云文档/真实Provider/Search：NOT RUN；本轮新增真实外发0，使用受控模拟边界。
- 新真人macOS简体拼音：NOT RUN。既有真人PASS保持历史事实；本轮没有把程序输入说成真人IME。
- Gemini：两次官方页面拒绝，没有有效设计方案；本地改动仅按已批准Aura/A6和用户明确反馈，不冒充Gemini设计。
- 停用Provider后的部分历史AI任务入口可见性仍是UX限制（P2），正式已采纳Research仍可读取，停止外发的权限边界未放宽。
- 独立网页GPT-6 Pro：NOT REVIEWED，交接包已准备；Developer ID/Notarization/x64仍READY / NOT RUN。

最终checkpoint包含本文件；精确提交链接在提交完成后生成的本地独立审计请求中。最终v5仅修品牌火苗/暖光被通用SVG图标stroke污染的问题：Aura样式回归先红后绿，正式页确认无黑边；29个正式包文件再次SHA一致，停止后的TEST资料完整复制再启动，未写REAL资料。用户复审统一使用Chrome的本地TEST Career页面，不代表真实外部/发布环境已经另行验收。

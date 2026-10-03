# G6 最终独立 Review

固定点 `befe2437a9b260237ae5f08a2d11517437a27032` 已确认有效且 diff 非空；最终生产源码 `e70f4de6574604a27ea94111af99cedb5d80e172`。审查命令 `git diff befe2437a9b260237ae5f08a2d11517437a27032...HEAD`、`git log befe2437a9b260237ae5f08a2d11517437a27032..HEAD --oneline`，补审 working tests / verification / MAP / AGENTS。源：用户 G6 请求、#26–30、Frozen DELIVERY/DATA/AI-RUNTIME/ARCHITECTURE/MODULES、项目规则及 architecture Skill。各轴独立，不用 Standards PASS 掩盖 Spec/failure 缺口。

## Standards

独立 Agent g6_f3：0 项明确规则违反、0 项值得执行的 smell 改动。Main/Contract 窄权限桥、公开 owner、单一 writer 与测试隔离保持；Coordinator 和 startup resolver 分别承载真实时序/恢复职责，没有通用框架。新增安全测试使用真实普通 artifact、真实 print/native 边界；standalone 进程与驱动 inspector 分开计量。原始失败、修正后有效结果、READY/NOT TESTED 区分清楚。少量测试 setup 不值得抽取无用框架。MAP/AGENTS 已解除历史 G3 阶段导航矛盾，只记录当前授权和入口。

## Spec

独立 Agent g6_f2：全部已修实质缺陷有实际回归；未发现越范围、读取旧 Career、Frozen 改动或真实外发。原 Main 配置生命周期缺口、双窗口 UI 缺口均补齐；首次桌面 batch exit 1 保留，不能重写为 0。原 native dialog 恢复选择是测试明确选择，不冒称真人。最终实体 sleep/wake 和完整 normal foreign/port 安全证据在审查提出后已补实测；只按各自范围升级为 PASS。真实 J-07、发布凭据/环境仍未验证，不能声称完整发布 PASS。

## Architecture / Security / Failure matrix

独立 Agent g6_f1：最终无未解决已确认 P0/P1。唯一业务 writer、模块私有写边界和可信 provenance 不放宽；受信 schema 从 bootstrap 注入，平台不导入业务私有实现。外来请求身份由可信接入端建立，fake actor 不能冒充 human；renderer 不获得 SQL、路径、Key 或任意执行 capability。

审查发现并关闭了以下缺口，红灯与失败记录未删除：

1. 第一次 save 留 pending/cipher 但无 binding 时，Main 误当 fresh 启用 fake；实际 EIO/EACCES red，9 项 resolver green + 最终正常包启动 provider_disabled。
2. 较早 save 完成后重开较新 disable；以及控制 ACK 逆序让旧 save 重写 durable binding。两次真实 runtime/vault red，按 intent 到达顺序串行、latest epoch 才 enable；5 项 owner 回归 + 两原生窗口实际系统加密/停用/重启关闭 green。
3. backup 内恶意 executable schema 用自报 migration/digest 通过并修改他域；实际 red，完整受信 SQLite schema 在任何候选关系读取前验证，11 恶意拒绝 + 3 合法兼容 green。
4. normal foreign/导航/print/无关端口证据原来被 G0 probe 混代。最终普通 App 24 次 foreign 真实拒绝、受限真实 PDF 窗口、外导航/popup 拒绝；无 Playwright 独立进程无监听/调试开关，旁端口不误停，2 项真实 PASS。
5. 真实 sleep/wake 原未执行；首次驱动连接关闭时保留 NOT VERIFIED。第二次直接普通 executable 与用户真实睡眠 140 秒后，同 PID 窗口由 Computer Use 正文/已保存/版本 1 历史读回，实际 PASS。

详细命令、exit code、测试名、hash 和边界见 [最终证据](g6-final.md)、[63 条矩阵](g6-failure-matrix.md) 与其链接 JSON。原 G5 两个真人回归（AI 独立 Undo 保留手工格式、ResumeVersion 保留 marks）在最终包仍通过。Frozen Product 12/12、Architecture 8/8 SHA 不变；根依赖/lock 与已发布 v1–v5 SQL 未修改，v6 仅追加。物理拔电未做，不混同真实 SIGKILL 切点；真实服务 NOT TESTED、Developer ID/Notarization/x64 READY / NOT RUN。

Standards：0 findings；Spec：本地缺口已补齐、外部仍明确待验；Architecture/Security：0 未解决 P0/P1。LOCAL G6 PASS，仅指本轮本地故障/恢复门。

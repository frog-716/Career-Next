# F3-D：已审批飞书记录预览保存为 Raw

状态：PASS。2026-10-08，用户明确批准只保存 F3-C 当前这一份预览。本轮不 commit / push，不继续下一阶段。

## 保存范围与证据

仅使用原 F3-C 隔离 TEST 工作区里仍存活的内存预览。先核对原后台 PID / instance、选中引用、审批 digest，再在可信本机内存中交接到新增保存接口。没有重新读取飞书，没有把正文写入临时脚本、命令参数、日志、fixture 或本文件。

| 项目 | 验证结果 |
| --- | --- |
| 原工作区 Raw 数量 | 0 → 1，新增恰好 1 条 |
| 已审批预览摘要 | b7f5c014bd7836b6e607f675c30cc58afef330efa7e790d6c91d14e98f408644 |
| 正文 | 403 UTF-8 bytes，正式 owner 回读逐字及字节摘要匹配 |
| 正文 SHA256 | 15dac176125952a05af2a9d7ea2922d77d78f0848d3bc008b59f7f985ff12ad9 |
| provenance | 来源类型、原 bitable/table/view/record opaque refs、选择/读取时间、上游时间 null、4 个保留字段、0 个复杂内容排除字段、preview digest 均与已审批预览一致 |
| 重复确认 | 同一 command 与另一 confirmation command 均返回同一正式 Raw，数量仍 1 |
| 其他业务资料 | 隔离工作区 42 张非 Materials 业务表内容 hash 未变，F1 身份缓存 hash 未变 |
| 新增飞书请求 / 记录读取 | 0 / 0 |
| 附件下载 / 关联展开 | 0 / 0 |
| Wiki 创建 / AI / 飞书写入 | 0 / 0 / 0 |
| Chrome | 已打开唯一 Raw，页面显示“已保存，以下内容从正式资料回读” |

原始飞书 ID 在 F3-B 未保留，不能猜回；本条 provenance 延续 F3-C 明确约定的 opaque 快照身份。上游更新时间仍为 null，未伪造。用户采纳资料不表示独立核验其事实。

## 正式保存链与安全边界

- Browser 只能提交 `commandId + previewRef + previewDigest`；不能提交正文、来源、token、原始飞书 ID、其他记录引用或任意路径。
- `platform/connectors/feishu/raw-preview.ts` 只提供当前已选、摘要一致的预览副本，无网络或 Raw 写权限。可信宿主的易失内存交接同样校验内容摘要、来源引用与字段清单，Browser 不拥有该入口。
- `application/materials/bitable-import.ts` 组合公开能力；正式 Materials owner 负责受控 staging、blob 发布、事务提交、SourceRef / retention / receipt 和回读。未直接写业务 SQLite 或拼接文件作为正式 Raw。
- 持久来源新增 Bitable record 类型，复用既有 `origin_json`；无需数据库迁移，旧飞书 wiki 来源继续可读。备份/恢复候选校验同步识别新来源。
- 并发确认共享一次保存；成功后通过 owner 的 provenance 与原回执识别同一预览。换确认编号或后台重启仍复用同一 Raw。结果未知时不自动再次保存；先核对原回执。预览失效、摘要变化、取消、正文覆盖或外来 Origin 均拒绝。
- 未新增 Settings / Sidebar / AI / Feishu 写能力。所有写入仅原 F3-C TEST 工作区；正式 REAL 工作区未操作。

## 回归

TDD 先复现保存接口缺失、非法内存交接及确认按钮缺失的失败；另补备份候选校验失败并修复。测试全部使用独立 TEST fixture，无真实飞书读取。

覆盖：一份预览保存、正式回读、内容/provenance 一致、同 command / 新 command / 并发 / 重启幂等、取消与丢失快照拒绝、非法字段/摘要/Origin 拒绝、旧来源兼容、备份/候选验证、600px 页面显式保存与单次点击。typecheck / build 通过；最终 14 个测试文件、44 项全部通过，涵盖 Materials、F1、F2、F3-A/B/C 相关回归。

Frozen Product Spec / Architecture 正文不变。真实记录正文仅存在于本地 Career 正式 Raw 与页面；运行资料与证据截图位于 Git ignored 的 `out/`。

# Legacy Proposal Read-only History

Issue [#34](https://github.com/frog-716/Career-Next/issues/34). 独立通用能力，服务 Frozen MG-02 / MG-03；不执行真实迁移，不继续 M1-B。全部输入为 synthetic TEST DATA，未读取旧 Career 或14条 REAL 资料，未调用 AI / Search / Feishu。

## 合同与 owner

- `contracts/ai/legacy-history/schema.ts`：Research / Resume 闭合子类型；原身份、快照 digest、目标、理由/依据/来源、已知时间及归档时间。无 arbitrary JSON、Task、Operation、执行权限或 Provider 字段。`readOnly=true`、`independentlyVerified=false`。
- `backend/ai-runtime/legacy-history/`：独立 `ai_legacy_history` 表；公开 `legacy-history.list`（分页）和 `legacy-history.read`。不进入 `ai.list` / `product.list`；当前 decide 命令无法操作历史身份。
- 原状态 pending / accepted / rejected / resolved / superseded 原样保留；unrecognized 保留原文字，不推断。历史 accepted 不授予核验或执行语义。
- 目标只接受显式同类型 owner reference。读取时按正式 owner 可用性投影 resolved / unresolved；不按名称匹配，不创建目标。来源可保留明确映射的 owner reference，未映射历史身份不虚构关系。
- `staging.ts` 仅为后端内部写入能力，不注册普通 RPC / preload / Renderer 操作。校验隔离 `migration-staging/<UUID>` 路径、专用 marker 与数据库 workspace 身份；每次写前重新检查，active pointer 指向该目录后拒绝写入。还须登记为 ready staging；跨工作区本机清除决定优先于旧 staging DB 的 fence。
- 唯一键：source system + snapshot digest + source record identity + proposal kind。同键不同内容明确冲突，绝不覆盖；同标题不同身份不合并。

## 备份与隐私

应用 schema 8 仅新增 archive 表；已发布 1–7 SQL不变。备份含独立历史；恢复候选校验闭合类型、来源键、行身份、明确映射关系及 purge fences。旧 schema 5–7 备份仍可核验，正常应用升级后建立空历史表；不会自动导入旧数据。

永久清除通过现有 data lifecycle 范围审批。历史可作为独立维护对象清除；正式来源/目标被清除时，其关联 archive 全部正文、理由、依据、来源内容同步变为无正文墓碑，仅保留身份、原状态及时间。不保留标题/建议文本。重复 staging 导入不能恢复已清除正文；有正文但引用已清除身份的候选拒绝恢复。备份删除仍按用户已批准的副本范围执行，未选择删除的旧备份仍遵守既有警示与恢复确认规则。

## 页面

设置与资料维护 → 历史 AI 建议。无新增一级导航。仅浏览列表/详情，显示“来源：旧 Career”“只读历史”“原目标当前无法解析”。没有 Accept / Reject / Retry / Apply / Edit / Re-run。收到 purge 通知时清掉历史缓存并重新读取，迟到响应不能重新显示旧正文。详情请求序号避免 A 的迟到响应覆盖后选 B；分页单飞并禁用等待按钮，避免重复追加。

## 验证

- TDD 红灯证据：合同、存储、公开桥、purge、candidate validation、staging active 阻断、只读详情，均先失败再修复通过；仅本地 ignored 输出保存日志。
- 新能力：4 unit + 13 integration + 1 browser UI + 1 packaged arm64 通过。覆盖原状态/unknown、强类型、readonly、列表与 decide 隔离、无任务、去重/冲突、未解析目标、分页/详情乱序、恢复激活、候选防篡改、清除与 staging 隔离/跨工作区副本清除。
- Typecheck / build / arm64 package 通过。最终全量 unit 58文件、172/172通过；integration 82文件、417/417通过；最终 packaged arm64 1/1通过。初次并发运行的资源争用超时及升级测试旧版本预期已处理，最终完整低并发回归全部通过。
- Packaged Playwright：正常 arm64 包，四个一级导航、5种 Research 状态、Resume accepted、明确 unresolved、无执行按钮、当前两个 AI 列表为空，通过。
- 独立 Computer Use：同一正常 arm64 包、独立 TEST DATA profile。实际点击查看 Research superseded 与 Resume accepted 详情，检查未识别状态、只读/非核验提示、无法解析目标、滚动及当前 Product/Wiki 空任务页，通过。不是用户真人 IME 验收，本功能没有 IME 改动。
- 本地证据位于 ignored `out/verification/legacy-history/`；不提交 DB、profile、截图或构建产物。fixture seed 仅生成虚构验收资料，不包含旧数据发现、映射或迁移脚本。
- Frozen Product Spec 12/12、Architecture 8/8 全部与本轮起点 SHA256 一致；不读取凭据、不触发 AI / Search / Feishu 外发。Standards 最终复审 PASS，0项发现；Spec 最终复审 PASS，初审的 staging 副本清除和详情/分页竞态均已补红灯、修绿并复审确认。Architecture / privacy-purge review PASS：独立存储与 owner、窄公开只读合同、私有 staging 写入未进入运行包、不恢复执行权、清除与恢复同守既有生命周期边界。

已登记的隔离 staging 纳入清除副本清单；未登记残留启动时列为 quarantine。用户明确保留 staging 副本时，后续仍不得写入已清除来源的历史正文。副本删除继续严格遵守已批准范围。

## 停止点

#33 保持 OPEN。本轮仅补齐 archive capability；M1-B importer 未继续实现，未进入 M2，未迁移真实数据。

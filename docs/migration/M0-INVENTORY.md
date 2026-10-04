# M0｜旧 Career 只读资料盘点

基线：`93cb23759d2450b0c1e1f03a5269d60e7f8194cf`。盘点时间、逐库统计与脱敏引用见 [M0-INVENTORY.json](M0-INVENTORY.json)。

M0 盘点已完成，存在 UNKNOWN 和待核对风险。没有迁移、恢复、清理、合并、纠正或导入；不代表 Migration M 验收通过。

## 资料位置与证据

- 主实例 PID 44363，工作目录 `/Users/frog/Projects/Career`；运行记录的资料实例标识与 `~/Library/Application Support/Career Data/.career-instance` 一致。启动默认目录及已安装周期备份配置也指向此目录。没有调用旧后台接口或控制其进程。
- 主数据库：`~/Library/Application Support/Career Data/workspace.sqlite3`，1,572,864 bytes。`user_version=6`，schema cookie=4，journal=delete，无非空 WAL/journal。SQLite integrity=ok，foreign_key_check=0；这不代替 JSON 内业务引用检查。
- 另有实例 PID 6544，资料身份匹配 `Career Data-cutover-candidate-20260920`，工作目录为废纸篓中的历史 review worktree。两套实例未关闭、未合并；不能把所有当前运行实例当作同一工作区。
- 附件/PDF：`Career Data/artifacts/`。`Career Data/resume-staging/` 为空。Raw 和 Wiki 正文主要在数据库内，不是独立文件。
- 受管理备份：`Career Data-backups/`；额外历史审计备份位于 `Career Migration Audits/`。
- 共发现 21 个持久 SQLite 数据集，包括主库、历史副本、备份、历史恢复检查副本。逐库数量和分类见 JSON，不累加为新的用户对象。
- `Career Data/career.db` 和项目 `.career-runtime/career.sqlite` 均为 0 bytes，属于 SYSTEM 占位候选，不是业务库。

## 分类口径与数量

REAL 仅在真实身份/用途有明确证据时确认。此次没有建立这项证据，REAL=0 **不表示没有真实资料**。TEST 只依据 `demo_dataset_id` 或持久 `demo_manifest` 成员身份。未标记、用户编写、空白创建、旧稿导入都保留 UNKNOWN，不按名字、正文或日期猜测。

主库业务实体及辅助关系共 84 条：REAL=0、TEST=40、UNKNOWN=44。SYSTEM=223 条，包含配置、回执、操作、审计和基础元数据，不计入职业资料数量。通用 revisions=203 条另计（TEST=17、UNKNOWN=178、SYSTEM=8）；Research 内嵌条目 14 个另计，不重复加到 84 个容器/记录中。

下表由结构化清单生成，文件数包含通过 artifact 的间接关联。

| Type | Total | REAL | TEST | UNKNOWN | Files | Unresolved refs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Profile | 1 | 0 | 0 | 1 | 0 | 0 |
| Company | 4 | 0 | 1 | 3 | 0 | 0 |
| Opportunity | 5 | 0 | 1 | 4 | 0 | 0 |
| Research | 3 | 0 | 1 | 2 | 0 | 0 |
| Resume | 5 | 0 | 0 | 5 | 0 | 0 |
| ResumeVersion | 2 | 0 | 1 | 1 | 2 | 0 |
| Submission | 1 | 0 | 1 | 0 | 1 | 0 |
| Communication | 1 | 0 | 1 | 0 | 0 | 0 |
| Interview | 1 | 0 | 1 | 0 | 0 | 0 |
| Offer | 1 | 0 | 1 | 0 | 0 | 0 |
| Project | 4 | 0 | 1 | 3 | 0 | 0 |
| Employment | 1 | 0 | 1 | 0 | 0 | 0 |
| Person | 1 | 0 | 1 | 0 | 0 | 0 |
| Raw / Materials | 8 | 0 | 5 | 3 | 0 | 0 |
| Wiki / Cognition | 7 | 0 | 4 | 3 | 0 | 0 |
| Proposal | 12 | 0 | 0 | 12 | 0 | 2 |
| Feedback | 2 | 0 | 1 | 1 | 0 | 0 |
| Legacy auxiliary / relationships | 23 | 0 | 18 | 5 | 1 | 0 |
| File metadata | 2 | 0 | 1 | 1 | 2 | 0 |

Research=2 个当前研究容器 +1 个 Demo 历史 snapshot；14 个内嵌条目均为 UNKNOWN 来源分类，旧 nature=unknown、evidence_status=lead，independently_verified=false。没有升级为已核验事实。

Raw/Materials=3 个 raw_material（UNKNOWN）+3 个 knowledge_source、1 个 project_source、1 个 work_evidence（均 TEST）。Wiki/Cognition=3 个 wiki_knowledge（UNKNOWN）+1 个 wiki_entry、3 个 knowledge_candidate（均 TEST）。这些是旧库计数口径，不是新系统字段映射。

## 文件完整性

主库 2 个 artifact/PDF 均存在，文件大小和 SHA256 与数据库匹配；缺失文件=0，未引用业务文件=0。所有 21 个数据集的 artifact 引用也逐一检查：缺失=0，未引用业务文件=0。没有提取或提交 PDF 正文。

| Class | Bytes | SHA256 | Owner references |
| --- | ---: | --- | --- |
| TEST | 22668 | `8d8a5563e64b9acf4a8771fbcfd44fd4693a6afcd4ce4a54a82ec50643b2d082` | 5: artifact, submission, editor_version, resume_use, resume_use |
| UNKNOWN | 30918 | `eb84f5c8efd07280bf9846dad92b4531b275f880f8f44a6f2422853469b05379` | 2: artifact, editor_version |

第一份物理 PDF 被多个历史 owner 引用，包括两条 ResumeUse；这是共享引用事实，不是自动合并或复制文件的依据。对象 ID、业务文件名和引用 ID 在清单中使用 SHA256 标识，未提交姓名、联系方式、来源正文或私密文件名。

## 高风险旧语义：只报告，不修复

| 检查项 | 结果与边界 |
| --- | --- |
| 多份当前 Resume / 共享简历 | 当前存储槽为 resume=1、editor_draft=1、resume_document=3；后者 provenance 为 blank=2、legacy_draft=1。不同旧正本/目标文档并存，不能直接当作五份同语义当前稿，也不能自动合并。ResumeUse=2，引用同一 Demo PDF；未证明存在其他共享简历入口。 |
| 普通版本与实际投递 | editor_version=2（TEST=1、UNKNOWN=1）；一份标记 ordinary，另一份旧 version_kind 缺失。Submission=1（TEST）；冻结版本 document、PDF snapshot hash/size 一致，但没有独立真实发送证据，实际送达材料一致性未验证。 |
| T14 / qualification | 当前盘点的业务 JSON 未命中这两个标记；不代表历史副本或退役语义不存在，未重建或运行旧任务。 |
| D4 / Cognition 自动提炼 | 业务 JSON 中 D4 标记涉及8条，cognition 标记涉及7条；wiki_cognition_compiler 历史操作=6（成功3、失败3）。当前 wiki_knowledge 类型为 fact=1、observation=2，不能仅凭类型判断手工/AI 起源。原状态保留，未自动接受提案。 |
| 旧 Proposal / AI task | Proposal=12：accepted=4、rejected=2、pending=4、resolved=1、superseded=1；均未有足够真实/测试证据，保留 UNKNOWN。历史 ai_operations=26，旧执行权和授权没有恢复。 |
| 已删除但仍在旧表 | revisions 中1个对象身份没有当前对象；缺少独立删除依据，只列为历史孤儿身份，不能推断已删除或可清理。 |
| Raw 引用 | 本次已识别的 Raw/source 引用未发现断裂；不等于所有退役自由文本引用均已覆盖。另有1个旧 Resume Proposal 的 document_id 和 opportunity_id 找不到对应目标，合计2个未解析引用。 |
| 同名 Person / 重复身份 | work_person=1（TEST），本库无同名组；domain_company.match_key 与 work_project.name 的规范化比较也无重复组。跨副本相同 ID 是历史重复存储，不自动认定是同一个真人或新对象。 |
| Project / Employment 历史关系 | employment=1、employment_stage=1、project=4、participant=1。当前已识别显式关系均有目标；journey_episode=2 为独立旧历史。语义、时间、真实身份仍待用户核对，不强合并。 |
| Opportunity 状态与历史 | 5个机会当前状态与各自最后 revisions 状态一致；1个 Demo 仅有 legacy status、无 phase/result。真实职业时间线没有外部核验，不能认定历史现实无冲突。 |
| 未知日期 | 1个 journey_episode 缺少/开放 end_date，1个 Demo Opportunity 缺 created_on 与 phase_changed_on。未猜日期；开放结束日期可能代表仍在进行，不能擅改。 |
| Research / Wiki 双正本 | 2个当前 Research 容器与 Wiki 多套旧对象同时存在，已保留各自来源关系；没有把 Research 复制成 Wiki、没有判定两份内容谁覆盖谁。 |

## 备份

受管理备份6份：清单均声明 complete，文件 SHA256、DB 引用、SQLite integrity 与外键检查通过；每份含1个 PDF。本次没有执行恢复，只确认文件/数据库层完整，不声明恢复语义验收。额外历史审计备份9份：文件校验通过，但旧清单没有 complete 状态，整体状态保留 UNKNOWN。失败状态未发现，没有删除或恢复备份。

| Backup under Application Support | UTC time | Inventory status | Business files | IDs absent from primary |
| --- | --- | --- | ---: | ---: |
| `Career Data-backups/20260921` | 2026-09-21T07:00:03.138730+00:00 | COMPLETE_FILE_AND_SQLITE_CHECKS | 1 | 0 |
| `Career Data-backups/20260928` | 2026-09-28T07:00:02.822220+00:00 | COMPLETE_FILE_AND_SQLITE_CHECKS | 1 | 0 |
| `Career Data-backups/career-backup-63c0188e-4c67-402b-8434-aaaadcb55b21` | 2026-09-26T12:28:46.228048+00:00 | COMPLETE_FILE_AND_SQLITE_CHECKS | 1 | 0 |
| `Career Data-backups/career-backup-8eb74560-41c5-4f1a-b760-b7db995ba8f3` | 2026-09-26T12:26:34.286420+00:00 | COMPLETE_FILE_AND_SQLITE_CHECKS | 1 | 0 |
| `Career Data-backups/cutover-rehearsal-20260920` | 2026-09-20T02:10:57.089250+00:00 | COMPLETE_FILE_AND_SQLITE_CHECKS | 1 | 0 |
| `Career Data-backups/pre-stage3-local-only-20260921T014451Z` | 2026-09-21T01:45:15.390631+00:00 | COMPLETE_FILE_AND_SQLITE_CHECKS | 1 | 0 |
| `Career Migration Audits/batch-e-20260918T034438Z/post-write-v5-backup` | UNKNOWN | UNKNOWN | 1 | 6 |
| `Career Migration Audits/batch-e-20260918T034438Z/pre-e-v4-backup` | UNKNOWN | UNKNOWN | 1 | 0 |
| `Career Migration Audits/batch-e-20260918T034438Z/prewrite-v5-backup` | UNKNOWN | UNKNOWN | 1 | 0 |
| `Career Migration Audits/batch-f-20260918T062904Z/post-f-v5-backup` | UNKNOWN | UNKNOWN | 1 | 10 |
| `Career Migration Audits/batch-f-20260918T062904Z/post-f-v5-backup-r2` | UNKNOWN | UNKNOWN | 1 | 10 |
| `Career Migration Audits/batch-f-20260918T062904Z/pre-f-v5-backup` | UNKNOWN | UNKNOWN | 1 | 0 |
| `Career Migration Audits/batch-f-20260918T062904Z/v6-fence/post-v6-f-backup` | UNKNOWN | UNKNOWN | 1 | 4 |
| `Career Migration Audits/batch-f-20260918T062904Z/v6-fence/pre-v6-v5-backup` | UNKNOWN | UNKNOWN | 1 | 0 |
| `Career Migration Audits/batch-f-20260918T062904Z/v6-fence/v6-clean-backup` | UNKNOWN | UNKNOWN | 1 | 0 |

4份历史审计备份含当前主库没有的业务身份（分别6、10、10、4条）；跨备份可能重叠，不合计成已删除对象。当前库没有不代表可丢弃，也不证明是真实资料。详细 hash、独立数量和缺失身份标识见 JSON。

## 隐私与只读保护

- 未调用 AI、Search、Feishu；没有向外部发送旧资料。只读 SQLite 使用 mode=ro、immutable=1、query_only，不导入或执行旧应用模块。
- 已枚举旧资料/附件/备份/历史证据文件在盘点前后 size、mtime、SHA256 均一致，数量见 JSON。旧业务数据库、原件与备份没有本轮写入。两个旧后台实例未被控制，仍可能由其他活动改变资料。
- Frozen Product Spec 12/12 与 Frozen Architecture 8/8 均不变。仅生成盘点结构、分类、hash、引用与风险，不保存正文、PDF、公司私密内容或联系方式到新库/Git。
- 有1个 AI 模型配置、1个 Search 配置引用受保护凭据；历史实现指定 macOS Keychain 存储类别。本轮没有查询 Keychain，没有读取 API Key 或密码，没有验证 Keychain 条目的实际存在/可用性。
- **检查失误已披露**：最早的元数据程序整体解析过一次旧 runtime/control.json，token 字段进入该本地临时进程内存。token 值未返回给 Agent、未记录、未写文件、未上传；之后停止内容解析，只检查文件存在性/权限。因此不能写成“所有 Secret 均未读”。本地控制 token 与 API Key/Keychain 密码分开记录。
- 盘点 JSON 使用固定字段与脱敏标识，未保留无必要的用户正文摘要。临时只读盘点程序不提交到仓库。

## 停止点与待决

M0 已结束。44个未确认身份/用途的主库业务记录继续 UNKNOWN，需用户在后续明确授权范围内分类。两个运行实例、多个旧 Resume 正本、2个 Proposal 未解析引用、历史孤儿身份和备份额外对象都仍待核对。

没有设计最终字段映射，没有迁移脚本，没有 dry-run，没有导入、合并或修正，也没有创建新系统业务对象。仅等待用户指定下一步。

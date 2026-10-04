# M1-B：synthetic source adapter 与隔离演练

Issue [#33](https://github.com/frog-716/Career-Next/issues/33)。起点 `f08ea2a5063fe5d063b9fcc076b3ec890a654196`。只实现假数据导入器；不读取旧 Career、14条 REAL 正文或 Secret，不执行真实迁移，不进入 M2。

## 范围与真实资料边界

`backend/application/migration/` 是独立离线能力，不接入 Renderer、preload、普通 IPC 或启动流程。调用者显式传入源路径与固定 digest；`source.ts` 仅支持闭合的 `synthetic-career-legacy` SQLite v1：精确 schema、read-only/query-only、大小与记录数限制、拒绝 symlink/旁路日志、读取前后及提交前 digest 一致。不会扫描机器、按 mtime 选 active、读配置、加载旧运行代码或联网。

此源格式是有明确类型的测试夹具投影，不宣称已支持真实旧库 schema 或验证真实字段值。M2 前仍需独立授权并核对实际快照、版本及未覆盖字段；不以本轮 PASS 冒充真实迁移。非空招聘 URL、未批准的 phase/result、未知字段或格式不静默丢弃，直接拒绝。未改动本地 M1-A 真实 mapping / 人工 review。

## 固定计划与 owner

- 分类输入为显式选中身份集；仅 REAL 允许，TEST/UNKNOWN 或重复身份拒绝整份计划。按稳定 ID 找关系，不按名称、正文或关系完整度分类。
- Manifest 绑定 source DB/schema/version、classification digest、M1-A fixture mapping policy digest、adapter version、完整选中身份集与 staging identity。输入变化拒绝旧 plan；源在导入途中变化也拒绝提交。
- `migration-staging/<UUID>` 是登记的独立 staging，具有新 workspace identity、专用 marker 和计划。每次 owner 写入及最终提交复核绑定、active pointer 与清除标记。打开写库前拒绝 symlink/hardlink、错误身份或版本；不改 active pointer，不自动激活。
- Profile / Company / Opportunity core / Resume 各自在自己的 `staging.ts` 保存强类型快照，经对应 `public.ts` 的受信后端能力组合。没有普通公开 import Contract，不绕过 owner 写表。
- Profile Primary 为唯一权威；Secondary 不覆盖。Company 不按同名合并；同公司多 Opportunity 独立。仅批准的 legacy resume/active 映射为 preparation/active；投递/面试/Offer 日期保持 unknown，缺 JD 合法。
- Resume 每 Opportunity 至多一个当前稿；独立 UUID 节点转换，paragraph/list/identity alignment 及 marks 保留。身份从 Profile 读取；不恢复 shared resume/ResumeUse，不构造谱系、Version 或 Submission。
- Proposal 只调用 #34 既有私有 staging writer，保留 Research/Resume、原状态、依据、原目标及明确映射；断裂目标 unresolved。accepted 不成为独立核验，不重放 Apply，不建 Task/Operation/执行回执或当前 pending。
- 同一 plan 的全部 owner 快照和唯一迁移回执在一个 SQLite 事务提交；同一源身份映射只保存一份。只有此计划的回执可幂等回读，重读再次验证行主键、manifest、来源集合与正式候选关系；无回执但有半成品 owner 数据会拒绝继续混入。先登记 candidate，再建目录；目录创建失败也保留 failed 登记。执行前持久化 running intent，SIGKILL 后由离线 restart inspection 取得真实写锁、核对 DB 回执，将未提交的执行明确标为 failed；仅显式再次调用才重跑，不由应用启动自动导入。

## schema、备份与清除

Schema 9 `009-migration-provenance` 仅追加闭合的迁移身份/哈希/状态回执表；1–8 原 SQL 不变。回执不含职业正文、Secret 或执行权限。备份仍执行完整 trusted-schema 校验，不放宽未知 DDL；候选验证回执结构、manifest digest、来源身份集合与正式 owner 引用。只读历史继续使用 #34 既有 backup/restore/purge。

各 owner 快照写入检查本机清除决定与当前 staging fences；不会以迁移覆盖清除标记。已清除 archive 重复导入仍由 #34 保持墓碑。迁移身份回执只留最小来源元数据，不保存正文作为第二正本。

## 演练证据

仅 `tests/fixtures/m1b-source.ts` TEST DATA，含 Primary/Secondary、同名不同身份公司、缺 JD、未知日期、center/list/marks、全部已知旧状态及 unrecognized/unresolved。选中18条：Profile 1、Company 2、Opportunity 3、Resume 2、历史 Proposal 10。被排除的 Secondary 不覆盖 Primary；分类 REAL 不代表真实用户资料。

本地报告：`out/migration/M1-B-FIXTURE-REHEARSAL.md`，Git ignored。覆盖 fake events=0、Task/Operation/执行回执=0、double apply=0、唯一迁移回执、文件/引用、源 digest 与 active pointer；无需业务附件/PDF，不补造文件。故障包括真正子进程 SIGKILL、真实写锁 busy、注入 SQLITE_FULL、非法记录、缺关系、重复 Resume、TEST/UNKNOWN、stale input、部分 staging 与二次执行。源/分类/半成品/path/恢复等红绿日志仅留 ignored `out/migration/m1b-evidence/`。

有效 active 工作区使用独立 TEST DATA 哨兵：prepare、成功导入及同一计划重跑后，active 数据库与 pointer 均逐字节不变，原 Profile 仍可通过 owner 读取；不只检查空目录。

最终回归：typecheck / build 通过；unit 58文件、172/172通过；integration 83文件、441/441通过，其中 M1-B 24/24。覆盖既有 typed archive、Profile、Opportunity、Resume/alignment、候选验证及 backup/restore/purge。全部使用 mock / synthetic fixture；未启动真实迁移、未调用外部服务。

Standards review：最终无未解决项。Spec review：最终无未解决项。初次 review 发现的回执绑定、目录登记顺序及崩溃后的 failed 状态已补失败测试并修复。Architecture / migration safety / privacy review：通过；私有离线入口、owner 写入、严格 staging 与分类边界均保持，不提供旧 Proposal 执行能力。

Frozen Product Spec 12/12、Architecture 8/8 SHA256 与起点一致。提交文件无 Key、真实私人正文、runtime DB、测试 userData、PDF 或 build output；本地演练与故障日志保持 Git ignored。

## 停止点

REAL SOURCE READ=0；REAL DATA WRITTEN=0；ACTIVE WORKSPACE WRITE=0；AI/Search/Feishu requests=0。仅 fixture 演练就绪；M2 NOT STARTED。

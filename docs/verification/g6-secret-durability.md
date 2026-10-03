# G6 Secret 复合持久化故障补审

本补丁只修改 Main 私有 `secret-vault.ts` 和对应定向测试；不改 Main/bootstrap、其他线文件、业务 owner、冻结正本。只用隔离临时目录和虚构 Secret；没有调用系统钥匙串或真实服务。

## 正式红灯与最小修复

真实临时文件完成 binding 原子 rename 后，在目录同步 seam 抛 EIO；其后补救 binding 写入在 open 前持续抛 EIO。旧实现返回 `secret_save_failed`，但公开 status 仍 `enabled:true`。`compound-red.log`：exit 1，2 PASS / 1 FAIL。

修复在密文或 binding 改变前原子持久化 `pending-generation.json`，内容仅新 generation UUID。标记存在时公开状态始终禁用，创建新的 vault 实例也一样；因此不依赖失败后的补救 metadata 写入。密文与 binding 都完整写入、fsync 后才清标记。失败保留标记和完整密文，不删除已发布配置、不回退旧 Key。明确的新 save 可重新完成配置；disable/delete 保持禁用语义。

原单故障测试改为按 `binding.json` 文件名定位同步失败，保持原有“metadata rename 后”的切点，避免新 marker 同步使数字序号指向另一阶段。新 `beforeAtomicWrite` 仅由可信 factory 接收用于准确故障 seam；没有 renderer/UI 操作入口。

## 已执行分支

| 分支 | 实际观察 | 结果 |
| --- | --- | --- |
| metadata rename 后同步失败，补救 metadata 写入持续 EIO | failure；新旧 vault status disabled；真实 AES-GCM 密文完整；所有安全目录文件不含虚构 Key 明文 | PASS |
| 原单一 post-rename 同步失败 | 标记存在、配置禁用、完整密文保留 | PASS |
| 标记 unlink 失败 | binding 真正持久化后 chmod 临时目录为 0500，使真实 unlink 失败；标记保留，重启仍 disabled，密文完整 | PASS |
| 标记 unlink 成功后目录同步失败 | cipher/binding 已完成 fsync；返回已保存 status，保留密文，现场标记已移除；新 vault 识别完整配置 | PASS |
| 失败后 disable / 明确新 save / delete | 无旧 generation 回退；新 save 更换 generation、移除旧 marker/cipher；delete 未配置 | PASS |
| 真实 Chromium 凭据与业务备份回归 | 新建/保存/替换/取消/停用/失败/删除/卸载清空，以及真实业务备份排除安全目录 | 3 tests PASS |

第二个正式红灯 `postcommit-red.log`：exit 1，4 PASS / 1 FAIL。Root 已明确授权提交边界：cipher 和 binding 已完整 fsync，marker unlink 成功后的目录同步属于提交后清理；不能把完整密文当失败回滚删除。若实际掉电使未持久的 unlink 撤回，重启可能重新看到旧 marker，保守禁用并要求重新配置；不承诺该分支一定跨重启启用，也不把当前安全配置说成丢失。

## 命令、exit 与边界

```sh
npx vitest run tests/g6-secret.test.ts tests/g6-secret-ui.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/career-g6-secret-durability/final-results.json
npx tsc --noEmit
```

分别 exit 0 / 0；2 files / 8 tests PASS（vault 5、实际 Chromium/backup 3）。原日志 `/tmp/career-g6-secret-durability/`，逐文件 SHA 和正式结果见 [JSON](g6-secret-durability-results.json)。最初 typecheck 碰到其他并行线的 Recipient value/type 尚未完成改动；integration owner 修复后复跑 exit 0，本线没有修改那些文件。

Frozen Product 12/12、Architecture 8/8 相对 befe SHA 不变。没有实际拔电、macOS Safe Storage、packaged App 或外部服务测试；这些仍由 G6 主线按真实证据结算。此补丁不关闭 Issue，不 push，不宣布 G6 PASS，不进入 Migration M。

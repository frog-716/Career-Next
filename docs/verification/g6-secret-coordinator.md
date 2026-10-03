# G6 Main 凭据配置并发：旧保存不能重开新停用

本线新增 Main 专用 coordinator，并把原 secret IPC handler 的配置协调移入该窄能力。共享 Main 的 handler/import 已在工作树接入；startup resolver 的 import/connect hunk 属另一线，共享 Main 由 root 统一提交。没有通用框架、业务 owner、Frozen、旧 Career、真实网络或真实 Key 改动。

## 正式红灯

1. 按原 Main handler 两步配置流程提取窄能力；真实 vault 的 save A 在 AES-GCM encrypt seam 等待，较新 disable B 已到达并关闸；A 迟到完成后 enable A，B 只停用 vault。最后实际 vault status disabled，而真实生产 runtime/writer 的 public product.prepare 返回 product_task，非法重新打开 generation A。1 FAIL，exit 1，`/tmp/g6-secret-coordinator-red.log`。
2. 首次 epoch 修复后，控制 ACK A 被延迟、较新 B 先 ACK，旧实现先让 B 进入 vault.disable，再让 A vault.save；虽然 epoch 拒绝本进程重新 enable，持久 vault 最后 enabled:true，重启会恢复错误绑定。4 PASS / 1 FAIL，exit 1，`/tmp/g6-secret-coordinator-ack-red.log`。

## 最小修复

每个合法 save/disable/delete 意图到达即增 epoch，立即调用私有 configure(disabled)，不等待前一操作。Main 自有 mutation 队列按意图到达顺序排队；队列中的操作先等自身控制 ACK，再调用已序列化的 vault。只有仍为最新意图、且 vault 成功保存的新 generation，才可重新 enable。旧意图、替换失败、控制 ACK 逆序都不能覆盖较新的停用。status 和 invalid input 不制造配置意图。

控制 Promise 在到达时安装 rejection observer，排队等待不会产生未处理拒绝；每个 job 失败后释放队列，保留原调用失败语义，没有明文重试或持久化 retry 队列。

## 已执行与边界

5 个新增回归覆盖两种红灯、替换失败、最新 B generation 正常启用、B 控制 ACK 尚未返回时旧 A 不得重开闸。最后 ACK 逆序场景另外创建新 vault 读取真实文件，并调用真实 Main startup resolver，均确认 enabled:false。所有最终执行权观察使用真实 SQLite、正常 writer 和公开 runtime product.prepare，不只检查 callback 次数或内存变量。保存使用虚构值与真实 AES-GCM 夹具加密，系统 safeStorage 和最新正常打包 Main 未在本套执行。

```sh
npx vitest run tests/integration/g6-secret-coordinator.test.ts tests/integration/g6-runtime-control.test.ts tests/integration/g6-provider-binding.test.ts tests/g6-secret.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/g6-secret-coordinator-green-results.json
npm run typecheck
```

实际：4 文件 / 24 tests PASS（新增 5），exit 0；typecheck exit 0。首次 typecheck 碰到另一线双窗测试的 matcher 错误，未修改该文件；其 owner 修正后最终复跑通过。逐日志 SHA、分支和边界见 [结果 JSON](g6-secret-coordinator-results.json)。临时 profile 删除、测试加密 key buffer 清零，没有用户资料或真实外发。

root 继续串行接入共享 Main、重新打包并复跑正式 Secret 链；本提交不关闭 Issue、不 push、不宣布整体 G6 PASS。

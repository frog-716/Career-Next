# G6 Secret UI 验证

RV-P1-05 / F4-05～06 的窄证据。真实 Chromium，直接挂载真实 `SecretSettings` 组件，专用 localhost bridge 调真实 `createSecretVault`，用真实 AES-256-GCM 加密虚构测试凭据；不触系统钥匙串，不连接外部服务。

## 红灯与修复

输入虚构值后点击“离开设置”，React 卸载已把 ref 置 null，原 cleanup 不能清掉 detached input 的 value。`/tmp/career-g6-secret-ui/red-unmount.log`，exit 1，实际值仍完整存在。

root 最小修复 effect cleanup 捕获 mount 时的 DOM node，然后清该 node。相同真人式浏览器操作回归通过；测试作者未修改生产组件。

## 实际执行

| 场景 | 注入点 / 预期 | 实际 | 状态 |
| --- | --- | --- | --- |
| 新输入与保存 | password input → 专用 bridge → 实际 vault；保存开始立即清输入 | 存储 adapter 暂停期间 input 已空且 disabled，恢复后安全保存；密文字节不含虚构原值 | PASS |
| 替换 | 新 generation 安全保存后切绑定 | generation 改变、旧 encrypted 文件消失、输入清空 | PASS |
| 取消 | 清 DOM，不发送 save，不改绑定 | 请求数量不增加，vault 状态不变 | PASS |
| 停用 | 保留 generation 但 enabled=false | UI 如实停用，状态 false | PASS |
| 保存不可用 | storage.available=false | 明确安全保存失败，输入清空，停用旧 generation 保持 false | PASS |
| 加密失败 | 实际 adapter 抛受控测试错误 | 响应仅安全 failure code，无内部错误文字；旧停用值不回退 | PASS |
| 传输失败 | 专用 localhost bridge 返回 503 | UI 结果待核对，输入清空，重读仍停用 | PASS |
| 删除 | 先撤销再删除密文 | configured=false / enabled=false，无 encrypted 文件 | PASS |
| 卸载 | 输入后离开设置 | 保留的 detached DOM 引用 value=''，没有 save | PASS |
| 普通状态 / DTO / error | 观察实际 TanStack Query cache、vault 响应 audit、页面 body、Chromium console/pageerror | cache 空；响应/错误/页面文本无虚构值，generic observer 无命令 | PASS（此 harness 边界） |
| 业务备份 | 同一隔离 root 的真实 vault 与真实 SQLite backup | 发布集合仅 backup.json/blobs/career.sqlite，无 vault 文件，DB/manifest 无虚构值或实际 cipher bytes | PASS |
| CLI args | 当前测试进程 argv | 无虚构凭据值 | PASS（此测试进程） |

## 命令与证据

```sh
npx vitest run tests/g6-secret-ui.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/career-g6-secret-ui/final-results.json
npm run typecheck
```

均 exit 0，3 tests PASS。日志 `/tmp/career-g6-secret-ui/final.log`、`typecheck.log`，持久索引 [results JSON](g6-secret-ui-results.json)。测试夹具创建在 dist，退出时删除；数据库和虚构 vault 位于独立临时目录，退出时删除。

该证据没有覆盖正常 Electron preload/Main sender 校验、正常进程 recorder 或系统 safeStorage；这些由 root 的正常 packaged 验证补齐。generic recorder 观察仅为 harness 侧 observer，不能据此宣称整个正式 recorder 已验。React 密码框在新输入期间短暂接触明文，未声称 renderer 永不接触或内存法证擦除。

只新增本测试和本报告，不修改 Frozen Product/Architecture，不调用真实服务，不读旧 Career，不进入 Migration M。

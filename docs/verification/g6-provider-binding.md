# G6 可信 Provider 配置代次接缝

本证据仅验证真实隔离 SQLite、正式 Wiki/Product owner、trusted ports 配置与 deterministic fake adapter。没有真实 Key、用户资料、外部请求或旧 Career；不是系统 safeStorage 或完整 packaged 验收。

## 红灯 → 最小修复

1. 新预览应冻结 trusted-generation-A/B，实际固定 fake-v1：2 FAIL，exit 1。
2. 当前 generation 已 B，旧 A Manifest 授权仍被接受：2 FAIL / 2 PASS，exit 1。
3. 已授权后变更 generation/停用，Wiki handoff 未复查仍进入 dispatching：2 FAIL / 6 PASS，exit 1。

对应日志与 SHA 见 [结果](g6-provider-binding-results.json)。最初夹具将 interview.confirm 的实际 saved 响应误当 confirmed；修正夹具后才记录上述业务红灯。

最小生产变更：`AiPorts.recipient?: () => Manifest['recipient']` 只接受可信配置 getter，省略时保持本地 fake-v1 基线；明确 disabled 的 getter 抛 provider_disabled。新 Manifest 读取当前 binding；Wiki/Product 授权及 handoff 复查当前 binding，旧代次报 provider_binding_changed。Fake factory 接受 trusted generation，继续 network:none，不接受 Key。

## 已执行

12 个新增测试：Wiki/Product 各验证 fresh A/B、拒绝旧授权、handoff 重查与零预算消耗、disabled prepare/handoff 拒绝、fresh B 真实 fake send/owner settle 成功、generic request 不能改变 recipient。真实 owner 的公开 read 确认 operation 状态、预算、pending proposal，没有用 SQL 内部断言替代行为。

```sh
npx vitest run tests/integration/g6-provider-binding.test.ts tests/integration/g6-ai-failures.test.ts tests/integration/g4-ai-runtime.test.ts --maxWorkers=1
npm run typecheck
```

实际：3 文件 / 60 测试 PASS，exit 0；typecheck exit 0。证据 `/tmp/g6-provider-binding-final.log`、`/tmp/g6-provider-binding-typecheck.log`，SHA 见结果 JSON。

Main 专用凭据输入、utility 私有配置控制、runtime 同步关闭旧闸门及 writer 接线由 integration owner 持有；本报告不以这里的进程内真实 owner 测试替代正式 Main/utility/worker、系统安全存储、真实外部 Provider 或 macOS 睡眠唤醒证据。

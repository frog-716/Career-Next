# Career-Next

Career 是保存在个人电脑上的长期职业工作台，帮助用户推进求职、记录真实工作，并积累可找回、可复用的职业资料。

G0 技术可行性验证已 PASS，真实 macOS 中文 IME 已由用户人工验收，尚未进入 G1。Product Spec Frozen R3 与 Architecture V2 Frozen 已确认；本仓库是从零重写的唯一开发仓库，目前只有工具链与最小桌面探针，没有业务功能。

- [冻结产品规格](docs/product-spec/rebuild-spec/README.md)
- [冻结架构](docs/architecture/ARCHITECTURE.md)
- [项目导航 MAP](MAP.md)

目前尚不能运行正式应用。

G0 探针的命令（本机 macOS arm64）：

```sh
npm ci
npm run install:electron
npm run native:rebuild
npm run typecheck
npm run build
npm test
npm run smoke:dev
npm run package
npm run smoke:packaged
```

构建后可用 `npm run dev` 打开技术探针；本机包位于 `out/CareerNextG0-darwin-arm64/CareerNextG0.app`。它使用可丢弃的 G0 数据，不提供职业资料保存能力。所有 `probe/` 实现都须在正式切片开发时重新评估，不能默认升级为平台实现。

打包默认只做本地 ad-hoc 签名。正式 Developer ID 签名需设置 `CAREER_G0_SIGN_IDENTITY`；公证需预先配置钥匙串凭据并设置 `CAREER_G0_NOTARY_PROFILE`。只有提供 Apple 证书时才启用 Hardened Runtime，不放宽原生库校验。`npm run package:x64` 提供 x64 流程入口，尚未在真实 x64 环境执行。

结果、实际命令与未完成项以 [G0 Issue #1](https://github.com/frog-716/Career-Next/issues/1) 为准。

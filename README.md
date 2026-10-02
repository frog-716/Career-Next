# Career-Next

Career 是保存在个人电脑上的长期职业工作台，帮助用户推进求职、记录真实工作，并积累可找回、可复用的职业资料。

G0、G1 已 PASS。当前仅提供第一条个人独立 Raw 切片：选择本地 UTF-8 TXT / Markdown（最多 256 KiB），预览、取消或明确确认保存，再从正式 SQLite 与 blob 回读。保存为证据型原件，不提供原地编辑，也不保证原文事实真实；不调用 AI。完整 Career 应用尚未建成，不进入 G2。

- [冻结产品规格 Frozen R3](docs/product-spec/rebuild-spec/README.md)
- [冻结架构 V2](docs/architecture/ARCHITECTURE.md)
- [项目导航 MAP](MAP.md)
- [G1 范围与验收证据](https://github.com/frog-716/Career-Next/issues/2)

本机 macOS arm64 的开发与验收命令：

```sh
npm ci
npm run install:electron
npm run native:rebuild
npm run typecheck
npm run build
npm test
npm run test:integration
npm run smoke:dev
npm run package
npm run smoke:packaged
```

构建后 `npm run dev` 打开当前切片。正常 arm64 包位于 `out/CareerNext-darwin-arm64/CareerNext.app`。本地资料位于应用 userData 下的 `workspaces/local/`，其中 `career.sqlite` 保存正式 metadata / receipt，`blobs/` 保存确认过的原件，`staging/` 只存受控临时文件。请使用测试资料验收；可用标准 `--user-data-dir=/绝对路径/测试目录` 启动独立测试实例。预览尚未保存，取消不产生正式资料；保存结果待核对时查询原回执，不自动再保存。

打包默认为本地 ad-hoc 签名。Developer ID signing、Notarization 和 x64 继续保持 READY，尚未实际验收；分别通过 `CAREER_SIGN_IDENTITY`、`CAREER_NOTARY_PROFILE` 与 `npm run package:x64` 提供流程入口。

G0 `probe/` 仍为独立实验，不充当正式平台。历史构建与测试使用 `npm run build:g0`、`npm run test:g0`、`npm run smoke:g0`；[G0 Issue #1](https://github.com/frog-716/Career-Next/issues/1) 保存历史验收结果。

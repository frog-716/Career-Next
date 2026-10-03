# Career-Next

Career 是保存在个人电脑上的长期职业工作台，帮助用户推进求职、记录真实工作，并积累可找回、可复用的职业资料。

G0、G1 及 G2 第一批人工业务切片已 PASS：Wiki 与可追溯原件、任职及其人物、独立项目及任职协作、公司与机会主线，以及机会内简历与全局基础资料。四个一级入口固定为 Wiki、机会、项目、任职。简历当前稿自动保存，命名版本冻结正文、当时身份与真实 PDF；真实中文 IME 已由用户人工验收。G3 机会内人工 Research / Interview / Offer 已 PASS，支持研究唯一正本、真实面试轮次和不可变 Offer 接受依据；见 [验收证据](docs/verification/g3-manual-submodules.md)。完整 Career 应用尚未建成；不调用 AI，不进入 G4。

- [冻结产品规格 Frozen R3](docs/product-spec/rebuild-spec/README.md)
- [冻结架构 V2](docs/architecture/ARCHITECTURE.md)
- [项目导航 MAP](MAP.md)
- [G3 人工强子模块范围](https://github.com/frog-716/Career-Next/issues/10)
- [G2 第一批范围与验收](https://github.com/frog-716/Career-Next/issues/3)
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
npm run smoke:g2
npm run smoke:g3
npm run package
npm run smoke:packaged
npm run smoke:g2:packaged
npm run smoke:g3:packaged
```

构建后 `npm run dev` 打开当前切片。正常 arm64 包位于 `out/CareerNext-darwin-arm64/CareerNext.app`。本地资料位于应用 userData 下的 `workspaces/local/`，其中 `career.sqlite` 保存正式 metadata / receipt，`blobs/` 保存确认过的原件和冻结 PDF，`staging/` 只存受控临时文件。请使用测试资料验收；可用标准 `--user-data-dir=/绝对路径/测试目录` 启动独立测试实例。升级先登记并保存技术恢复副本；这不是完整 Backup / Restore 产品。预览尚未保存，取消不产生正式资料；保存结果待核对时查询原回执，不自动再保存。

打包默认为本地 ad-hoc 签名。Developer ID signing、Notarization 和 x64 继续保持 READY，尚未实际验收；分别通过 `CAREER_SIGN_IDENTITY`、`CAREER_NOTARY_PROFILE` 与 `npm run package:x64` 提供流程入口。

G0 `probe/` 仍为独立实验，不充当正式平台。历史构建与测试使用 `npm run build:g0`、`npm run test:g0`、`npm run smoke:g0`；[G0 Issue #1](https://github.com/frog-716/Career-Next/issues/1) 保存历史验收结果。

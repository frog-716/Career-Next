# Career-Next

G0–G5 已 PASS，[J-07 真实外部链](docs/verification/j07-real-external.md) 使用隔离 TEST DATA 验收完成。G6 本地故障/恢复 PASS；Developer ID、Notarization、x64 仍 READY / NOT RUN。[Migration M0 只读盘点](docs/migration/M0-INVENTORY.md)已完成，尚未执行迁移或导入。

Career 是保存在个人电脑上的长期职业工作台，帮助用户推进求职、记录真实工作，并积累可找回、可复用的职业资料。

G0、G1、G2 第一批和 G3 已 PASS。G4 增加真实首次投递与再次沟通、跨域来源复核、Wiki 整理提案，以及备份、恢复和永久清除；验收见 [G4 证据](docs/verification/g4-cross-domain.md)。四个一级入口固定为 Wiki、机会、项目、任职。简历当前稿自动保存，命名版本和未命名导出冻结当时内容、身份及真实 PDF；真实中文 IME 已由用户人工验收。AI 发送需要最终预览授权，正式内容由人工采纳后通过业务 owner 写入。真实 Tavily 与 DeepSeek 已完成受控验收；Feishu 通过 user 身份只读 CLI 读取指定文档，确认缓存后由 Materials 保存，未增加内置 live Feishu adapter。完整发布与正式迁移尚未完成。

- [冻结产品规格 Frozen R3](docs/product-spec/rebuild-spec/README.md)
- [冻结架构 V2](docs/architecture/ARCHITECTURE.md)
- [项目导航 MAP](MAP.md)
- [G4 跨域集成范围](https://github.com/frog-716/Career-Next/issues/14)
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
npm run smoke:g4
npm run package
npm run smoke:packaged
npm run smoke:g2:packaged
npm run smoke:g3:packaged
npm run smoke:g4:packaged
```

构建后 `npm run dev` 打开当前切片。正常 arm64 包位于 `out/CareerNext-darwin-arm64/CareerNext.app`。应用 userData 下的 `active-workspace-pointer.json` 指向唯一当前资料库，初始目录为 `workspaces/local/`；`career.sqlite` 保存正式 metadata / receipt，`blobs/` 保存原件和冻结 PDF，`staging/` 存受控临时文件。请使用测试资料验收；可用标准 `--user-data-dir=/绝对路径/测试目录` 启动独立测试实例。设置中可以手动备份、验证恢复候选并明确切换，以及查看永久清除影响并确认副本范围。周期备份默认关闭，启用后仅在应用运行时检查。预览尚未保存，取消不产生正式资料；保存结果待核对时查询原回执，不自动再保存。

打包默认为本地 ad-hoc 签名。Developer ID signing、Notarization 和 x64 继续保持 READY，尚未实际验收；分别通过 `CAREER_SIGN_IDENTITY`、`CAREER_NOTARY_PROFILE` 与 `npm run package:x64` 提供流程入口。

G0 `probe/` 仍为独立实验，不充当正式平台。历史构建与测试使用 `npm run build:g0`、`npm run test:g0`、`npm run smoke:g0`；[G0 Issue #1](https://github.com/frog-716/Career-Next/issues/1) 保存历史验收结果。

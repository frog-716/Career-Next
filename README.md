# Career-Next

当前默认入口是 Chrome 本地 Web UI，Node 承担本地后台，macOS launcher 和窄 native helper 提供必要系统能力；Electron 仅保留临时回退。G0–G5 PASS、G6 LOCAL PASS；M-Lite 当前资料已迁入并启用。Developer ID、Notarization、x64 仍 READY / NOT RUN。运行边界见 [E1 宿主修订](docs/adr/005-ELECTRON-RETIREMENT-E1.md)。

Career 是保存在个人电脑上的长期职业工作台，帮助用户推进求职、记录真实工作，并积累可找回、可复用的职业资料。

G0、G1、G2 第一批和 G3 已 PASS。G4 增加真实首次投递与再次沟通、跨域来源复核、Wiki 整理提案，以及备份、恢复和永久清除；验收见 [G4 证据](docs/verification/g4-cross-domain.md)。四个一级入口固定为 Wiki、机会、项目、任职。简历当前稿自动保存，命名版本和未命名导出冻结当时内容、身份及真实 PDF；真实中文 IME 已由用户人工验收。AI 发送需要最终预览授权，正式内容由人工采纳后通过业务 owner 写入。真实 Tavily 与 DeepSeek 已完成受控验收；Feishu 通过 user 身份只读 CLI 读取指定文档，确认缓存后由 Materials 保存，未增加内置 live Feishu adapter。本机当前资料工作区可用；正式分发仍待签名、公证和 x64 实测。

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

构建后运行 `npm start`：启动本地后台，准备好后自动在 Chrome 打开。再次运行会复用后台并打开新标签，不新增 writer。浏览器关标签后资料和后台仍保留；刷新或重新打开可继续。运行 `npm run stop` 正常退出本地后台；再运行 `npm start` 可重启。后台重启后，已有页面显示“重新连接”，不会自动重发保存或 AI 请求。

`npm run dev` 与 `npm start` 使用同一 Node/Chrome 正式入口；后台独立运行，退出使用 `npm run stop`，不是关闭浏览器标签。运行 `npm run package:e1` 后，正常 arm64 launcher 位于 `out/Career-E1-arm64/Career.app`，双击自动打开 Chrome；不加载 Electron。已运行旧 Electron 后台时，新 launcher 会拒绝接管：先用 `npm run stop:electron` 正常退出旧后台，再启动新路径。

Electron 依赖和旧适配代码在 E1 保留。明确回退命令为 `npm run start:electron` / `npm run stop:electron`；只有 `npm run dev:desktop` 才打开兼容 Electron 窗口。不要同时启动同一工作区的两个宿主。真实 Key 的旧密文保持原样，新 native-v1 路径不会读取；交接与回滚见 [凭据授权停止点](docs/operations/E1-CREDENTIAL-TRANSITION.md)。

应用 userData 下的 `active-workspace-pointer.json` 指向唯一当前资料库，初始目录为 `workspaces/local/`；`career.sqlite` 保存正式 metadata / receipt，`blobs/` 保存原件和冻结 PDF，`staging/` 存受控临时文件。请使用测试资料验收；可用 `npm start -- --user-data-dir=/绝对路径/测试目录` 启动独立 TEST 实例，`npm run stop -- --user-data-dir=/绝对路径/测试目录` 退出该实例。浏览器 URL 只包含 loopback 地址；实际端口按 profile 保存，不在 URL 放凭证。设置中可以手动备份、验证恢复候选并明确切换，以及查看永久清除影响并确认副本范围。周期备份默认关闭，启用后仅在应用运行时检查。预览尚未保存，取消不产生正式资料；保存结果待核对时查询原回执，不自动再保存。

打包默认为本地 ad-hoc 签名。Developer ID signing、Notarization 和 x64 继续保持 READY，尚未实际验收；分别通过 `CAREER_SIGN_IDENTITY`、`CAREER_NOTARY_PROFILE` 与 `npm run package:x64` 提供流程入口。

G0 `probe/` 仍为独立实验，不充当正式平台。历史构建与测试使用 `npm run build:g0`、`npm run test:g0`、`npm run smoke:g0`；[G0 Issue #1](https://github.com/frog-716/Career-Next/issues/1) 保存历史验收结果。

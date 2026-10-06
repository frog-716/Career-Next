# Career-Next

当前默认入口是 Chrome 本地 Web UI，Node 承担本地后台，macOS launcher 和窄 native helper 提供必要系统能力；Electron 正式依赖和宿主已移除。G0–G5 PASS、G6 LOCAL PASS；M-Lite 当前资料已迁入并启用。Developer ID、Notarization、x64 仍 READY / NOT RUN。运行边界见 [E1 宿主修订](docs/adr/005-ELECTRON-RETIREMENT-E1.md)。

Career 是保存在个人电脑上的长期职业工作台，帮助用户推进求职、记录真实工作，并积累可找回、可复用的职业资料。

G0、G1、G2 第一批和 G3 已 PASS。G4 增加真实首次投递与再次沟通、跨域来源复核、Wiki 整理提案，以及备份、恢复和永久清除；验收见 [G4 证据](docs/verification/g4-cross-domain.md)。四个一级入口固定为 Wiki、机会、项目、任职。简历当前稿自动保存，命名版本和未命名导出冻结当时内容、身份及真实 PDF；真实中文 IME 已由用户人工验收。AI 发送需要最终预览授权，正式内容由人工采纳后通过业务 owner 写入。真实 Tavily 与 DeepSeek 已完成受控验收；Feishu 通过 user 身份只读 CLI 读取指定文档，确认缓存后由 Materials 保存，未增加内置 live Feishu adapter。本机当前资料工作区可用；正式分发仍待签名、公证和 x64 实测。

- [冻结产品规格 Frozen R3](docs/product-spec/rebuild-spec/README.md)
- [冻结架构 V2](docs/architecture/ARCHITECTURE.md)
- [项目导航 MAP](MAP.md)
- [G4 跨域集成范围](https://github.com/frog-716/Career-Next/issues/14)
- [G3 人工强子模块范围](https://github.com/frog-716/Career-Next/issues/10)
- [G2 第一批范围与验收](https://github.com/frog-716/Career-Next/issues/3)
- [G1 范围与验收证据](https://github.com/frog-716/Career-Next/issues/2)

本机 macOS arm64 开发需要 Node 24.21.0 / npm 10.9.8：

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run test:integration
npm run package
npm run test:browser
```

`npm start` / `npm run dev` 启动独立 Node 后台，ready 后自动在 Chrome 打开。再次启动复用后台并打开标签，不新增 writer。关标签不会退出后台；刷新或重开可以继续。`npm run stop` 正常退出后台；再启动后，已有页面可明确重新连接，不自动重发保存或 AI 请求。

`npm run package` 生成 `out/Career-arm64/Career.app`，包含 launcher、Node、前端、窄 native Keychain helper 与固定 PDF 打印引擎。当前只实测 macOS arm64，包为 ad-hoc 签名；Developer ID / Notarization / x64 仍 READY / NOT RUN，不再使用旧 Forge 命令冒充发版流程。PDF 使用 Chromium 153.0.8010.12、Playwright 1.63.0、固定 A4 参数和字体指纹。

应用 profile 下的 `active-workspace-pointer.json` 指向唯一当前资料库，初始为 `workspaces/local/`；`career.sqlite` 保存正式 metadata / receipt，`blobs/` 保存原件和冻结 PDF。浏览器导入使用受控暂存，导出使用 owner 绑定的下载。备份、恢复候选及明确切换继续由正式 owner 执行。

独立 TEST 实例使用 `npm start -- --user-data-dir=/绝对路径/TEST目录`；退出该实例使用 `npm run stop -- --user-data-dir=/绝对路径/TEST目录`。只监听 127.0.0.1；Origin、CSRF、HttpOnly session 和每标签 capability 保持有效。Secret 不在 URL、localStorage 或业务备份中；已保存 Key 不可从浏览器回读。

旧凭据文件保持原样，新宿主不解密、不迁移它们。后续由用户在正式 Secret UI 重新输入 Key，另行确认连接测试，再决定旧凭据是否退休。见 [凭据重新配置](docs/operations/CREDENTIAL-REENTRY.md)。如果旧历史宿主仍在运行，新 launcher 会拒绝接管同一 profile，须先由用户退出旧宿主；本轮不停止真实工作区后台。

G0 探针及旧宿主执行入口已退役。历史验收见 [verification 索引](docs/verification/README.md)；E1 完整源代码仍可从本地 `e1-pass-before-e2` tag 恢复。回滚不会自动处理用户 Secret，也不能同时运行同一工作区的两个 writer。本轮不 push。

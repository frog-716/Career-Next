# A6 approved-source checkpoint

日期：2026-10-06。Issue [#39](https://github.com/frog-716/Career-Next/issues/39)。人工审批 FAIL（板块遗漏），修正中；以前的自动 PASS 仅覆盖当时功能范围，不能证明全页复刻；不把首次自行改写样式的被拒版本记为通过。

## 原件对照

- `design-system/aura-approved.css` 与已批准 A6 / 方案3 原型完整 style 字节一致，SHA256：`2c1372d5dac812c98a352c8ebb73c9cf9367daa80aa58347520f6ef7a9ec4251`。
- 四入口和辅助入口使用原 SVG paths。机会页使用原 header/tools/filters/table/company-role-inline；公司与岗位同排、紧凑行高，不再自定大卡片。
- 正常 arm64 包在 1280px 验证导航 48×48、表格行高46、单元格 padding 8px 18px；600px 无横向溢出。正常包由 Computer Use 打开并观察。
- Source 里的虚构内容由正式 Contract 替换；不复制假公司、假日期、假飞书登录或假版本。版本实际为根 package 的0.0.0。

## 自动证据

| 验证 | 结果 |
| --- | --- |
| Typecheck / production build | PASS |
| 完整 unit/UI，单进程 | 66 files / 193 tests PASS |
| Opportunity / Resume / alignment / AI Resume / preferences integration | 5 files / 18 tests PASS |
| 正常 arm64 A6 + ⑩-A/B/C packaged | 4 files / 7 tests PASS |
| 凭据/外发与 owner 边界 | 沿用原链，没有新增外部调用 |

本地证据在 Git ignored 的 `out/implementation/a6/`；最终 unit 使用 `approved-unit.txt`，打包结果使用 `approved-native.txt`，正常测试 profile 和 screenshot 位于 `out/verification/frontend-a6/TEST-DATA/`。此前并行浏览器超时经隔离与完整单进程重跑通过，历史失败日志保留。首次窄窗纸面超宽及菜单点击后过早关闭均先复现，再修复；最终打包回归包括草稿、selection、alignment、Undo/Redo、帮助、反馈、导航偏好及备份恢复。

## 边界与未完成能力

- 四入口不变，没有 Home 路由或品牌回首页。当前默认启动模块偏好保留。
- 飞书头像视图与 Profile 分离；目前 App 没有飞书登录/头像同步，生产装配保持中性头像和无姓名。真实连接能力完成前不得声称“已连接”。
- 现有 Opportunity 列表合同没有提醒字段，显示“未设”，不拿历史日期冒充提醒。原型的“有沟通记录”汇总没有现成列表投影，本轮改为经现有 Communication list 只读汇总，失败不当作 0；沟通分区保持。
- 原件通用模块示意改为原 row 结构 + 正式数据；其他没有完整原稿的深层业务表单保留能力，不借此宣布全产品视觉定稿。
- 中文 IME 本轮未再次要求真人输入；现有 composition、格式、AI Undo、版本等回归通过，不把旧真人证据写成本轮新验收。

Standards / Spec / Architecture 由 Codex 自审：前端只经现有 Contract，Settings/Feedback 保持原 owner 与会话；无新 schema、业务 owner、登录、外发、fallback、迁移或框架。不是独立审查结论。

Frozen Product Spec 12/12、Frozen Architecture 8/8 SHA 不变。只使用隔离 TEST DATA，真实迁入资料未改；未读旧 Career；真实外部请求0。Developer ID / Notarization / x64 仍 READY / NOT RUN。

## 第二次人工拒绝后的追加验收

状态：补齐后待人工复审。原件逐页而非仅 CSS hash 对照；覆盖机会六分区、Resume、三个其他业务入口和全部辅助面板。原件/运行截图、失败回归与修复日志继续在 ignored 的 `out/implementation/a6/`。Issue #39 保持开放，未 push。

- 修正后的完整 unit/UI：67 files / 196 tests PASS（`review-unit.txt`）；新建 sheet 追加测试与 Opportunity 回归：4 files / 6 tests PASS（`create-sheet-green.txt`）。此前11个失败保留，修复后先定向22项通过，再完整重跑通过。
- Typecheck / production build PASS（`final-all-typecheck.txt` / `final-all-build.txt`）。相关 integration 5 files / 18 tests PASS（`completed-integration.txt`）。
- 正常生产 arm64 包（无开发诊断）用隔离 TEST DATA 验证四入口、六分区、Resume会话、设置/帮助/反馈、导航、备份恢复；最终打包结果见 `review-native.txt`。
- Computer Use 另用 `CareerNext A6 Review` 独立 bundle ID 的同一 renderer 测试包，显式 TEST profile；仅为避免 macOS 同 bundle 的窗口选择歧义，ad-hoc 签名，不代表 Developer ID / Notarization 通过。此前一次选窗返回其他 CareerNext 窗口，仅做只读观察，未触发该窗口的业务操作。
- 本轮没有新真人 IME 输入，仍不宣称新真人 PASS。当前人工审批未通过；Issue #39保持开放，未 push。

## 当前运行入口

正式默认界面现为 Chrome 本地 Web；见 [Browser-first 运行证据](browser-first.md)。A6 原 CSS / SVG 和四入口保留。历史 Electron 验证只说明对应当时版本，不替代当前 Chrome 审阅；人工视觉复审仍待用户，#39 保持 open。

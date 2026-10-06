# A6 approved-source checkpoint

日期：2026-10-06。Issue [#39](https://github.com/frog-716/Career-Next/issues/39)。功能与自动回归通过，正式呈现等待用户复审；不把首次自行改写样式的被拒版本记为通过。

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
- 现有 Opportunity 列表合同没有提醒字段，显示“未设”，不拿历史日期冒充提醒。原型的“有沟通记录”汇总没有现成列表投影，本轮不伪造数量；沟通分区保持。
- 其他未选稿页面沿用⑩结构，不借此宣布全产品视觉定稿。
- 中文 IME 本轮未再次要求真人输入；现有 composition、格式、AI Undo、版本等回归通过，不把旧真人证据写成本轮新验收。

Standards / Spec / Architecture 由 Codex 自审：前端只经现有 Contract，Settings/Feedback 保持原 owner 与会话；无新 schema、业务 owner、登录、外发、fallback、迁移或框架。不是独立审查结论。

Frozen Product Spec 12/12、Frozen Architecture 8/8 SHA 不变。只使用隔离 TEST DATA，真实迁入资料未改；未读旧 Career；真实外部请求0。Developer ID / Notarization / x64 仍 READY / NOT RUN。

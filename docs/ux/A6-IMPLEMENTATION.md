# A6 方案 3 正式实现

用户于 2026-10-06 批准 A6 / C（方案 3），进入正式前端。任务 [#39](https://github.com/frog-716/Career-Next/issues/39)。不改变 Frozen Product Spec / Architecture。

首次自行改写样式的实现被用户拒绝，不计入验收。最终版本直接复制批准原件完整 CSS、SVG 图标路径和页面结构，只适配现有数据与回调；CSS SHA256 为 `2c1372d5dac812c98a352c8ebb73c9cf9367daa80aa58347520f6ef7a9ec4251`，字节一致。

- `design-system/brand/`：用户批准的透明 SVG 豹头 + Career 字标，静态布局原样保留。Gemini 3.8 Flash 扩展思考提供单次眼光、金线接 C、字母错开归位的时序；本轮用户要求加大字母摆动，默认 0.75×，一轮约 3.2 秒。首次 Shell 挂载播放一次，hover 可重播，减少动态效果时静态；隐藏/卸载取消未完成帧，不循环。
- 豹头轮廓由前轮本地原创艺术图转为原生矢量路径，非逐根毛发手绘；运行时没有图片、视频、Canvas、背景方块或网络素材。原件与 Gemini 回复保留在本地 ignored 设计目录，正式源包含完整 SVG。
- `shell/`：72px 常显四名称导航，品牌没有路由；默认启动模块与已有导航偏好仍有效，设置文案统一为“启动入口”。没有第五个 Home workspace。业务页面继续隐藏保活。
- `support/experience/avatar-menu.tsx`：中性头像、hover/点击菜单、键盘与屏幕边缘处理。菜单在打开辅助面板前恢复原业务焦点/选区；反馈继续使用原 owner 和独立草稿。
- 设置/帮助/反馈/更新日志收进头像菜单；根 package 版本是设置与更新日志的同一来源，当前真实版本 `0.0.0`。`CHANGELOG.md` 是产品内更新日志内容源。
- `features/opportunity/`：公司/岗位、阶段、下一步、提醒日期四列表格；真实 phase 筛选与 ended 结果分开；行点击/键盘进入原详情六分区。长表格有界滚动，筛选/滚动/草稿保持。

机会页沿用原 pipeline header/tools/shell/table 和同排公司/岗位；刷新收进原省略号入口，五分类设置沿用原侧边导航与 sheet 结构，保留原业务编辑会话。其他未选稿页面继续⑩结构，不宣布全产品视觉完成。

## 真实能力边界

App 目前没有飞书登录和头像同步，不将 CLI token/只读导入冒充应用登录。生产装配仅传未连接态；菜单视图可接收独立 Feishu 连接身份，未来连接能力提供后才能显示真实头像/名称，不接 Profile。没有新增远程头像加载或写回能力。

Opportunity 合同尚无提醒字段，因此显示“未设”；不会从阶段日期、面试日期猜提醒。“下一步”是按阶段提供的常用动作提示，不是新建待办或用户真实承诺。

## 验收入口

自动与正常 arm64 包证据见 [A6 verification](../verification/frontend-a6.md)。只用隔离 TEST DATA，不读取旧 Career，不修改迁入资料，不调用真实 Provider / Search / Feishu。

# G2 第一批验收

范围以 [umbrella #3](https://github.com/frog-716/Career-Next/issues/3) 和 W/E/P/O/R/U 六个业务 Issue 为准。仅第一批人工业务链；不表示冻结规格全部功能已实现。不启动 AI Runtime，不进入 G3。

当前状态：**PASS**。代码与打包验证基于 `c0c1161c1fa227fae24eddc120aeb34a1142df5b`；最后一项真实人工中文 IME 于 2026-10-03 由用户验收通过。

## 代码与实际运行证据

| 检查 | 结果 |
| --- | --- |
| `npm ci`、Electron 安装、原生 SQLite 重建 | PASS |
| `npm run typecheck` | PASS |
| `npm test` | PASS，20 文件 / 44 项；包括浏览器中的真实表单与草稿保护 |
| `npm run test:integration` | PASS，13 文件 / 57 项；真实落盘 SQLite、writer、blob 与公开跨域关系 |
| `npm run build`、`npm run package` | PASS，正常 macOS arm64 App |
| G1 `smoke:dev` / `smoke:packaged` | PASS，原生文件选择、确认 / 回执、原件回读、断线和重启 |
| G2 `smoke:g2` / `smoke:g2:packaged` | PASS，六条真实页面旅程、PDF、恢复、明确 owner 导航、退出保护与重启 |
| G0 `test:g0` / `smoke:g0` | PASS，3 项单元测试及真实进程 / SQLite / PDF / Safe Storage / 安全桥回归 |
| Standards / Spec 独立 Agent 复核 | PASS / PASS，最终未解决发现各 0 项 |
| `git diff --check` | PASS |

正常打包旅程验证：Raw → Wiki 来源追溯 / 回读；Employment → Person → 修改；Project → 任职 A → 任职 B → 关联历史；Company + role → Opportunity → 真实阶段 / 结果 / 纠错；Profile → Resume 当前稿 → 连续键盘编辑 → 保存 / 重开。

简历命名版本经受限 Chromium 打印生成真实 PDF，使用 pdfjs 检查可选英文和中文标题，核对文件尺寸、冻结身份和打印元数据。随后修改当前稿、恢复冻结正文并重启，原版本和 PDF 保持不变。平台二进制 fixture 仅验证 hold / retention / GC 协议，不替代这项真实打印验收。

真实 G1 checkpoint 的 writer 创建原件后升级到 G2，原件字节、SourceRef、receipt 和 workspaceInstance 保持不变。升级前登记恢复副本；数据库、外键及受保护文件的尺寸 / hash 校验通过后才标记可用。缺失或损坏受保护 blob 时拒绝升级并保留失败副本登记。

## 人工中文 IME

**PASS，用户本人于 2026-10-03 确认。** 验收在最终正常 arm64 App 的 G2 Resume Editor 中，使用真实 macOS 简体拼音键盘输入。用户报告：

- composition 和候选框正常，候选提交后中文正确。
- 连续编辑、中英文混合、光标移动、删除和回车正常。
- 无重复、无丢字；保存后重新打开，内容正确。

这项结论来自用户的真实人工验收，不以 Playwright fill、DOM / Accessibility 设置、粘贴、程序中文或合成 composition 事件代替。自动化对 composition 保存边界的检查属于上表测试证据，不能替代真人候选窗口验收。验收使用独立临时工作区，不将用户输入内容提交到 Git。

## 冻结输入与边界

Product Spec：12 / 12 个 ZIP 文件逐字节一致，与 G1 基线一致。Architecture：8 / 8 个 ZIP 文件逐字节一致，与 G1 基线一致。以完整仓库相对路径排序构成 `SHA256  path` 清单并对清单再取 SHA256：产品 `9dbefa32389beb64165e3295eee14fa55f0b904462a486933c49658089193da5`；架构 `3d87555dbca17b92de34329ac4c35953d005e92eb0b0fda1394577b397dc23f8`。

未读取旧 Career；未创建 AI Runtime、Interview / Offer / Research / Submission 实现或完整 Backup / Restore 产品。未提交数据库、原件、Secret、真实用户资料或测试构建产物。

Developer ID signing、Notarization、x64 继续 **READY**。下一个 Gate 尚未授权。

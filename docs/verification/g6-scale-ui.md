# G6 F4-04：100 条真实列表、滚动返回与导航

**本地浏览器路径 PASS**。真实 Chrome 运行生产 CareerShell / HashRouter 与两个 feature，公开 owner 在隔离 SQLite 创建 100 Project / 100 Opportunity / 3 Employment。没有读取旧 Career 或真实用户资料；不是性能 benchmark，也不代替 root 最终 packaged arm64 验收。

原测试只证明筛选内容保留。本轮先加真实 window.scrollY 断言，原 Project 返回列表偏移 **64px**，exit 1（`/tmp/g6-scale-window-red.log`；SHA 与完整结果见 [JSON](g6-scale-ui.json)）。

最小修复：两个列表使用保留 DOM 的有界滚动区；打开详情记住页面位置并定位详情；Project 返回恢复页面位置，保留已打开编辑稿；Opportunity 新增返回入口，只返回列表位置而不清空当前身份/事件草稿。保留 root 已添加的中文搜索和状态筛选。

| 实际检查 | 结果 |
| --- | --- |
| 100 Project / 100 Opportunity 全部可枚举 | 各 100 |
| 中文 1 字“牛” / 2 字“牛蛙” | 两列表各 50 |
| 已完成 Project / 已结束 Opportunity | 两列表各 25 |
| 大小写混合英文 eNgInEeRiNg | 两列表各 50 |
| 不存在的搜索词 | 两列表各 0，并有明确空结果说明 |
| 长标题真实打开 | Project 158 / Opportunity 153 字符展示内容；详情读回完整名称 |
| Project 实际 wheel + 容器滚动返回 | 193px → 193px |
| Opportunity 实际 wheel + 容器滚动返回 | 193px → 193px |
| Project 页面返回 | window 0px → 0px |
| Opportunity 页面返回 | window 66px → 66px |
| 生产侧栏路由：Project → Opportunity → Project → Opportunity | 两列表滚动位置、筛选与当前未保存 Opportunity 稿保持 |
| Project 详情返回后重新打开 | 当前未保存 Project 名称稿保持 |
| pageerror | 0 |

上述容器偏移均先证明非零，由真实 mouse wheel / 浏览器滚动产生，不向 DOM 设置 scrollTop；页面与容器位置分别检查。中文搜索用测试输入值验证过滤，不声称中文 IME 人工验收。

```sh
npx vitest run tests/g6-scale-ui.test.ts tests/project-session.test.ts tests/opportunity-ui.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=/tmp/g6-scale-final.json
npx tsc --noEmit
```

分别 exit 0 / 0。**3 文件、9/9 PASS**；包含 Project 原 6 项编辑状态保护、Opportunity 原 2 项 dirty/unknown/导航保护。最终日志 `/tmp/g6-scale-final.log`，实际观察 `/tmp/career-g6/scale-observations.json`，测试名与观察值已固化在 JSON。限定文件 diffcheck exit 0。

未运行共享 build、package/native rebuild、macOS 人工 IME、跨重启位置恢复或 FPS 性能基准；由 root 继续相应发布门。本提交仅包含授权的两个 feature、scale 测试与本证据文件，不包含其他 owner 的未提交文件。

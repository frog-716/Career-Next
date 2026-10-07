# F3-B 飞书多维表格有限记录预览

状态：PASS（2026-10-07）。用户已完成重新授权，真实记录只读请求1次、返回5条，hasMore=true；Career本地页面已显示有限预览，用户选中1条记录。Computer Use只核对选中数量与标记，不提取记录标题/正文。不进入F3-C，本收口只提交F3-B实现、测试及必要导航/验收文档。

## 范围

用户冻结来源仍为F3-A所选的多维表格、表“生图任务”及视图“① 从这里开始｜准备生图”。只允许一次user只读记录请求，页大小固定5，offset固定0；有更多记录也不继续。没有Raw/Wiki/AI/写入、附件下载、关联记录展开或公式来源追踪能力。

当前已有`base:record:read`，新增权限0。原本机授权元数据为`needs_refresh`；用户完成重新授权后本机状态为ready/valid。新增权限0，OAuth reauth已完成。

## 正式边界

- `platform/feishu-bitable-preview`为严格合同，Browser只传已取得table/view opaque refs和字面量5；不接受真实ID、token、分页、原始路径或其他limit。
- F3-A注册的view必须确属对应table；Backend固定本次确认范围。一旦开始尝试，成功/失败均缓存为同一Promise，不再调用Reader，不允许换其他表/视图继续。连接失效在真实Reader前失败。
- 正式CLI仅使用`base +record-list --view-id ... --limit 5 --offset 0 --as user --json`。此JSON路径一次GET，不采用会翻页/落盘的NDJSON导出。不调用结构、附件、用户或关联记录接口。
- 投影在CLI stdout产生前完成：普通文本/数字/日期/选择保留；附件/关联只保留数量，用户字段只保留是否设置；公式/lookup/rich content只有类型和是否设置。原始record IDs、文件token、用户信息、原始响应不交给Browser。错误不会回显响应/原始stderr。
- `BitableRecordPreview`要求明确点击才读；紧凑行列表最多5条，优先重点列，其他普通字段本地展开；记录选中只更新React会话，不外发或持久化。预览开始后表/视图选择固定，保留原选择状态。

## 回归与隐私

TDD先复现缺少Preview能力、CLI适配和页面的红灯，再逐条接通。Typecheck/build通过；16个文件58项测试通过：0/1/5条、hasMore不翻页、超量/错误响应拒绝、简单字段、复杂字段计数、权限不足、连接失效、并发/重复请求去重、Origin/session保护、任意参数拒绝、Profile/Raw/Wiki不变化、F1缓存、F3-A选择和600px。

回归只用TEST fixture和CLI离线dry-run，没有真实记录内容。Frozen Product Spec 12/12、Architecture 8/8未变；Settings/Sidebar不改。

真实验收只记录请求数、记录数、选中数量、hasMore及字段类型，不保存实际记录正文、标题、截图或原始响应。真实预览只留在本地页面内存；验证过程不把正文写进terminal/log/Git/fixture。隔离验证将复用已取得的F3-A结构缓存，仅重建当前已确认表/视图的会话引用，不再次搜索或向飞书读取结构。

## 官方依据

- [固定record-list命令与只读scope](https://github.com/larksuite/cli/blob/v1.0.96/shortcuts/base/record_list.go)
- [一次JSON GET实现](https://github.com/larksuite/cli/blob/v1.0.96/shortcuts/base/record_ops.go)：V3将页大小命名为`limit`，本轮固定5。
- [官方matrix字段协议](https://github.com/larksuite/cli/blob/v1.0.96/shortcuts/base/recordexport/dataset.go)

## 真实有限预览证据（2026-10-07）

- 仅当前已冻结表/视图；CLI JSON固定页大小5、offset 0，一次请求/一次成功解析。hasMore=true，未读取下一页。
- 返回5条，本地Chrome页面显示5条，用户选中1条，页面选中标记及“已选择记录”状态均确认。返回字段类型为text/select/number/link/button；普通字段显示原返回值，link只显示项数，button不执行。没有附件下载、关联展开、F2搜索、新结构联网或F1身份读取。
- 真实Chrome 600px显示5条且无横向溢出；回到正常窗口，保留已选记录页面。没有截图、复制或保存真实记录全文。
- REAL 38张业务owner表的数量/内容hash不变，F1名称/头像缓存hash不变；Raw/Wiki创建0、AI读取0、飞书写入0。
- 记录正文只在受信任进程和Browser当前页面内存，无数据artifact、正文日志或测试fixture。LOCAL-ONLY safe-counts只保存数量/字段类型；不保存记录标题、单元格值、真实record ID或token。

最终收口核对：选中数量1，已选择状态可见；真实请求计数仍为1、返回5、hasMore=true，未翻页。附件下载/关联展开/Raw创建/飞书写入均0。核对未触发任何新外部读取或持久化业务写入；真实记录内容不进入本次提交。F3-C尚未开始，须等待独立授权。

# F3-C 已选飞书记录 → Raw 导入预览

状态：PASS，用户已审批本预览。下文记录 F3-C 当时只预览、不保存的证据；后续明确授权的唯一 Raw 保存见 [F3-D](f3d-bitable-raw-import.md)。F3-C 未commit/push。

## 唯一输入与边界

输入只来自F3-B已经读取并人工选中的会话快照。开始时Computer Use仅检查选中数/标记和行位置，不提取标题或正文。原隔离TEST宿主与已有缓存仍可用，复用同一宿主的成功Promise；F3-B请求计数在复用前后均为1，没有新的飞书调用。

为加载新增的正式预览能力，在受信任本机内存中保留选中那一条快照及原opaque refs，再替换TEST宿主。没有把记录内容落盘、放入命令参数或交给Agent。新TEST宿主所有飞书搜索、结构、record及身份重新读取port均拒绝调用。REAL宿主/资料不操作。快照若不可用，直接停止，不重新请求。

## 实现

- `record-preview.ts`把一次成功读取留在内存；新增严格`selectRecord`只选择该结果中的ref，冻结selected snapshot，不触发Reader。已选快照读取返回副本，不能被调用方改写。
- `record-snapshot.ts`校验字段与单元格数量、类型、来源refs及时间。原飞书ID不进入Browser，原F3-B已剥离的上游record ID不会被猜回；`record_ref`明确表示本次捕获快照的opaque引用。
- `raw-preview.ts`只有`readSelectedRecord`这个本地只读port，没有飞书、AI、Raw owner或数据库port。转换按真实返回字段顺序进行，空值省略；文本/数字/选择/日期/布尔保留已读语义，附件/关联只写数量占位。只有已有显示结果才能保留公式/lookup/人员显示值；F3-B仅留下是否设置的字段不被猜测或补读。
- 技术字段从普通Raw正文排除。来源路径与字段名来自选中快照，不制造不存在的字段。元数据单独准备`source_type=feishu_bitable_record`、bitable/table/view/record refs、选择/读取时间、upstream更新时间（有值才保留）、included/excluded字段及稳定digest；本轮不落库。
- 当前旧会话未记录准确的鼠标点击时刻，`selected_at`是本轮核对并登记选中快照的时间。`retrieved_at`使用F3-B唯一成功响应后计数证据文件的完成时间，明确不是上游更新时间；现有快照没有upstream更新时间，保持null。
- `BitableRawImportPreview`展示规范化正文、保留字段、忽略项与来源。取消只丢弃预览，保留原记录选择；“下一步确认导入”只返回`ready_for_import_confirmation`，没有保存能力。正文不可编辑，后端校验选中快照与digest，快照变化/丢失则拒绝旧预览。

## 真实本地验收（仅统计）

| 项目 | 结果 |
| --- | --- |
| 已选快照可用 | YES，保持F3-A table/view与F3-B record选择 |
| 本轮Feishu请求 | 0 |
| 快照字段数 | 10 |
| 将保留的字段数 | 4 |
| 排除的复杂内容字段数 | 0（当前记录复杂字段为空，没有猜测内容） |
| 忽略字段数 | 6 |
| 快照字段类型 | text / link / select / number / button |
| 预览digest | b7f5c014bd7836b6e607f675c30cc58afef330efa7e790d6c91d14e98f408644 |
| Chrome预览 | 可见；600px无横向溢出 |
| 附件下载 / 关联展开 / AI读取 / 飞书写入 | 0 / 0 / 0 / 0 |
| Raw / Wiki创建、Project变化 | 0 / 0 / 0 |
| REAL业务表 / F1缓存 | 38张owner表数量及内容hash、F1名称/头像hash未变 |

本文件不保存实际记录标题、正文、单元格值或原始响应。仅不含记录内容的预览标题截图和统计证据留在Git ignored的`out/f3c-validation/`。真实正文只在受信任进程与Career页面内存中显示；未放入terminal/log/Git/fixture。

## 回归

TDD先复现转换能力、cached record选择和UI缺失的红灯，再逐步实现。typecheck/build通过；19个测试文件65项通过，覆盖简单字段、0/false/空值、复杂字段占位、已读显示结果、技术字段排除、稳定digest、取消/待确认而不保存、快照丢失/外来ref拒绝、Origin/session保护、Browser无token/原始Feishu ID、600px、F1与F3-A/F3-B回归。测试只用TEST夹具与离线dry-run，不重复真实读取。

Frozen Product Spec 12/12与Architecture 8/8未修改。没有业务schema变更，没有Settings/Sidebar改版。等待用户在本地页面审批Raw导入预览，保存必须下一阶段另行授权。

# E2 后重新配置连接凭据

E2 删除了旧宿主代码，但不删除或读取旧凭据文件、系统钥匙串项目和业务资料。旧密文保持原样。新路径只使用 native-v1 vault 和 Career 的固定 Keychain slot；不会根据旧文件存在就显示“当前可用”。

后续由用户本人：

1. 若同一 profile 的旧历史后台仍在运行，先退出它；不要同时运行两个 writer。Agent 不在本轮停止真实资料库后台。
2. 启动新 Career，打开「设置 → AI / Search 连接 → 设置 / 替换 Key」。在正式 UI 输入新的 DeepSeek / Tavily Key，不发到聊天。
3. 本地检查只返回已配置、等待授权、可用或失败状态。系统授权/密码由用户完成。浏览器不能回读保存后的 Key。
4. 如需真实连接测试，先单独确认最终外发内容、接收方和请求范围；不继承已经消费的 J-07 授权，不自动重试或切换 provider。
5. 新路径验证成功后，再由用户决定是否退休旧凭据。删除代码、重新输入凭据、删除旧 Secret 数据是三件独立的事。本轮只做第一件。

所有 Key 均不进入业务 DB、command recorder、日志、URL、localStorage 或业务备份。TEST Keychain 测试只创建/清理隔离 TEST namespace。

若需恢复 E1，使用本地 `e1-pass-before-e2` tag 的完整工程及其固定依赖，在独立 checkout 重建。必须先正常退出当前 workspace 的 writer。回滚本身不授权读取、导出、迁移或删除真实凭据；不要把旧业务备份当作凭据回滚。

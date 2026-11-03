# 工作区恢复动画
采用 SupDance 自有 Logo、网格、双轨道、节点、浮动 UI 卡片、光晕、状态文字与等待指示。可配置背景明暗色、网格、站内 Logo、轨道/动画速度、0–8 节点、0–4 卡片、光晕、文案、退出效果、适用路径和超时反馈。

真实映射为 startup.auth_session_started → init；auth_session_ready → recovering；workspace_background_ready → syncing；workspace_ready 或 anonymous_ready → ready；auth_session_failed → failed。未发布或停用、Native、后台路由及禁用路径使用宿主 fallback。真正应用就绪后由宿主展示内容，动画不能决定认证或业务成功。

每阶段超时进入 failed；即使 fallback 固定传 syncing，也优先显示 failed，避免无限假恢复。重试重新加载原地址，保留原 next 参数，并继续复用宿主安全跳转检查；不创建替代生成任务。Logo 只允许站内路径，加载失败显示自有图标。ready 可淡出或即时退出。减少动效和暂停停止持续运动；动效总开关/低性能模式可强制降低运动。

控制台自动阶段演示明确标记，不作为真实项目同步或真实生成成功证据。自动状态机测试覆盖五阶段及失败/重试；浏览器已验证减少动效实时切换与暂停。

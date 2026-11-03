# 组件适配合同
AntD ThemeConfig 适配 Button、Input/Textarea、InputNumber、Select、Checkbox、Radio、Switch、Slider、Dropdown、Popover、Tooltip、Tabs、Segmented、Card、Table、Modal、Drawer、Message 和 Notification。配置在 AppProviders 与 UserLayout 的嵌套 ConfigProvider 一致生效。

宿主组件继续消费已有语义变量：ModelSelect/ParameterPopover 的菜单色、边框、圆角与 E2；Composer、CanvasToolbar/FloatingDock 的表面与 E1；Canvas/Zoom/Agent 使用宿主 canvasTheme 的 token 映射。业务布局、指针捕获、菜单定位、滚轮边界、提交和权限判断仍由真实宿主组件控制。没有独立音乐/支付/第三方子站页面时，不宣称已跨应用适配。

AppModal/AppDrawer 通过显式 Overlay Extension 消费独立遮罩和 E3 深度，宿主显式 styles 优先，flush 合同不变。原生焦点陷阱、Escape、背景阻挡与销毁由 AntD 提供；控制台触发器在关闭后恢复焦点。

预览使用真实 AntD 控件与 AppModal/AppDrawer，包含 Rest、Hover、Pressed、Focus、Selected、Disabled、Loading、Error 和 Expanded 示例；按钮不发出生成任务。自动测试验证 CSS 所有权清理、独立遮罩与 Router 生命周期；真实页面验证嵌套模态、全屏预览和焦点返回。不能把样式一致性当作真实供应商生成验收。

## 模型下拉选择器精简适配规范 (Model Picker Adapter)
- **非侵入式架构**：不侵入修改宿主 `model-picker.tsx` 的模型调用、渠道分发与计费结算逻辑，基于 `html[data-ve-simplified-model-picker="true"]` 精准增强。
- **左侧品牌栏**：隐藏 `.canvas-model-picker-brand-meta`（渠道数、服务商及小圆点），居中显示品牌 Logo 与品牌名称，宽度收缩至 210px。
- **右侧模型列表（参考图 2 音乐模型风格）**：隐藏暴露底层加价公式的冗长描述 `.canvas-model-picker-description`；卡片圆角 8px、适度留白；选中项与悬停态具备主色高光反馈。
- **积分区间药丸 Badge**：`.model-picker-price` 转化为独立高对比度圆角药丸 Badge，严格保留原计费区间。
- **调用采样监控浮窗（图 3）**：通过 CSS `display: none !important; pointer-events: none !important;` 彻底视觉隐藏 `.model-picker-availability` 及弹出层 `.model-picker-availability-popover`，绝不删除底层 DOM 节点或状态机。

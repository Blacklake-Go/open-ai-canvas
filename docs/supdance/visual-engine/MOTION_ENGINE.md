# 动效引擎
默认快速反馈 150ms、下拉进入 200ms/退出 150ms、Modal 200ms、Drawer 250ms、Tabs 200ms。所有曲线限定安全 CSS easing，cubic-bezier 必须有 4 个有限数字，横坐标位于 0–1。服务端拒绝非法曲线、任意 CSS 和超限参数。

页面过渡使用 WAAPI，只动画 opacity/transform，可配置 fade/slide/scale、时长、延迟、位移、缩放、透明度、方向、路径及模块范围。page 覆盖普通路由，workspace 覆盖 projects，generation 覆盖 create；overlay 的时长由组件适配器和 Motion 配置控制。路由订阅来自宿主 Router，不覆盖 history。新过渡取消旧动画；不支持 WAAPI 或参数失败时保持即时可用。

低性能模式禁用微交互和页面过渡。系统减少动效通过 matchMedia 外部存储订阅实时响应，恢复动画停止轨道、缩放与跳动；可手动暂停。减少动效策略提供即时或短淡入，画布拖动、滑杆与实时输入不引入缓动。连续任务状态仍由宿主真实状态决定，不生成假百分比。

# Visual Console
两个入口均进入 `/admin/plugins/visual-engine`：后台插件管理的控制台按钮，以及宿主侧栏唯一的“视觉引擎”。停用或无 view 权限时侧栏消失；直接 API 仍经服务端鉴权。

16 个模块：Dashboard、Themes、Colors、Typography、Components、Effects、Interactions、Motion、Transitions、Loading、Page Rules、Preview、Presets、Versions、Diagnostics、Audit Logs。编辑先更新草稿；保存写入当前管理员服务端草稿；预览展示真实组件；发布校验后原子生效。Versions 显示快照、归档、差异和恢复；Diagnostics 展示实际宿主版本、扩展和对比度；权限面板限定 lifecycle 管理员。

宽屏使用内部导航/编辑/预览；中小屏使用模块选择器和预览抽屉，支持全屏预览。1695、1280、768、390 四个真实视口及 390px 下 200% 根字号已验证无文档横向溢出。预览支持明暗、桌面/平板/手机、动画重播和已发布/草稿并排。宿主后台不会被未发布草稿换肤。

发布、回滚、编辑、预览、查看、生命周期六类能力分别检查。默认沿用宿主管理员权限；显式策略可限制单个管理员，其他能力要求同时具有 view，禁止自行撤销 lifecycle 造成锁死。

# 00 — SupDance 全站 UI 深度审计与组件盘点报告 (UI Inventory & Audit)

> **审计执行时间**：2026-10-27  
> **审计范围**：`web/` 前端应用、`backend/` 后端外观接口与配置、`docs/` 既有设计规范与二开规范。  
> **执行原则**：基于真实代码、配置文件与依赖锁文件进行全量扫描，禁止凭空推测。

---

## 1. 真实项目架构与技术栈审计

### 1.1 前端核心技术栈 (Web Tier)
- **运行时环境与包管理**：Bun `1.4.3`（锁文件基线对齐 `packageManager: bun@1.3.9`），严禁引入 `npm`、`pnpm` 或 `yarn` 产生的锁文件。
- **核心视图框架**：React `19.2.7` + React DOM `19.2.7`。
- **构建与打包工具**：Vite `8.1.5` + `@vitejs/plugin-react` `6.0.3` + TypeScript `7.0.2` (`tsc --noEmit`)。
- **路由管理**：React Router `8.2.0`（统一在 `web/src/router.tsx` 中使用 `createBrowserRouter`，支持代码分块懒加载 `lazy()`）。
- **状态管理**：Zustand `5.0.14`（轻量全局状态，如 `useAppearanceStore`、`useThemeStore`、`useCanvasStore`）+ TanStack Query `5.101.2`（服务端数据请求与缓存）。
- **现有 UI 组件库**：
  1. **Ant Design** `6.5.1`：用于数据密集型后台、复杂表单、表格、下拉与模态框。
  2. **Celadon UI**（自研组件层，位于 `web/src/components/ui/`）：基于 `class-variance-authority` (cva `0.7.1`)、`tailwind-merge` (`3.6.0`)、`clsx` (`2.1.1`) 与 React Aria Components (`1.21.1`) 逐步接管原生/AntD 控件。
  3. **Aceternity UI / FX**：特效组件（如 `SpotlightSurface`、`CometCard`、`FullScreenLoader`），归位至 `ui/fx/` 命名空间。
- **样式与 CSS 体系**：
  - Tailwind CSS `v4.3.3` + `@tailwindcss/postcss` `4.3.3` + `tw-animate-css` `1.4.0`。
  - 全局主样式表：`web/src/styles/globals.css`（定义三层 Token 体系：Primitive → Semantic → Component）。
  - 动态主题映射：`web/src/lib/skin-themes.ts`（向 `:root` 注入 CSS 变量）与 `web/src/lib/app-theme.ts`（生成 Ant Design `ThemeConfig`）。
  - 管理后台专用隔离样式：`web/src/pages/admin/theme/admin-tokens.css`。
- **图标体系**：
  - 主要图标库：`lucide-react` `1.25.0`（统一以组件引用传入，严禁外部 className 硬改尺寸）。
  - 辅助图标库：`@ant-design/icons` `6.3.2`（遗留组件）、`@lobehub/icons` `5.16.0`（AI 模型提供商标识）。
- **字体排印与加载**：
  - 英文正文/西文变量字体：`@fontsource-variable/inter` `5.3.0`（`Inter Variable`）。
  - 代码/等宽字体：`@fontsource-variable/jetbrains-mono` `5.3.0`（`JetBrains Mono Variable`）。
  - 中文回退字体栈：`PingFang SC`、`Hiragino Sans GB`、`Microsoft YaHei`、`ui-sans-serif`、`system-ui`。
- **媒体、画布与三维引擎**：
  - 无限画布：Leafer UI `2.2.7` / Tldraw `5.2.5`。
  - 3D Mannequin / 预演：Three.js `0.185.1` + `@react-three/fiber` `9.6.1` + `@react-three/drei` `10.7.7`。
  - 视频与音频处理：`@ffmpeg/ffmpeg` `0.12.15`、`@vidstack/react` `1.15.6`。
  - 富文本编辑器：Tiptap `3.28.0`（核心与全部扩展严格统一版本）。

### 1.2 后端技术栈 (Backend Tier)
- **开发语言与框架**：Go `1.25.0`，HTTP 引擎为 Gin `v1.12.0`。
- **ORM 与数据库驱动**：GORM `1.31.2`，支持 SQLite (`gorm.io/driver/sqlite` `1.6.0`) 与 PostgreSQL (`gorm.io/driver/postgres` `1.6.2`, `jackc/pgx/v5` `5.10.0`)。
- **分布式协调与缓存**：Redis (`go-redis/v9` `9.22.0`)。
- **文件存储与多云对象存储**：本地文件存储、七牛云 Kodo (`qiniu/go-sdk/v7`)、腾讯云 COS (`cos-go-sdk-v5`)、阿里云 OSS。
- **系统外观与设置持久化**：
  - 数据表：`system_settings`（KV 结构，外观配置存储于 `key = "appearance"`）。
  - 服务端处理层：`backend/internal/app/appearance_*.go`、`backend/internal/app/appearance_skins.go`。
  - 接口路由：公开配置 `GET /api/public/appearance`，管理员配置 `GET /api/admin/settings/appearance`、`PUT /api/admin/settings/appearance`。

---

## 2. 现有主题、皮肤与管理后台外观机制审计

### 2.1 后台外观设置结构 (`/admin/settings/appearance`)
后台界面提供 8 大功能区：
1. **品牌识别 (brand)**：中文品牌名 (`brandName`)、英文标识 (`brandSlug`)、兑换码购买链接 (`redeemPurchaseUrl`)、浅色模式 Logo (`logoResourceId`)、深色模式 Logo (`darkLogoResourceId`)、Logo 外框开关 (`logoFrameEnabled`)。
2. **登录页媒体 (auth)**：主标题 (`authHeroTitle`)、副标题说明 (`authHeroDescription`)、背景视频 (`authVideoResourceId`)、视频海报封面 (`authVideoPosterResourceId`)、自动播放开关 (`authVideoAutoplay`)。
3. **欢迎页开关 (welcome)**：访客可见性设置。
4. **SEO 信息 (seo)**：SEO 标题 (`seoTitle`)、SEO 描述 (`seoDescription`)、SEO 关键词 (`seoKeywords`)。
5. **页尾与备案 (footer)**：版权文字 (`footerCopyright`)、ICP 备案号 (`icpFilingNumber`)、备案号展示开关 (`icpFilingEnabled`)。
6. **皮肤主题 (skins)**：当前激活皮肤 (`skinId`)、皮肤库定义 (`skinThemes: SkinDefinition[]`)。
7. **画布配置 (canvas)**：Agent 头像包 (`canvas.agentAvatarBundle`) 与预设。
8. **更新公告 (updates)**：站点全局更新弹窗公告。

### 2.2 现有主题运行时加载与生效链路
1. **首屏初始化**：`web/src/main.tsx` 调用 `bootstrapAppearance()`，通过 `GET /api/public/appearance` 获取服务端持久化的公开配置。
2. **状态更新**：调用 `commitPublicAppearance(appearance)`，更新 Zustand `useAppearanceStore`。
3. **样式注入**：`applySkinTheme(appearance.activeSkin, mode)` 将 50 种语义色与 17 项组件度量以 CSS 自定义属性方式注入 `document.documentElement.style`。
4. **Ant Design 响应**：`web/src/components/layout/app-providers.tsx` 监听 `useAppearanceStore`，调用 `getAntThemeConfig(isDark, appearance.skinId)`，向 Ant Design `<ConfigProvider theme={...}>` 传递最新 Token。

### 2.3 发现的审计痛点与缺陷 (Gaps)
1. **局部样式硬编码未连接主题**：部分老旧页面直接使用硬编码色值（例如 `#17171a`、`#f5f5f7` 或纯黑色/白色），未完全引用 `var(--primary)` 或 `var(--surface)`。
2. **同一组件多处重复实现**：
   - 按钮存在 Ant Design `<Button>`、Celadon `<IconButton>`/`<ToolButton>`、以及各类原生按钮三套方案并存。
   - 状态点存在 Ant Design `<Tag>`/`<Badge>`、Celadon `<StatusBadge>` 和 Admin `<AdminStatusBadge>`。
   - 下拉选择器存在原生 `<select>`、Ant Design `<Select>` 与 Celadon RAC `<Select>`。
3. **Z-Index 层级混乱风险**：
   - 全局定义的 `--z-*`（0 到 2000）与局部随意书写的 `z-50`、`z-30` 或 `z-[999]` 并存，在多层弹窗嵌下拉框时易出现遮挡或穿透。
4. **移动端适配度不均**：后台表格与画布工具栏主要针对桌面大屏优化，小屏存在横向溢出风险。

---

## 3. 全站组件深度盘点 (UI Inventory)

下表对全站各系统、关键页面与组件进行了完整盘点与风险分级：

| 页面 / 组件名称 | 真实文件相对路径 | 所属系统 | 组件类型 | 当前样式来源 | 是否重复实现 | 主题支持 | 规范符合度 | 风险等级 | 建议处理方式 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ToolButton** | `web/src/components/ui/base/buttons/tool-button.tsx` | 通用/画布 | Button | cva + Token | 否 | 完整支持 | 通过 | P2 | 保留作为标准工具按钮 |
| **IconButton** | `web/src/components/ui/base/buttons/icon-button.tsx` | 通用/前台 | Button | cva + Token | 否 | 完整支持 | 通过 | P2 | 保留作为标准图标按钮 |
| **DeleteButton** | `web/src/components/ui/base/buttons/delete-button.tsx` | 通用/后台 | Button | cva + Token | 否 | 完整支持 | 通过 | P2 | 保留作为破坏性操作按钮 |
| **StatusBadge** | `web/src/components/ui/base/badges/status-badge.tsx` | 通用/工作台 | Badge | cva + Token | 是 (Admin 有同类) | 完整支持 | 通过 | P1 | 推广为全站状态徽章基底 |
| **AdminStatusBadge**| `web/src/pages/admin/components/admin-ui.tsx` | 管理后台 | Badge | Scoped CSS | 是 | 完整支持 | 通过 | P2 | 保持后台独立隔离使用 |
| **Select (RAC)** | `web/src/components/ui/base/select/select.tsx` | 通用/工作台 | Select | RAC + Token | 是 (AntD Select 并存) | 完整支持 | 待整改 | P1 | 完善搜索多选，作为标准件 |
| **AntD Select** | `node_modules/antd` / 各业务页面引用 | 后台/复杂表单| Select | AntD CSS-in-JS | 是 | 部分支持 | 待整改 | P1 | 由 `app-theme.ts` 集中约束 |
| **Switch** | `web/src/components/ui/base/switch/switch.tsx` | 通用/工作台 | Switch | Token + CSS | 是 (Admin Switch 并存) | 完整支持 | 通过 | P2 | 保留为标准切换器 |
| **Admin Controls** | `web/src/pages/admin/ui/controls.tsx` | 管理后台 | Switch/Input | Admin Tokens | 否 | 完整支持 | 通过 | P2 | 保持后台高密度隔离 |
| **Checkbox** | `web/src/components/ui/base/checkbox/checkbox.tsx` | 通用/工作台 | Checkbox | Native + Token | 是 | 完整支持 | 通过 | P2 | 保留为标准复选框 |
| **SegmentedControl**| `web/src/components/ui/base/segmented-control/segmented-control.tsx`| 通用 | Segmented | cva + Token | 否 | 完整支持 | 通过 | P2 | 推广替换 AntD Segmented |
| **AppModal** | `web/src/components/ui/product/app-modal/app-modal.tsx` | 通用/工作台 | Modal | AntD Modal 包壳 | 是 (AdminModal 并存) | 完整支持 | 通过 | P1 | 标准全站产品弹窗基底 |
| **AppDrawer** | `web/src/components/ui/product/app-drawer/app-drawer.tsx` | 通用/工作台 | Drawer | AntD Drawer 包壳| 是 (AdminDrawer 并存)| 完整支持 | 通过 | P1 | 标准全站侧拉抽屉基底 |
| **EmptyState** | `web/src/components/ui/product/empty-state/empty-state.tsx`| 通用/工作台 | Empty | Token + Lucide | 是 (AdminTableEmpty) | 完整支持 | 通过 | P1 | 已通过门禁禁掉 AntD Empty |
| **Callout** | `web/src/components/ui/product/callout/callout.tsx` | 通用/工作台 | Alert | Token + cva | 否 | 完整支持 | 通过 | P2 | 标准消息提示栏 |
| **Tooltip (RAC)** | `web/src/components/ui/base/tooltip/tooltip.tsx` | 通用/工作台 | Tooltip | RAC + Token | 是 (AntD Tooltip 并存)| 完整支持 | 通过 | P1 | 优先使用 RAC Tooltip |
| **CreationWorkspace**| `web/src/pages/create/creation-workspace.tsx` | 生成岛/Studio| Composite | CSS Modules/Token | 否 | 完整支持 | 待整改 | P1 | 规范任务进度条与状态机 |
| **CanvasViewport** | `web/src/components/canvas/canvas-viewport.tsx` | 无限画布 | Canvas Root | Canvas Scoped | 否 | 完整支持 | 通过 | P1 | 确保图层坐标与全局样式隔离 |
| **CanvasNode** | `web/src/components/canvas/canvas-node.tsx` | 无限画布 | Node Container| Token + CSS | 否 | 完整支持 | 通过 | P1 | 统一选中高亮与圆角阴影 |
| **AdminShell** | `web/src/pages/admin/components/admin-shell.tsx` | 管理后台 | Layout | Admin Scoped | 否 | 完整支持 | 通过 | P2 | 维持折叠侧栏与高密度表格 |
| **AppearanceSettings**| `web/src/pages/admin/settings/appearance-settings-page.tsx`| 后台外观 | Settings Form| AntD + Admin UI | 否 | 完整支持 | 通过 | P0 | 外观设置最高优先级生效入口 |
| **AuthScene** | `web/src/pages/auth/auth-scene.tsx` | 前台/认证 | Auth Layout | Token + Media | 否 | 完整支持 | 通过 | P1 | 确保品牌媒体与六语言适配 |
| **TopbarLanguageSwitcher**| `web/src/supdance/plugins/i18n/components/topbar-language-switcher.tsx`| 插件/导航 | Dropdown/Menu | Plugin Token | 否 | 完整支持 | 通过 | P2 | 插件无侵入式注入顶栏 |

---

## 4. 关键风险与阶段治理结论

1. **P0 风险（立即规范，首要保护）**：
   - 后台外观设置持久化与全局消费：确保保存后全站即时响应，不被陈旧 localStorage 覆盖，且无无效配置导致白屏的风险。
   - 遮罩层与 Z-Index 错位：确保弹窗内嵌下拉、抽屉内嵌 Tooltip 不发生层级截断。
2. **P1 风险（第一阶段立契约，后续受控迁移）**：
   - 下拉选择器与弹窗的多头实现问题（AntD vs RAC vs Admin）。
   - 任务生成状态机统一，彻底杜绝虚假动画进度条。
3. **P2 风险（设计细节与长期演进）**：
   - 阴影、微动效与圆角在非核心页面的像素级统一。

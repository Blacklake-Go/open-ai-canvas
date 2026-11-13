# 影策 UI 设计系统规范 (UI-SPEC.md)

> **版本**：2.0.0  
> **制定日期**：2026-11-13  
> **技术底座**：React 19 + TypeScript + Tailwind CSS v4 + Ant Design 6 + Celadon UI  
> **适用范围**：SupDance / 影策全站前台 (Public)、创作工作台 (Studio)、无限画布 (Canvas)、管理后台 (Admin) 与第三方插件 (Plugins)。

---

## 1. 设计哲学与核心原则

影策（SupDance）是一套面向 AI 影视与短剧创作的专业工程工作台。设计系统的核心价值在于：**专业、克制、光感层次、高效创作与无障碍包容**。

### 核心原则
1. **内容优于装饰 (Content-First)**：界面作为暗调或极简画布，最大限度烘托创作者生成的剧本、图像、音视频多媒体内容，减少艳丽干扰色。
2. **三层令牌单一真理 (Single Source of Tokens)**：所有组件与页面样式必须溯源至 `Primitive → Semantic → Component` 三层 Token，禁止在业务页面硬编码 Hex 色值或随意像素。
3. **明暗双模独立对称 (Dual-Theme Parity)**：深色模式绝非简单的亮色反相，而是根据感知亮度与发光规律精心调配的高对比度视觉矩阵。
4. **WCAG 2.2 AA 无障碍保障 (Accessibility Foundation)**：正文与底色对比度必须 $\ge 4.5:1$，主交互按钮 $\ge 7:1$，键盘焦点状态清晰可见，支持 `prefers-reduced-motion`。

---

## 2. 颜色体系 (Color System)

### 2.1 基础色板 (Primitive Oklch Palette)
全局基础色板采用感知均匀的 `oklch` 色彩空间，中性色微带偏冷色相（Hue 286），避免死灰或纯白：

- `neutral-0`: `oklch(1 0 0)` (纯白)
- `neutral-50`: `oklch(0.985 0.002 286)` (极浅灰底)
- `neutral-100`: `oklch(0.970 0.003 286)`
- `neutral-200`: `oklch(0.922 0.004 286)` (轻量控件底色)
- `neutral-300`: `oklch(0.870 0.005 286)` (明模边框)
- `neutral-400`: `oklch(0.708 0.006 286)` (次级占位文字)
- `neutral-500`: `oklch(0.556 0.007 286)` (辅助说明文字)
- `neutral-600`: `oklch(0.439 0.007 286)`
- `neutral-700`: `oklch(0.371 0.007 286)` (暗模高亮描边)
- `neutral-800`: `oklch(0.269 0.006 286)` (暗模卡片抬升)
- `neutral-900`: `oklch(0.205 0.005 286)` (暗模卡片表面 `#18181b`)
- `neutral-950`: `oklch(0.145 0.005 286)` (暗模基底背景 `#0f0f11`)

### 2.2 语义颜色映射表 (Semantic Colors)

| 语义变量 | 浅色模式 (Light) | 深色模式 (Dark) | 语义说明与对比度指标 |
| :--- | :--- | :--- | :--- |
| `--ui-bg-canvas` | `#ffffff` | `#0f0f11` | 最底层视口画布底色 |
| `--ui-bg-surface` | `#ffffff` | `#18181b` | 标准卡片表面底色 |
| `--ui-bg-surface-subtle` | `#f7f7f7` | `#202020` | 次级列表项、紧凑单元底色 |
| `--ui-bg-surface-raised` | `#ececec` | `#2a2a2a` | 悬停抬升或浮出层底色 |
| `--ui-bg-overlay` | `#ffffff` | `#1f1f20` | 下拉菜单、气泡弹层（必须实底不透明） |
| `--ui-text-primary` | `#171717` | `#f5f5f5` | 一级正文、主标题（对比度 $\ge 10:1$） |
| `--ui-text-muted` | `#737373` | `#a3a3a3` | 二级说明、未激活提示（对比度 $\ge 4.5:1$） |
| `--ui-text-tertiary` | `#a3a3a3` | `#525252` | 三级失效、只读角标（对比度 $\ge 3.0:1$） |
| `--ui-border-subtle` | `rgba(17,17,17,0.08)` | `rgba(255,255,255,0.08)`| 容器默认分隔线 |
| `--ui-border-control` | `rgba(17,17,17,0.18)` | `rgba(255,255,255,0.18)`| 输入框、选择器交互线框 |
| `--ui-border-focus` | `#171717` | `#f5f5f5` | 键盘焦点或激活外框 |
| `--ui-primary` | `#171717` | `#f5f5f5` | 核心行动点（黑白高对比主题） |
| `--ui-primary-foreground` | `#ffffff` | `#171717` | 主操作按钮前景文字 |
| `--ui-primary-hover` | `#303030` | `#ffffff` | 主按钮悬停态 |
| `--ui-primary-active` | `#404040` | `#e5e5e5` | 主按钮按下态 |
| `--ui-status-success` | `#16a34a` | `#4ade80` | 成功完成、运行正常 |
| `--ui-status-warning` | `#d97706` | `#fbbf24` | 告警、扣费提醒、实验性能力 |
| `--ui-status-danger` | `#dc2626` | `#f87171` | 严重错误、删除危险操作 |
| `--ui-status-info` | `#2563eb` | `#60a5fa` | 帮助提示、系统更新 |

---

## 3. 字体与排版规范 (Typography)

### 3.1 字体栈与回退策略
```css
/* 西文与中文字体栈 */
--ui-font-sans: "Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif;

/* 代码与数字等宽字体栈 */
--ui-font-mono: "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

### 3.2 字号与行高阶梯 (6 档正规模制 + 2 档特例)

| 档位 | 字号 (px/rem) | 行高 | 字重 | 适用场景 |
| :--- | :--- | :--- | :--- | :--- |
| **Nano (特例)** | `7px` / 0.4375rem | 1.0 | 400 | 画布缩略图画框内的示意文本（非正规可读文本） |
| **Label (1 档)** | `11px` / 0.6875rem | 1.35 | 500 / 600 | 徽章、角标、标签栏数字、辅助状态 |
| **Caption (2 档)**| `12px` / 0.75rem | 1.45 | 400 / 500 | 字段提示、参数微调说明、时间戳、表格元数据 |
| **UI (3 档)** | `13px` / 0.8125rem | 1.50 | 400 / 500 | 导航菜单、按钮文案、标准输入框、紧凑正文 |
| **Body (4 档)** | `14px` / 0.875rem | 1.65 | 400 / 500 | 标准正文、说明文档段落、弹窗表单标签 |
| **Heading (5 档)**| `16px` / 1.0rem | 1.30 | 600 | 区块标题、卡片组标题、弹窗 Header |
| **Title (6 档)** | `22px` / 1.375rem | 1.25 | 600 | 页面主标题、Hero 辅助标题 |
| **Display (特例)**| `32px` / 2.0rem | 1.20 | 600 / 700 | 认证页 Slogan、核心统计数字大字号 |

### 3.3 排版与数字规范
- **数字显示**：表格数据、积分点数、任务倒计时必须使用 `font-variant-numeric: tabular-nums`，防止字符抖动。
- **长文本截断**：
  - 单行截断：`truncate` (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`)。
  - 多行截断：`line-clamp-2` / `line-clamp-3`，必须配合 `title` 属性或 Tooltip 提供完整文本读取。

---

## 4. 布局、栅格与间距系统 (Layout & Spacing)

采用 **4px 基础网格**。所有内外边距必须是 4 的倍数：

| 变量 | 像素值 | 适用场景 |
| :--- | :--- | :--- |
| `--space-half` | `2px` | 极细微视觉补偿（非通用间距） |
| `--space-1` | `4px` | 按钮内图标与文字间隔、标签内边距 |
| `--space-2` | `8px` | 控件内部紧凑间距、卡片列表间隙 |
| `--space-3` | `12px` | 标准表单内边距、菜单项左右边距 |
| `--space-4` | `16px` | 标准卡片内边距、区块间常规间隔 |
| `--space-5` | `20px` | 面板区域内边距 |
| `--space-6` | `24px` | 大区块间隔、页面头部间距 |
| `--space-8` | `32px` | 工作区大分区留白 |
| `--space-12` | `48px` | 顶栏高度、大型分割间距 |

### 容器度量规范
- **侧边栏 (Sidebar)**：展开态 `220px`，折叠态 `64px`。
- **顶栏 (Topbar)**：固定高度 `48px`。
- **常驻通知栏 (Notice Banner)**：高度 `24px`。
- **内容最大宽度 (Max-Width)**：
  - 创作面板：最大宽度 `960px` 居中。
  - 认证模态：宽度 `1000px`，最大宽度 `1408px`。
  - 数据管理表格：`100%` 流式自适应。

---

## 5. 尺寸与形状规范 (Dimensions & Radii)

### 5.1 控件高度标准 (Control Heights)
- **紧凑型 (Small - SM)**：`30px`（管理后台高密表格操作、工具栏辅助按钮）。
- **标准型 (Medium - MD)**：`34px ~ 36px`（全站通用输入框、Select、标准按钮）。
- **宽适型 (Large - LG)**：`42px`（认证登录表单输入框、全宽提交主按钮）。

### 5.2 圆角系统 (Border Radius Ladder)
- `--r-xs` (`4px`)：复选框、徽章、工具栏内小指示器。
- `--r-sm` (`6px`)：紧凑按钮、迷你输入框。
- `--r-md` (`8px`)：标准按钮、下拉触发器、标准输入框、菜单项。
- `--r-lg` (`12px`)：浮动面板、下拉菜单气泡、引导特性卡片。
- `--r-xl` / `--r-2xl` (`16px`)：提示词主容器、卡片大表面、产品弹窗外壳。
- `--r-full` (`9999px`)：胶囊药丸按钮、全圆图标按钮、Avatar 头像。

### 5.3 交互热区
- **触控与光标底线**：桌面光标有效点击区 $\ge 32\times 32\text{px}$；移动端/触屏设备有效热区 $\ge 44\times 44\text{px}$（不足尺寸需使用绝对定位 `before` 扩展不可见点击区域）。

---

## 6. 阴影、表面与层级 (Shadows, Surfaces & Z-Index)

### 6.1 阴影阶梯与暗黑模式反相原则
暗黑模式下，纯黑阴影无法与暗底形成反差，若使用白色阴影会造成强烈眩光刺眼。
因此设计系统规定：**暗黑模式下放弃大面积光晕，采用“Hairline 内描边 + 物理黑阴影”交代层级**。

```css
/* 浅色模式阴影：贴边小阴影 + 弥散大阴影 */
--shadow-sm: 0 1px 2px rgba(20, 20, 32, 0.06), 0 2px 8px rgba(20, 20, 32, 0.04);
--shadow-md: 0 1px 2px rgba(20, 20, 32, 0.06), 0 4px 16px rgba(20, 20, 32, 0.06);
--shadow-lg: 0 1px 3px rgba(20, 20, 32, 0.07), 0 8px 24px rgba(20, 20, 32, 0.08);

/* 浮动层与卡片抬升（双模兼容） */
--elevation-card: 0 1px 2px rgba(20, 20, 32, 0.05), 0 2px 8px rgba(20, 20, 32, 0.03);
--elevation-card-hover: 0 10px 26px rgba(0, 0, 0, 0.1), 0 2px 5px rgba(0, 0, 0, 0.05);
--elevation-overlay: 0 24px 60px rgba(0, 0, 0, 0.2), 0 3px 10px rgba(0, 0, 0, 0.09);
--elevation-hairline: inset 0 0 0 1px rgba(255, 255, 255, 0.08); /* 暗色边界内描边 */
```

### 6.2 Z-Index 层叠天梯
严禁在业务页面随手书写 `z-[9999]` 或 `z-[1000]`。全站严格按 8 级阶梯分配：

| 层级名称 | 范围 | CSS 变量 | 对应 UI 元素 |
| :--- | :--- | :--- | :--- |
| **Canvas Low** | 0 – 9 | `--z-canvas-base` | 无限画布底板、网格参考线、背景图片 |
| **Canvas High**| 10 – 19 | `--z-canvas-node` | 画布节点卡片、连线、组合框 |
| **Layout Shell**| 20 – 29 | `--z-layout-shell`| 侧边栏、常规工具条、分栏器 |
| **Header Sticky**| 30 – 49 | `--z-header-sticky`| 顶栏 Topbar、常驻通知栏 Banner |
| **Floating Dock**| 50 – 59 | `--z-floating-dock`| 画布浮动控制盘、Minimap、右下角悬浮助手 |
| **Dropdown / Pop**| 60 – 79 | `--z-dropdown-pop` | Select 下拉菜单、Tooltip、Popover 气泡 |
| **Modal / Drawer**| 80 – 99 | `--z-modal-drawer` | 认证模态框、设置抽屉、毛玻璃遮罩 Backdrop |
| **Global Toast** | 100+ | `--z-global-toast` | 全局 Message 提示、离线网络断开告警 |

---

## 7. 动效系统 (Motion System)

### 7.1 时长与缓动函数 (Duration & Easing)
- **Fast (`120ms`)**：按钮按下、复选框勾选、开关切换、图标颜色变化。
- **Normal (`180ms`)**：下拉菜单展开/收起、Tab 页签切换、卡片悬停抬升。
- **Slow (`250ms`)**：模态弹窗淡入淡出、抽屉滑出、侧栏折叠拉伸。

```css
--ease-standard: cubic-bezier(0.2, 0, 0, 1);  /* 标准交互缓动 */
--ease-out: cubic-bezier(0, 0, 0.2, 1);       /* 浮层进入 */
--ease-in: cubic-bezier(0.4, 0, 1, 1);        /* 浮层退出 */
```

### 7.2 减弱动效回退 (Prefers-Reduced-Motion)
当用户系统开启“减弱动态效果”时，所有位移、缩放和弹跳动画必须降级为即时显隐或简短透明度淡变（$\le 100\text{ms}$）：

```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }
}
```

---

## 8. 响应式系统 (Responsive System)

### 8.1 响应式断点标准
- **Mobile (`< 640px`, `sm`)**：
  - 侧边栏转为抽屉 (Drawer) 或隐藏汉堡菜单。
  - 面包屑收缩为单一当前页面标题。
  - 表单操作全宽堆叠，禁用横向复杂表格。
- **Tablet (`640px ~ 1024px`, `md` / `lg`)**：
  - 侧边栏默认保持图标折叠态 (`64px`)，悬停或点击弹出二级浮层。
  - 创作 Studio 提示词输入框宽度自适应填满。
- **Desktop (`1024px ~ 1440px`, `xl`)**：
  - 侧边栏常驻展开 (`220px`)。
  - 创作面板居中 `960px`，灵感大厅保持 4 列卡片流。
- **Wide (`> 1440px`, `2xl`)**：
  - 支持多窗格并列（如左侧生成列表、右侧画布实时联动）。
